import './style.css';
import { Board } from './model/Board.js';
import { BoardView } from './view/BoardView.js';
import { Controller } from './controller/Controller.js';
import { HudView } from './view/HudView.js';
import { Piece } from './model/Piece.js';

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

const RANK_TO_TYPE = new Map(NORMAL_PIECE_POOL.map(piece => [piece.rank, piece.type]));

const ENEMY_FORMATION = [
    { row: 0, col: 0, rank: 11 }, { row: 0, col: 1, rank: 10 }, { row: 0, col: 2, rank: 2 }, { row: 0, col: 3, rank: 9 },
    { row: 0, col: 4, rank: 3 }, { row: 0, col: 5, rank: 2 }, { row: 0, col: 6, rank: 3 }, { row: 0, col: 7, rank: 0 },
    { row: 1, col: 0, rank: 1 }, { row: 1, col: 1, rank: 11 },
];

function createNormalPieces(owner) {
    const pieces = [];
    let localId = 0;
    NORMAL_PIECE_POOL.forEach(entry => {
        for (let i = 0; i < entry.count; i++) {
            pieces.push(new Piece(`${owner}-${localId}`, entry.type, entry.rank, owner, false));
            localId++;
        }
    });
    return pieces;
}

function renderLegend() {
    const legendContent = document.getElementById('legend-content');
    if (!legendContent) return;
    legendContent.innerHTML = NORMAL_PIECE_POOL
        .map(entry => `<div class="flex justify-between gap-3"><span>${entry.type}</span><span>Wert ${entry.rank}</span></div>`)
        .join('');
}

function showScreen(screenId) {
    ['mode-screen', 'connection-screen', 'game-screen'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.toggle('hidden', id !== screenId);
    });
}

function buildEnemyPiecesForFormation() {
    const poolByRank = new Map();
    const allEnemyPieces = createNormalPieces('blue');

    allEnemyPieces.forEach(piece => {
        if (!poolByRank.has(piece.rank)) {
            poolByRank.set(piece.rank, []);
        }
        poolByRank.get(piece.rank).push(piece);
    });

    const formationPieces = ENEMY_FORMATION.map(entry => {
        const list = poolByRank.get(entry.rank) || [];
        const piece = list.shift();
        if (!piece) {
            return new Piece(`blue-fallback-${entry.row}-${entry.col}`, RANK_TO_TYPE.get(entry.rank), entry.rank, 'blue', false);
        }
        return piece;
    });

    const unplaced = [];
    poolByRank.forEach(list => unplaced.push(...list));
    return { formationPieces, allEnemyPieces: [...formationPieces, ...unplaced] };
}

function startNormalGame() {
    const board = new Board(BOARD_ROWS, BOARD_COLUMNS, WATER_COORDS);
    const playerPieces = createNormalPieces('red');
    const enemyBuild = buildEnemyPiecesForFormation();

    board.placeEnemyFormation(enemyBuild.formationPieces, ENEMY_FORMATION);

    const boardView = new BoardView(GRID_CELL_SIZE);
    boardView.setPerspective('red');
    const hudView = new HudView(GRID_CELL_SIZE);

    const controller = new Controller({
        board,
        boardView,
        hudView,
        playerPieces,
        enemyPieces: enemyBuild.allEnemyPieces,
        onGameOver: () => {
            const confirmBtn = document.getElementById('confirm-setup-btn');
            if (confirmBtn) confirmBtn.disabled = true;
        },
    });

    controller.init();
    renderLegend();
}

function initModeSelection() {
    const normalBtn = document.getElementById('mode-normal-btn');
    const startBtn = document.getElementById('start-local-match-btn');

    normalBtn?.addEventListener('click', () => {
        showScreen('connection-screen');
    });

    startBtn?.addEventListener('click', () => {
        showScreen('game-screen');
        startNormalGame();
    });
}

showScreen('mode-screen');
initModeSelection();