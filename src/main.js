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
const GRID_CELL_SIZE = 56;
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

let peerClient = null;
let localRole = null; // host | guest
let gameController = null;
const pendingMessages = [];
let isDisconnecting = false;
let rematchLocalReady = false;
let rematchRemoteReady = false;

function showScreen(screenId) {
    ['mode-screen', 'connection-screen', 'game-screen'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.toggle('hidden', id !== screenId);
    });
}

function renderLegend() {
    const legendContent = document.getElementById('legend-content');
    if (!legendContent) return;
    legendContent.innerHTML = NORMAL_PIECE_POOL
        .map(entry => `<div class="flex justify-between gap-3"><span>${entry.type}</span><span>Wert ${entry.rank}</span></div>`)
        .join('');
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

function createAllPieces() {
    const bluePieces = createPiecesForOwner('blue', 0);
    const redPieces = createPiecesForOwner('red', bluePieces.length);
    return { bluePieces, redPieces };
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
    showScreen('connection-screen');
    resetSessionUi();
    resetRematchState();
    setConnectionStatus(`Status: ${reason}`, 'text-red-300');
    isDisconnecting = false;
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
                if (localRole === 'host' && rematchLocalReady) {
                    peerClient?.send(MESSAGE_TYPES.REMATCH_START, {});
                    startOnlineGame();
                }
                return;
            }
            if (message.type === MESSAGE_TYPES.REMATCH_START) {
                startOnlineGame();
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

function startOnlineGame() {
    if (!peerClient || !peerClient.isConnected()) return;
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

    const boardView = new BoardView(GRID_CELL_SIZE);
    boardView.setPerspective(localOwner);
    const hudView = new HudView(GRID_CELL_SIZE);

    gameController = new Controller({
        board,
        boardView,
        hudView,
        localPieces,
        enemyPieces,
        localOwner,
        isHost: localRole === 'host',
        peerClient,
        onGameOver: () => {
            const confirmBtn = document.getElementById('confirm-setup-btn');
            if (confirmBtn) confirmBtn.disabled = true;
            showRematchButton();
        },
    });
    gameController.init();
    showRematchButton();
    renderLegend();
    while (pendingMessages.length > 0) {
        gameController.handleNetworkMessage(pendingMessages.shift());
    }
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
        showScreen('game-screen');
        startOnlineGame();
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
        peerClient.send(MESSAGE_TYPES.REMATCH_REQUEST, {});

        if (localRole === 'host' && rematchRemoteReady) {
            peerClient.send(MESSAGE_TYPES.REMATCH_START, {});
            startOnlineGame();
        }
    });
}

function initModeSelection() {
    const normalBtn = document.getElementById('mode-normal-btn');
    normalBtn?.addEventListener('click', () => {
        showScreen('connection-screen');
    });
}

showScreen('mode-screen');
initModeSelection();
initConnectionScreen();
initLegendToggle();

window.addEventListener('beforeunload', () => {
    if (peerClient) {
        peerClient.destroy();
    }
});
