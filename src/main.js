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
    [3, 2], [4, 2], [3, 5], [4, 5]
];

const playerPieces = [
    new Piece(0, 'flag', 0, 'red', false),
    new Piece(1, 'bomb', 11, 'red', false),
];

const enemyPieces = [
    new Piece(0, 'flag', 0, 'blue', false),
    new Piece(1, 'bomb', 11, 'blue', false),
];

const pieces = [
    ...playerPieces,
    ...enemyPieces,
];

const board = new Board(BOARD_ROWS, BOARD_COLUMNS, WATER_COORDS);
board.initializePieces(pieces);
const view = new BoardView(GRID_CELL_SIZE);
const hudView = new HudView(playerPieces, GRID_CELL_SIZE);
hudView.render(playerPieces, enemyPieces);

const gameController = new Controller(board, view);
gameController.init();