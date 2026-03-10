import { Piece } from './Piece.js';

export class Board {
    constructor(rows = 10, columns = 10, waterCoords = []) {
        this.rows = rows;
        this.columns = columns;
        this.waterCoords = waterCoords;
        this.grid = Array.from({ length: rows }, () => Array(columns).fill(null));
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

    initializePieces() {
        // Die neutralen Seen in der Mitte platzieren
        this.waterCoords.forEach(([row, col], index) => {
            this.setPiece(row, col, new Piece(`water-${index}`, 'Water', -1, 'neutral'));
        });

        // Test-Figuren für den Anfang (Spieler Rot)
        this.setPiece(0, 0, new Piece('red-flag', 'Flag', 0, 'red'));
        this.setPiece(1, 1, new Piece('red-miner-1', 'Miner', 3, 'red'));
        
        // Test-Figuren für den Anfang (Spieler Blau)
        this.setPiece(this.rows - 1, this.columns - 1, new Piece('blue-spy', 'Spy', 1, 'blue'));
        this.setPiece(this.rows - 2, this.columns - 2, new Piece('blue-marshal', 'Marshal', 8, 'blue'));
    }
}