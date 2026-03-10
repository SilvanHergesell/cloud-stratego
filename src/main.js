import './style.css';
import { Board } from './model/Board.js';
import { View } from './view/View.js';
import { Controller } from './controller/Controller.js';

const BOARD_ROWS = 8;
const BOARD_COLUMNS = 8;
const WATER_COORDS = [
    [3, 2], [4, 2], [3, 5], [4, 5]
];

const board = new Board(BOARD_ROWS, BOARD_COLUMNS, WATER_COORDS);
const view = new View();

const gameController = new Controller(board, view);
gameController.init();