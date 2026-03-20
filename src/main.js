import './style.css';
import { Board } from './model/Board.js';
import { BoardView } from './view/BoardView.js';
import { Controller } from './controller/Controller.js';
import { HudView } from './view/HudView.js';
import { Piece } from './model/Piece.js';
import { PeerClient } from './network/PeerClient.js';
import { MESSAGE_TYPES } from './network/protocol.js';

const BOARD_ROWS = 8;
const BOARD_COLUMNS = 8;
const MAX_CELL_SIZE = 56;
const WATER_COORDS = [
    [3, 2],
    [4, 2],
    [3, 5],
    [4, 5],
];

const NORMAL_PIECE_POOL = [
    { type: 'Marschall', rank: 10, count: 1 },
    { type: 'General', rank: 9, count: 1 },
    { type: 'Minör', rank: 3, count: 2 },
    { type: 'Scout', rank: 2, count: 2 },
    { type: 'Spion', rank: 1, count: 1 },
    { type: 'Bombe', rank: 11, count: 2 },
    { type: 'Flagge', rank: 0, count: 1 },
];
const CUSTOM_NAME_RANK_ORDER = [0, 11, 1, 2, 3, 9, 10];
const PIECES_PER_PLAYER = NORMAL_PIECE_POOL.reduce((sum, entry) => sum + entry.count, 0);
const TEST_ENEMY_FORMATION = [
    { row: 0, col: 0, rank: 11 }, { row: 0, col: 1, rank: 10 }, { row: 0, col: 2, rank: 2 }, { row: 0, col: 3, rank: 9 },
    { row: 0, col: 4, rank: 3 }, { row: 0, col: 5, rank: 2 }, { row: 0, col: 6, rank: 3 }, { row: 0, col: 7, rank: 0 },
    { row: 1, col: 0, rank: 1 }, { row: 1, col: 1, rank: 11 },
];

let peerClient = null;
let localRole = null; // host | guest
let gameController = null;
let activeBoardView = null;
let activeHudView = null;
const pendingMessages = [];
let isDisconnecting = false;
let rematchLocalReady = false;
let rematchRemoteReady = false;
let selectedMode = 'normal';
let localCustomNamesById = null;
let remoteCustomNamesById = null;
let customNamesSubmitted = false;

function showScreen(screenId) {
    ['mode-screen', 'connection-screen', 'custom-name-screen', 'game-screen'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.toggle('hidden', id !== screenId);
    });
}

function setModeSelectionState() {
    const modeStatusEl = document.getElementById('mode-status-text');
    const normalBtn = document.getElementById('mode-normal-btn');
    const customBtn = document.getElementById('mode-custom-btn');
    const testingBtn = document.getElementById('mode-testing-btn');
    const isConnected = Boolean(peerClient && peerClient.isConnected());
    const isHost = localRole === 'host';

    if (!modeStatusEl || !normalBtn || !customBtn || !testingBtn) return;

    if (!isConnected) {
        modeStatusEl.textContent = 'Wähle einen Spielmodus';
        normalBtn.disabled = false;
        customBtn.disabled = false;
        testingBtn.disabled = false;
        customBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        testingBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        return;
    }

    testingBtn.disabled = true;
    customBtn.disabled = !isHost;
    normalBtn.disabled = !isHost;
    customBtn.classList.toggle('opacity-50', !isHost);
    customBtn.classList.toggle('cursor-not-allowed', !isHost);
    normalBtn.classList.toggle('opacity-50', !isHost);
    normalBtn.classList.toggle('cursor-not-allowed', !isHost);
    testingBtn.classList.add('opacity-50', 'cursor-not-allowed');
    if (isHost) {
        modeStatusEl.textContent = 'Verbindung aktiv: Wähle den Modus für den Neustart.';
    } else {
        modeStatusEl.textContent = 'Verbindung aktiv: Host wählt den Modus.';
    }
}

function getResponsiveCellSize() {
    const viewportWidth = Math.max(320, Math.min(window.innerWidth, document.documentElement.clientWidth || window.innerWidth));
    const horizontalPadding = 32; // body + container safety
    const boardAvailableWidth = Math.max(240, viewportWidth - horizontalPadding);
    const computed = Math.floor(boardAvailableWidth / BOARD_COLUMNS);
    return Math.max(28, Math.min(MAX_CELL_SIZE, computed));
}

function applyResponsiveSizing() {
    if (!activeBoardView || !activeHudView) return;
    const cellSize = getResponsiveCellSize();
    activeBoardView.setCellSize(cellSize);
    activeHudView.setCellSize(cellSize);
    if (gameController) {
        gameController.render();
    }
}

function renderLegend() {
    const legendContent = document.getElementById('legend-content');
    if (!legendContent) return;
    legendContent.innerHTML = NORMAL_PIECE_POOL
        .map(entry => `<div class="flex justify-between gap-3"><span>${entry.type}</span><span>Wert ${entry.rank}</span></div>`)
        .join('');
}

function setLegendVisibility(mode) {
    const legend = document.getElementById('legend');
    const showLegendBtn = document.getElementById('show-legend-btn');
    const legendWrapper = document.getElementById('legend-wrapper');
    if (!legend || !showLegendBtn || !legendWrapper) return;

    if (mode === 'custom') {
        legend.classList.add('hidden');
        showLegendBtn.classList.add('hidden');
        legendWrapper.classList.add('hidden');
        return;
    }
    legend.classList.remove('hidden');
    showLegendBtn.classList.add('hidden');
    legendWrapper.classList.remove('hidden');
}

function initLegendToggle() {
    const legend = document.getElementById('legend');
    const showLegendBtn = document.getElementById('show-legend-btn');
    if (!legend || !showLegendBtn) return;

    legend.addEventListener('click', () => {
        legend.classList.add('hidden');
        showLegendBtn.classList.remove('hidden');
    });

    showLegendBtn.addEventListener('click', () => {
        legend.classList.remove('hidden');
        showLegendBtn.classList.add('hidden');
    });
}

function createPiecesForOwner(owner, startId) {
    const pieces = [];
    let idCounter = startId;
    NORMAL_PIECE_POOL.forEach(entry => {
        for (let i = 0; i < entry.count; i++) {
            pieces.push(new Piece(idCounter, entry.type, entry.rank, owner, false));
            idCounter++;
        }
    });
    return pieces;
}

function getOwnerStartId(owner) {
    return owner === 'blue' ? 0 : PIECES_PER_PLAYER;
}

function getLocalOwner() {
    return localRole === 'host' ? 'blue' : 'red';
}

function getPieceSlotsForOwner(owner) {
    const ownerStartId = getOwnerStartId(owner);
    const ownerEndId = ownerStartId + PIECES_PER_PLAYER;
    const allOwnerPieces = [];
    for (let pieceId = ownerStartId; pieceId < ownerEndId; pieceId++) {
        const idx = pieceId - ownerStartId;
        let running = 0;
        for (const entry of NORMAL_PIECE_POOL) {
            running += entry.count;
            if (idx < running) {
                allOwnerPieces.push({ pieceId, rank: entry.rank, type: entry.type });
                break;
            }
        }
    }

    const byRank = new Map();
    allOwnerPieces.forEach((slot) => {
        if (!byRank.has(slot.rank)) byRank.set(slot.rank, []);
        byRank.get(slot.rank).push(slot);
    });

    const ordered = [];
    CUSTOM_NAME_RANK_ORDER.forEach((rank) => {
        const list = byRank.get(rank) || [];
        list.forEach((slot) => ordered.push(slot));
    });
    return ordered;
}

function createAllPieces() {
    const bluePieces = createPiecesForOwner('blue', 0);
    const redPieces = createPiecesForOwner('red', bluePieces.length);
    return { bluePieces, redPieces };
}

function buildEnemyPiecesForTesting(allEnemyPieces) {
    const poolByRank = new Map();
    allEnemyPieces.forEach(piece => {
        if (!poolByRank.has(piece.rank)) {
            poolByRank.set(piece.rank, []);
        }
        poolByRank.get(piece.rank).push(piece);
    });

    return TEST_ENEMY_FORMATION.map((entry) => {
        const list = poolByRank.get(entry.rank) || [];
        const piece = list.shift();
        return piece || null;
    }).filter(Boolean);
}

function resetCustomNameState() {
    localCustomNamesById = null;
    remoteCustomNamesById = null;
    customNamesSubmitted = false;
}

function renderCustomNameRows() {
    const rowsContainer = document.getElementById('custom-name-rows');
    if (!rowsContainer) return;
    const owner = getLocalOwner();
    const slots = getPieceSlotsForOwner(owner);
    const existingNames = localCustomNamesById || {};

    rowsContainer.innerHTML = slots.map((slot, index) => `
        <div class="grid grid-cols-2 gap-2 items-center">
          <div class="text-sm bg-gray-900/50 border border-gray-700 rounded-md px-2 py-1">
            ${index + 1}. ${slot.type}
          </div>
          <input
            data-piece-id="${slot.pieceId}"
            type="text"
            maxlength="20"
            value="${existingNames[slot.pieceId] || ''}"
            class="custom-name-input w-full px-2 py-1 rounded-md bg-gray-900 border border-gray-700 text-sm outline-none focus:border-blue-400"
            placeholder="Name eingeben"
          />
        </div>
    `).join('');

    rowsContainer.querySelectorAll('.custom-name-input').forEach((input) => {
        input.addEventListener('input', () => {
            updateCustomNameConfirmState();
        });
    });
}

function collectCustomNamesFromForm() {
    const inputs = Array.from(document.querySelectorAll('.custom-name-input'));
    const namesById = {};
    let isValid = true;

    inputs.forEach((input) => {
        const pieceId = parseInt(input.dataset.pieceId, 10);
        const value = input.value.trim();
        if (!value || value.length > 20) {
            isValid = false;
        }
        namesById[pieceId] = value;
    });

    return { isValid, namesById };
}

function updateCustomNameConfirmState() {
    const button = document.getElementById('confirm-custom-names-btn');
    if (!button) return;
    const { isValid } = collectCustomNamesFromForm();
    button.disabled = !isValid;
}

function setCustomNameStatus(message, className = 'text-gray-300') {
    const status = document.getElementById('custom-name-status-text');
    if (!status) return;
    status.textContent = message;
    status.className = `text-center ${className}`;
}

function openCustomNameScreen() {
    resetCustomNameState();
    showScreen('custom-name-screen');
    renderCustomNameRows();
    updateCustomNameConfirmState();
    setCustomNameStatus('Gib für alle 10 Figuren einen Namen ein (max. 20 Zeichen).');
}

function setConnectionStatus(text, className = 'text-yellow-300') {
    const statusEl = document.getElementById('connection-status-text');
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.className = `text-sm ${className}`;
}

function enableStartButton(enabled) {
    const startBtn = document.getElementById('start-online-match-btn');
    if (!startBtn) return;
    startBtn.disabled = !enabled;
}

function resetSessionUi() {
    const display = document.getElementById('session-key-display');
    if (display) display.textContent = '';
    const input = document.getElementById('session-key-input');
    if (input) input.value = '';
    enableStartButton(false);
}

function getRematchButton() {
    return document.getElementById('rematch-btn');
}

function resetRematchState() {
    rematchLocalReady = false;
    rematchRemoteReady = false;
    const button = getRematchButton();
    if (!button) return;
    button.classList.remove('hidden');
    button.disabled = false;
    button.textContent = 'Neustart anfragen';
}

function showRematchButton() {
    const button = getRematchButton();
    if (!button) return;
    button.classList.remove('hidden');
    button.disabled = false;
    button.textContent = 'Neustart anfragen';
}

function updateRematchButtonWaiting() {
    const button = getRematchButton();
    if (!button) return;
    button.disabled = true;
    button.textContent = 'Neustart: Warte auf Gegner...';
}

function disconnectSession(reason = 'Verbindung getrennt') {
    if (isDisconnecting) return;
    isDisconnecting = true;

    if (gameController) {
        gameController.destroy();
        gameController = null;
    }

    pendingMessages.length = 0;
    if (peerClient) {
        peerClient.destroy();
        peerClient = null;
    }

    localRole = null;
    selectedMode = 'normal';
    showScreen('connection-screen');
    setModeSelectionState();
    resetSessionUi();
    resetRematchState();
    resetCustomNameState();
    setConnectionStatus(`Status: ${reason}`, 'text-red-300');
    isDisconnecting = false;
}

function transitionToConnectedModeSelect() {
    if (gameController) {
        gameController.destroy();
        gameController = null;
    }
    activeBoardView = null;
    activeHudView = null;
    resetRematchState();
    resetCustomNameState();
    showScreen('mode-screen');
    setModeSelectionState();
}

function createPeerClient() {
    return new PeerClient({
        onLocalPeerId: (id) => {
            const display = document.getElementById('session-key-display');
            if (display) display.textContent = id;
            if (localRole === 'host') {
                setConnectionStatus('Status: Warte auf Verbindung...', 'text-yellow-300');
            }
        },
        onConnectionOpen: (remotePeerId) => {
            setConnectionStatus(`Status: Verbunden mit ${remotePeerId}`, 'text-green-300');
            enableStartButton(true);
            setModeSelectionState();
            if (peerClient) {
                peerClient.send(MESSAGE_TYPES.HELLO, {
                    role: localRole,
                    owner: localRole === 'host' ? 'blue' : 'red',
                });
            }
        },
        onConnectionClosed: () => {
            disconnectSession('Verbindung wurde geschlossen');
        },
        onMessage: (message) => {
            if (message.type === MESSAGE_TYPES.REMATCH_REQUEST) {
                rematchRemoteReady = true;
                if (gameController) {
                    gameController.setExternalStatusMessage('Gegner hat Neustart angefragt.', 'text-yellow-300 font-semibold');
                }
                if (localRole === 'host' && rematchLocalReady) {
                    peerClient?.send(MESSAGE_TYPES.REMATCH_MODE_SELECT_OPEN, {});
                    transitionToConnectedModeSelect();
                }
                return;
            }
            if (message.type === MESSAGE_TYPES.REMATCH_MODE_SELECT_OPEN) {
                transitionToConnectedModeSelect();
                return;
            }
            if (message.type === MESSAGE_TYPES.MODE_SELECTED) {
                if (message.payload?.mode === 'normal') {
                    selectedMode = 'normal';
                    showScreen('game-screen');
                    startOnlineGame('normal');
                } else if (message.payload?.mode === 'custom') {
                    selectedMode = 'custom';
                    openCustomNameScreen();
                }
                return;
            }
            if (message.type === MESSAGE_TYPES.CUSTOM_NAMES_SUBMITTED) {
                if (message.payload?.owner === getLocalOwner()) return;
                remoteCustomNamesById = message.payload?.namesById || null;
                if (selectedMode === 'custom' && gameController) {
                    const enemyOwner = getLocalOwner() === 'blue' ? 'red' : 'blue';
                    gameController.applyCustomNames(enemyOwner, remoteCustomNamesById);
                }
                return;
            }
            if (!gameController) {
                pendingMessages.push(message);
                return;
            }
            gameController.handleNetworkMessage(message);
        },
        onError: (error) => {
            setConnectionStatus(`Fehler: ${error.message}`, 'text-red-300');
        },
    });
}

function applyNamesToPieces(pieces, namesById) {
    if (!namesById) return;
    pieces.forEach((piece) => {
        if (namesById[piece.id]) {
            piece.displayType = namesById[piece.id];
        }
    });
}

function startOnlineGame(mode = 'normal') {
    if (!peerClient || !peerClient.isConnected()) return;
    selectedMode = mode;
    if (gameController) {
        gameController.destroy();
        gameController = null;
    }

    resetRematchState();

    const board = new Board(BOARD_ROWS, BOARD_COLUMNS, WATER_COORDS);
    const { bluePieces, redPieces } = createAllPieces();
    const localOwner = localRole === 'host' ? 'blue' : 'red';
    const localPieces = localOwner === 'blue' ? bluePieces : redPieces;
    const enemyPieces = localOwner === 'blue' ? redPieces : bluePieces;
    if (mode === 'custom') {
        applyNamesToPieces(localPieces, localCustomNamesById);
        applyNamesToPieces(enemyPieces, remoteCustomNamesById);
    }

    const boardView = new BoardView(getResponsiveCellSize());
    boardView.setPerspective(localOwner);
    const hudView = new HudView(getResponsiveCellSize());
    activeBoardView = boardView;
    activeHudView = hudView;

    gameController = new Controller({
        board,
        boardView,
        hudView,
        localPieces,
        enemyPieces,
        localOwner,
        isHost: localRole === 'host',
        peerClient,
        mode,
        onGameOver: () => {
            const confirmBtn = document.getElementById('confirm-setup-btn');
            if (confirmBtn) confirmBtn.disabled = true;
            showRematchButton();
        },
    });
    gameController.init();
    gameController.clearExternalStatusMessage();
    applyResponsiveSizing();
    showRematchButton();
    setLegendVisibility(mode);
    renderLegend();
    while (pendingMessages.length > 0) {
        gameController.handleNetworkMessage(pendingMessages.shift());
    }
}

function startTestingGame() {
    const board = new Board(BOARD_ROWS, BOARD_COLUMNS, WATER_COORDS);
    const { bluePieces, redPieces } = createAllPieces();
    const localOwner = 'blue';
    const localPieces = bluePieces;
    const enemyPieces = redPieces;
    const enemyFormationPieces = buildEnemyPiecesForTesting(enemyPieces);
    board.placeEnemyFormation(enemyFormationPieces, TEST_ENEMY_FORMATION);

    const boardView = new BoardView(getResponsiveCellSize());
    boardView.setPerspective(localOwner);
    const hudView = new HudView(getResponsiveCellSize());
    activeBoardView = boardView;
    activeHudView = hudView;
    const localPeerStub = {
        send: () => true,
        isConnected: () => false,
    };

    if (gameController) {
        gameController.destroy();
        gameController = null;
    }

    gameController = new Controller({
        board,
        boardView,
        hudView,
        localPieces,
        enemyPieces,
        localOwner,
        isHost: true,
        peerClient: localPeerStub,
        testingMode: true,
        mode: 'normal',
        onGameOver: () => {
            const confirmBtn = document.getElementById('confirm-setup-btn');
            if (confirmBtn) confirmBtn.disabled = true;
        },
    });
    gameController.init();
    applyResponsiveSizing();
    setLegendVisibility('normal');
    renderLegend();
    showRematchButton();
}

function initCustomNameScreen() {
    const confirmButton = document.getElementById('confirm-custom-names-btn');
    if (!confirmButton) return;

    confirmButton.addEventListener('click', () => {
        const { isValid, namesById } = collectCustomNamesFromForm();
        if (!isValid) return;

        localCustomNamesById = namesById;
        customNamesSubmitted = true;

        if (peerClient && peerClient.isConnected()) {
            peerClient.send(MESSAGE_TYPES.CUSTOM_NAMES_SUBMITTED, {
                owner: getLocalOwner(),
                namesById: localCustomNamesById,
            });
            setCustomNameStatus('Namen gespeichert. Starte Aufstellung...', 'text-green-300');
            showScreen('game-screen');
            startOnlineGame('custom');
            return;
        }

        showScreen('game-screen');
        startTestingGame();
    });
}

function initConnectionScreen() {
    const createBtn = document.getElementById('create-session-btn');
    const joinBtn = document.getElementById('join-session-btn');
    const startBtn = document.getElementById('start-online-match-btn');
    const disconnectBtn = document.getElementById('disconnect-session-btn');
    const abortBtn = document.getElementById('abort-match-btn');
    const rematchBtn = document.getElementById('rematch-btn');
    const sessionInput = document.getElementById('session-key-input');

    createBtn?.addEventListener('click', () => {
        localRole = 'host';
        enableStartButton(false);
        if (peerClient) peerClient.destroy();
        peerClient = createPeerClient();
        peerClient.createSession();
        setConnectionStatus('Status: Session wird erstellt...', 'text-yellow-300');
    });

    joinBtn?.addEventListener('click', () => {
        const remoteKey = sessionInput?.value.trim();
        if (!remoteKey) {
            setConnectionStatus('Status: Bitte Session-Key eingeben.', 'text-red-300');
            return;
        }
        localRole = 'guest';
        enableStartButton(false);
        if (peerClient) peerClient.destroy();
        peerClient = createPeerClient();
        peerClient.joinSession(remoteKey);
        setConnectionStatus('Status: Verbinde mit Host...', 'text-yellow-300');
    });

    startBtn?.addEventListener('click', () => {
        if (!peerClient || !peerClient.isConnected()) return;
        if (selectedMode === 'custom') {
            openCustomNameScreen();
            return;
        }
        showScreen('game-screen');
        startOnlineGame(selectedMode);
    });

    disconnectBtn?.addEventListener('click', () => {
        disconnectSession('Verbindung manuell getrennt');
    });

    abortBtn?.addEventListener('click', () => {
        disconnectSession('Spiel abgebrochen');
    });

    rematchBtn?.addEventListener('click', () => {
        if (!peerClient || !peerClient.isConnected()) return;
        if (!gameController) return;
        if (rematchLocalReady) return;

        rematchLocalReady = true;
        updateRematchButtonWaiting();
        gameController.setExternalStatusMessage('Neustart angefragt. Warte auf Gegner...', 'text-yellow-300 font-semibold');
        peerClient.send(MESSAGE_TYPES.REMATCH_REQUEST, {});

        if (localRole === 'host' && rematchRemoteReady) {
            peerClient.send(MESSAGE_TYPES.REMATCH_MODE_SELECT_OPEN, {});
            transitionToConnectedModeSelect();
        }
    });
}

function initModeSelection() {
    const normalBtn = document.getElementById('mode-normal-btn');
    const customBtn = document.getElementById('mode-custom-btn');
    const testingBtn = document.getElementById('mode-testing-btn');
    normalBtn?.addEventListener('click', () => {
        const isConnected = Boolean(peerClient && peerClient.isConnected());
        if (!isConnected) {
            selectedMode = 'normal';
            showScreen('connection-screen');
            return;
        }
        if (localRole !== 'host') return;

        selectedMode = 'normal';
        peerClient.send(MESSAGE_TYPES.MODE_SELECTED, { mode: selectedMode });
        showScreen('game-screen');
        startOnlineGame(selectedMode);
    });
    customBtn?.addEventListener('click', () => {
        const isConnected = Boolean(peerClient && peerClient.isConnected());
        if (!isConnected) {
            selectedMode = 'custom';
            showScreen('connection-screen');
            return;
        }
        if (localRole !== 'host') return;

        selectedMode = 'custom';
        peerClient.send(MESSAGE_TYPES.MODE_SELECTED, { mode: selectedMode });
        openCustomNameScreen();
    });
    testingBtn?.addEventListener('click', () => {
        localRole = null;
        selectedMode = 'normal';
        if (peerClient) {
            peerClient.destroy();
            peerClient = null;
        }
        resetCustomNameState();
        showScreen('game-screen');
        startTestingGame();
    });
}

showScreen('mode-screen');
initModeSelection();
initConnectionScreen();
initCustomNameScreen();
initLegendToggle();
setModeSelectionState();

window.addEventListener('beforeunload', () => {
    if (peerClient) {
        peerClient.destroy();
    }
});

window.addEventListener('resize', () => {
    applyResponsiveSizing();
});
