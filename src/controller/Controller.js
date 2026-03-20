export class Controller {
    constructor({
        board,
        boardView,
        hudView,
        playerPieces,
        enemyPieces,
        onGameOver,
    }) {
        this.board = board;
        this.boardView = boardView;
        this.hudView = hudView;
        this.playerPieces = playerPieces;
        this.enemyPieces = enemyPieces;
        this.onGameOver = onGameOver;

        this.GAME_STATES = { SETUP: 'setup', PLAY: 'play', END: 'end' };
        this.gameState = this.GAME_STATES.SETUP;
        this.currentPlayer = 'red';
        this.selectedBoardCell = null;
        this.selectedSetupRank = null;
        this.validMoves = [];
        this.temporarilyRevealedIds = new Set();
        this.revealTimeoutId = null;
        this.lastCombatMessage = null;
        this.confirmButton = document.getElementById('confirm-setup-btn');
    }

    init() {
        this.setupEventListeners();
        this.updateConfirmButtonState();
        this.render();
        this.updateStatusText();
    }

    setupEventListeners() {
        const boardContainer = document.getElementById('game-board');
        boardContainer.addEventListener('click', (event) => {
            const cell = event.target.closest('[data-row]');
            if (!cell) return;

            const row = parseInt(cell.dataset.row, 10);
            const col = parseInt(cell.dataset.col, 10);
            if (this.gameState === this.GAME_STATES.SETUP) {
                this.handleSetupBoardClick(row, col);
            } else if (this.gameState === this.GAME_STATES.PLAY) {
                this.handlePlayBoardClick(row, col);
            }
        });

        const playerHudContainer = document.getElementById('player-hud');
        playerHudContainer.addEventListener('click', (event) => {
            if (this.gameState !== this.GAME_STATES.SETUP) return;

            const cell = event.target.closest('[data-rank]');
            if (!cell) return;
            const rank = parseInt(cell.dataset.rank, 10);
            const available = this.playerPieces.filter(piece => piece.rank === rank && !piece.alive).length;
            if (available <= 0) return;
            this.selectedSetupRank = rank;
            this.render();
        });

        this.confirmButton.addEventListener('click', () => {
            if (this.gameState !== this.GAME_STATES.SETUP) return;
            if (!this.allPlayerPiecesPlaced()) return;

            this.gameState = this.GAME_STATES.PLAY;
            this.selectedBoardCell = null;
            this.selectedSetupRank = null;
            this.validMoves = [];
            this.updateConfirmButtonState();
            this.render();
            this.updateStatusText();
        });
    }

    render() {
        this.boardView.render(
            this.board,
            this.selectedBoardCell,
            this.validMoves,
            this.gameState,
            this.temporarilyRevealedIds,
        );
        this.hudView.render({
            playerPieces: this.playerPieces,
            enemyPieces: this.enemyPieces,
            gameState: this.gameState,
            selectedSetupRank: this.selectedSetupRank,
        });
    }

    updateConfirmButtonState() {
        const canConfirm = this.gameState === this.GAME_STATES.SETUP && this.allPlayerPiecesPlaced();
        this.confirmButton.disabled = !canConfirm;
    }

    allPlayerPiecesPlaced() {
        return this.playerPieces.every(piece => piece.alive);
    }

    getAvailablePieceByRank(rank) {
        return this.playerPieces.find(piece => piece.rank === rank && !piece.alive) || null;
    }

    handleSetupBoardClick(row, col) {
        const clickedPiece = this.board.getPiece(row, col);

        if (clickedPiece && clickedPiece.owner === 'red') {
            this.board.removePieceFromBoard(row, col, 'red');
            this.updateConfirmButtonState();
            this.render();
            this.updateStatusText();
            return;
        }

        if (!this.board.isSetupRowForPlayer(row, 'red')) return;
        if (this.selectedSetupRank === null) return;

        const piece = this.getAvailablePieceByRank(this.selectedSetupRank);
        if (!piece) return;
        const didPlace = this.board.placePiece(row, col, piece, 'red');
        if (!didPlace) return;

        if (!this.getAvailablePieceByRank(this.selectedSetupRank)) {
            this.selectedSetupRank = null;
        }
        this.updateConfirmButtonState();
        this.render();
        this.updateStatusText();
    }

    handlePlayBoardClick(row, col) {
        const clickedPiece = this.board.getPiece(row, col);

        if (!this.selectedBoardCell) {
            if (clickedPiece && clickedPiece.owner === this.currentPlayer && clickedPiece.canMove()) {
                this.selectedBoardCell = { row, col };
                this.validMoves = this.board.getValidMoves(row, col, this.currentPlayer);
                this.render();
            }
            return;
        }

        const startRow = this.selectedBoardCell.row;
        const startCol = this.selectedBoardCell.col;

        if (startRow === row && startCol === col) {
            this.clearSelection();
            this.render();
            return;
        }

        if (clickedPiece && clickedPiece.owner === this.currentPlayer && clickedPiece.canMove()) {
            this.selectedBoardCell = { row, col };
            this.validMoves = this.board.getValidMoves(row, col, this.currentPlayer);
            this.render();
            return;
        }

        const result = this.board.moveOrAttack(startRow, startCol, row, col, this.currentPlayer);
        if (!result.success) return;

        if (result.action === 'combat' && result.combatPieces) {
            this.revealCombatTemporarily(result.combatPieces);
        }

        if (result.gameOver) {
            if (this.revealTimeoutId) {
                clearTimeout(this.revealTimeoutId);
                this.revealTimeoutId = null;
            }
            this.temporarilyRevealedIds.clear();
            this.transientStatusMessage = null;
            this.gameState = this.GAME_STATES.END;
            this.clearSelection();
            this.render();
            this.updateStatusText(result.winner);
            if (this.onGameOver) {
                this.onGameOver(result.winner);
            }
            return;
        }

        this.clearSelection();
        this.render();
        this.updateStatusText();
    }

    clearSelection() {
        this.selectedBoardCell = null;
        this.validMoves = [];
    }

    updateStatusText(winner = null) {
        const statusEl = document.getElementById('status-text');
        if (!statusEl) return;

        if (this.gameState === this.GAME_STATES.SETUP) {
            const missingCount = this.playerPieces.filter(piece => !piece.alive).length;
            statusEl.textContent = missingCount === 0
                ? 'Aufstellung fertig. Jetzt bestätigen.'
                : `Setup: Platziere noch ${missingCount} Figur(en) in den unteren 4 Reihen.`;
            statusEl.className = 'text-yellow-300 font-semibold';
            return;
        }

        if (this.gameState === this.GAME_STATES.END) {
            statusEl.textContent = winner === 'red'
                ? 'Spielende: Du hast die gegnerische Flagge geschlagen!'
                : 'Spielende: Deine Flagge wurde geschlagen.';
            statusEl.className = winner === 'red'
                ? 'text-green-400 font-bold'
                : 'text-red-400 font-bold';
            return;
        }

        if (this.lastCombatMessage) {
            statusEl.textContent = this.lastCombatMessage;
            statusEl.className = 'text-orange-300 font-semibold';
            return;
        }

        statusEl.textContent = 'Spiel läuft: Wähle eine eigene Figur und ziehe.';
        statusEl.className = 'text-blue-300 font-semibold';
    }

    revealCombatTemporarily(combatPieces) {
        const [attacker, defender] = combatPieces;
        if (!attacker || !defender) return;

        if (this.revealTimeoutId) {
            clearTimeout(this.revealTimeoutId);
            this.revealTimeoutId = null;
        }

        this.temporarilyRevealedIds = new Set([attacker.id, defender.id]);
        this.lastCombatMessage = `Kampf: ${attacker.type} (${attacker.rank}) gegen ${defender.type} (${defender.rank})`;
        this.render();
        this.updateStatusText();

        this.revealTimeoutId = setTimeout(() => {
            this.temporarilyRevealedIds.clear();
            this.render();
            this.updateStatusText();
            this.revealTimeoutId = null;
        }, 3000);
    }
}