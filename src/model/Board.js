export class Board {
    constructor(rows = 8, columns = 8, waterCoords = []) {
        this.rows = rows;
        this.columns = columns;
        this.waterCoords = waterCoords;
        this.waterKeySet = new Set(waterCoords.map(([row, col]) => `${row},${col}`));
        this.grid = Array.from({ length: rows }, () => Array(columns).fill(null));
    }

    isValidPosition(row, col) {
        return row >= 0 && row < this.rows && col >= 0 && col < this.columns;
    }

    getPiece(row, col) {
        if (!this.isValidPosition(row, col)) return null;
        return this.grid[row][col];
    }

    isWaterPosition(row, col) {
        return this.waterKeySet.has(`${row},${col}`);
    }

    setPiece(row, col, piece) {
        if (this.isValidPosition(row, col)) {
            this.grid[row][col] = piece;
        }
    }

    clearPosition(row, col) {
        if (this.isValidPosition(row, col)) {
            this.grid[row][col] = null;
        }
    }

    isSetupRowForPlayer(row, owner) {
        if (owner === 'red') {
            return row >= this.rows - 4 && row < this.rows;
        }
        return row >= 0 && row < 4;
    }

    placePiece(row, col, piece, owner) {
        if (!piece || piece.owner !== owner || !this.isValidPosition(row, col)) {
            return false;
        }
        if (this.isWaterPosition(row, col)) return false;
        if (!this.isSetupRowForPlayer(row, owner)) return false;
        if (this.getPiece(row, col)) return false;

        this.setPiece(row, col, piece);
        piece.alive = true;
        return true;
    }

    removePieceFromBoard(row, col, owner) {
        const piece = this.getPiece(row, col);
        if (!piece || piece.owner !== owner) return null;

        this.clearPosition(row, col);
        piece.alive = false;
        return piece;
    }

    getPiecePosition(pieceId) {
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.columns; col++) {
                const piece = this.grid[row][col];
                if (piece && piece.id === pieceId) return { row, col };
            }
        }
        return null;
    }

    isClearPath(fromRow, fromCol, toRow, toCol) {
        const rowStep = Math.sign(toRow - fromRow);
        const colStep = Math.sign(toCol - fromCol);

        let row = fromRow + rowStep;
        let col = fromCol + colStep;
        while (row !== toRow || col !== toCol) {
            if (this.getPiece(row, col)) return false;
            row += rowStep;
            col += colStep;
        }
        return true;
    }

    getValidMoves(row, col, currentPlayer) {
        const piece = this.getPiece(row, col);
        if (!piece || !piece.alive || piece.owner !== currentPlayer || !piece.canMove()) {
            return [];
        }

        const moves = [];
        const directions = [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
        ];

        directions.forEach(([dRow, dCol]) => {
            if (piece.type === 'Scout') {
                let distance = 1;
                while (true) {
                    const targetRow = row + dRow * distance;
                    const targetCol = col + dCol * distance;
                    if (!this.isValidPosition(targetRow, targetCol)) break;

                    const targetPiece = this.getPiece(targetRow, targetCol);
                    if (this.isWaterPosition(targetRow, targetCol)) break;
                    if (!targetPiece) {
                        moves.push({ row: targetRow, col: targetCol });
                        distance++;
                        continue;
                    }

                    if (targetPiece.owner !== piece.owner) {
                        moves.push({ row: targetRow, col: targetCol });
                    }
                    break;
                }
            } else {
                const targetRow = row + dRow;
                const targetCol = col + dCol;
                if (!this.isValidPosition(targetRow, targetCol)) return;
                if (this.isWaterPosition(targetRow, targetCol)) return;

                const targetPiece = this.getPiece(targetRow, targetCol);
                if (!targetPiece || targetPiece.owner !== piece.owner) {
                    moves.push({ row: targetRow, col: targetCol });
                }
            }
        });

        return moves;
    }

    isValidMove(fromRow, fromCol, toRow, toCol, currentPlayer) {
        return this.getValidMoves(fromRow, fromCol, currentPlayer)
            .some(move => move.row === toRow && move.col === toCol);
    }

    resolveCombat(attacker, defender) {
        if (defender.type === 'Flagge') {
            return { outcome: 'attackerWins', winner: attacker.owner, reason: 'flagCaptured' };
        }

        if (defender.type === 'Bombe') {
            if (attacker.type === 'Minör') {
                return { outcome: 'attackerWins' };
            }
            return { outcome: 'defenderWins' };
        }

        if (attacker.type === 'Spion' && defender.rank === 10) {
            return { outcome: 'attackerWins' };
        }

        if (attacker.rank > defender.rank) return { outcome: 'attackerWins' };
        if (attacker.rank < defender.rank) return { outcome: 'defenderWins' };
        return { outcome: 'bothDie' };
    }

    moveOrAttack(fromRow, fromCol, toRow, toCol, currentPlayer) {
        if (!this.isValidPosition(fromRow, fromCol) || !this.isValidPosition(toRow, toCol)) {
            return { success: false, reason: 'invalidPosition' };
        }

        const movingPiece = this.getPiece(fromRow, fromCol);
        if (!movingPiece) return { success: false, reason: 'noPiece' };
        if (!movingPiece.alive) return { success: false, reason: 'pieceNotAlive' };
        if (movingPiece.owner !== currentPlayer) return { success: false, reason: 'notYourPiece' };
        if (!movingPiece.canMove()) return { success: false, reason: 'pieceCannotMove' };
        if (!this.isValidMove(fromRow, fromCol, toRow, toCol, currentPlayer)) return { success: false, reason: 'invalidMove' };

        const targetPiece = this.getPiece(toRow, toCol);
        if (!targetPiece) {
            this.setPiece(toRow, toCol, movingPiece);
            this.clearPosition(fromRow, fromCol);
            return { success: true, action: 'move' };
        }

        if (targetPiece.owner === movingPiece.owner) {
            return { success: false, reason: 'ownPieceBlocked' };
        }

        const combat = this.resolveCombat(movingPiece, targetPiece);
        if (combat.outcome === 'attackerWins') {
            targetPiece.alive = false;
            this.setPiece(toRow, toCol, movingPiece);
            this.clearPosition(fromRow, fromCol);
            return {
                success: true,
                action: 'combat',
                winner: movingPiece.owner,
                loserPiece: targetPiece,
                combatPieces: [movingPiece, targetPiece],
                gameOver: combat.reason === 'flagCaptured',
            };
        }

        if (combat.outcome === 'defenderWins') {
            movingPiece.alive = false;
            this.clearPosition(fromRow, fromCol);
            return {
                success: true,
                action: 'combat',
                winner: targetPiece.owner,
                loserPiece: movingPiece,
                combatPieces: [movingPiece, targetPiece],
                gameOver: false,
            };
        }

        movingPiece.alive = false;
        targetPiece.alive = false;
        this.clearPosition(fromRow, fromCol);
        this.clearPosition(toRow, toCol);
        return {
            success: true,
            action: 'combat',
            winner: null,
            loserPiece: null,
            combatPieces: [movingPiece, targetPiece],
            gameOver: false,
            bothRemoved: true,
        };
    }

    placeEnemyFormation(enemyPieces, formation) {
        formation.forEach((entry, index) => {
            const piece = enemyPieces[index];
            if (!piece) return;
            const { row, col } = entry;
            this.setPiece(row, col, piece);
            piece.alive = true;
        });
    }
}