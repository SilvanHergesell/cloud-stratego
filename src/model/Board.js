import { Piece } from './Piece.js';

export class Board {
    constructor(rows = 10, columns = 10, waterCoords = []) {
        this.rows = rows;
        this.columns = columns;
        this.waterCoords = waterCoords;
        this.grid = Array.from({ length: rows }, () => Array(columns).fill(null));
        waterCoords.forEach(([row, col], index) => {
            this.setPiece(row, col, new Piece(`water-${index}`, 'Water', -1, 'neutral'));
        });
    }

    isValidPosition(row, col) {
        return row >= 0 && row < this.rows && col >= 0 && col < this.columns;
    }

    getPiece(row, col) {
        if (!this.isValidPosition(row, col)) return null;
        return this.grid[row][col];
    }

    setPiece(row, col, piece) {
        if (this.isValidPosition(row, col)) {
            this.grid[row][col] = piece;
        }
    }

    movePiece(fromRow, fromCol, toRow, toCol) {
        if (!this.isValidPosition(fromRow, fromCol) || !this.isValidPosition(toRow, toCol)) {
            console.error("Ungültige Koordinaten!");
            return false;
        }

        const pieceToMove = this.getPiece(fromRow, fromCol);
        if (!pieceToMove.alive) {return false;}
        
        if (!pieceToMove) {
            console.error("Auf dem Startfeld steht keine Figur!");
            return false;
        }

        const targetPiece = this.getPiece(toRow, toCol);

        if (targetPiece) {
            console.log(`${pieceToMove.type} greift ${targetPiece.type} an!`);
        }

        this.grid[toRow][toCol] = pieceToMove;
        this.grid[fromRow][fromCol] = null;

        return true;
    }

    initializePieces(pieces = []) {
        pieces.forEach((piece, index) => {
            const row = Math.floor(index / this.columns);
            const col = index % this.columns;

            if (row < this.rows) {
                this.setPiece(row, col, piece);
            }
        });
    }
}