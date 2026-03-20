import { MESSAGE_TYPES } from '../network/protocol.js';

export class Controller {
    constructor({
        board,
        boardView,
        hudView,
        localPieces,
        enemyPieces,
        localOwner,
        isHost,
        peerClient,
        testingMode = false,
        onGameOver,
    }) {
        this.board = board;
        this.boardView = boardView;
        this.hudView = hudView;
        this.localPieces = localPieces;
        this.enemyPieces = enemyPieces;
        this.localOwner = localOwner;
        this.enemyOwner = localOwner === 'blue' ? 'red' : 'blue';
        this.isHost = isHost;
        this.peerClient = peerClient;
        this.testingMode = testingMode;
        this.onGameOver = onGameOver;

        this.pieceById = new Map([...localPieces, ...enemyPieces].map(piece => [piece.id, piece]));
        this.GAME_STATES = { SETUP: 'setup', PLAY: 'play', END: 'end' };
        this.gameState = this.GAME_STATES.SETUP;
        this.currentPlayer = 'blue';
        this.myTurn = false;

        this.selectedBoardCell = null;
        this.selectedSetupRank = null;
        this.validMoves = [];
        this.temporarilyRevealedIds = new Set();
        this.endgameRevealedIds = new Set();
        this.revealTimeoutId = null;
        this.lastCombatMessage = null;
        this.externalStatusMessage = null;
        this.externalStatusClassName = 'text-yellow-300 font-semibold';
        this.setupSubmitted = false;
        this.remoteSetupConfirmed = false;
        this.remoteSetupReceived = false;
        this.confirmButton = document.getElementById('confirm-setup-btn');
        this.boardContainer = document.getElementById('game-board');
        this.playerHudContainer = document.getElementById('player-hud');
        this.boundBoardClickHandler = null;
        this.boundHudClickHandler = null;
        this.boundConfirmClickHandler = null;
    }

    init() {
        this.setupEventListeners();
        this.updateConfirmButtonState();
        this.updateTurnState();
        this.render();
        this.updateStatusText();
    }

    handleNetworkMessage(message) {
        if (this.testingMode) return;
        switch (message.type) {
            case MESSAGE_TYPES.SETUP_CONFIRMED:
                this.handleRemoteSetupConfirmed(message.payload);
                break;
            case MESSAGE_TYPES.SETUP_POSITIONS:
                this.handleRemoteSetupPositions(message.payload);
                break;
            case MESSAGE_TYPES.TURN_MOVE:
                this.handleTurnMoveMessage(message.payload);
                break;
            case MESSAGE_TYPES.COMBAT_RESULT:
                this.handleCombatResultMessage(message.payload);
                break;
            case MESSAGE_TYPES.GAME_OVER:
                this.handleRemoteGameOver(message.payload);
                break;
            case MESSAGE_TYPES.REVEAL_REQUEST:
                this.handleRevealRequest(message.payload);
                break;
            default:
                break;
        }
    }

    setupEventListeners() {
        this.boundBoardClickHandler = (event) => {
            const cell = event.target.closest('[data-row]');
            if (!cell) return;

            const row = parseInt(cell.dataset.row, 10);
            const col = parseInt(cell.dataset.col, 10);

            if (this.gameState === this.GAME_STATES.SETUP) {
                this.handleSetupBoardClick(row, col);
                return;
            }

            if (this.gameState === this.GAME_STATES.PLAY) {
                this.handlePlayBoardClick(row, col);
                return;
            }

            if (this.gameState === this.GAME_STATES.END) {
                this.handleEndBoardClick(row, col);
            }
        };
        this.boardContainer.addEventListener('click', this.boundBoardClickHandler);

        this.boundHudClickHandler = (event) => {
            if (this.gameState !== this.GAME_STATES.SETUP || this.setupSubmitted) return;

            const cell = event.target.closest('[data-rank]');
            if (!cell) return;
            const rank = parseInt(cell.dataset.rank, 10);
            const available = this.localPieces.filter(piece => piece.rank === rank && !piece.alive).length;
            if (available <= 0) return;
            this.selectedSetupRank = rank;
            this.render();
        };
        this.playerHudContainer.addEventListener('click', this.boundHudClickHandler);

        this.boundConfirmClickHandler = () => {
            if (this.gameState !== this.GAME_STATES.SETUP || this.setupSubmitted) return;
            if (!this.allLocalPiecesPlaced()) return;

            if (this.testingMode) {
                this.setupSubmitted = true;
                this.gameState = this.GAME_STATES.PLAY;
                this.selectedSetupRank = null;
                this.currentPlayer = 'blue';
                this.updateConfirmButtonState();
                this.updateTurnState();
                this.render();
                this.updateStatusText();
                return;
            }

            this.setupSubmitted = true;
            const positions = this.serializeSetupPositions(this.localPieces);
            this.peerClient.send(MESSAGE_TYPES.SETUP_CONFIRMED, { owner: this.localOwner });
            this.peerClient.send(MESSAGE_TYPES.SETUP_POSITIONS, { owner: this.localOwner, positions });
            this.updateConfirmButtonState();
            this.updateStatusText();
            this.tryStartPlay();
        };
        this.confirmButton.addEventListener('click', this.boundConfirmClickHandler);
    }

    updateTurnState() {
        this.myTurn = this.gameState === this.GAME_STATES.PLAY && this.currentPlayer === this.localOwner;
    }

    getVisibleRevealedIds() {
        return new Set([...this.temporarilyRevealedIds, ...this.endgameRevealedIds]);
    }

    render() {
        this.boardView.render(
            this.board,
            this.selectedBoardCell,
            this.validMoves,
            this.gameState,
            this.getVisibleRevealedIds(),
        );
        this.hudView.render({
            playerPieces: this.localPieces,
            enemyPieces: this.enemyPieces,
            gameState: this.gameState,
            selectedSetupRank: this.selectedSetupRank,
        });
    }

    updateConfirmButtonState() {
        const canConfirm = this.gameState === this.GAME_STATES.SETUP && !this.setupSubmitted && this.allLocalPiecesPlaced();
        this.confirmButton.disabled = !canConfirm;
    }

    allLocalPiecesPlaced() {
        return this.localPieces.every(piece => piece.alive);
    }

    getAvailablePieceByRank(rank) {
        return this.localPieces.find(piece => piece.rank === rank && !piece.alive) || null;
    }

    serializeSetupPositions(pieces) {
        const positions = [];
        pieces.forEach(piece => {
            const pos = this.board.getPiecePosition(piece.id);
            if (!pos) return;
            positions.push({ pieceId: piece.id, row: pos.row, col: pos.col });
        });
        return positions;
    }

    handleSetupBoardClick(row, col) {
        const clickedPiece = this.board.getPiece(row, col);

        if (clickedPiece && clickedPiece.owner === this.localOwner) {
            if (this.setupSubmitted) return;
            this.board.removePieceFromBoard(row, col, this.localOwner);
            this.updateConfirmButtonState();
            this.render();
            this.updateStatusText();
            return;
        }

        if (this.setupSubmitted) return;
        if (!this.board.isSetupRowForPlayer(row, this.localOwner)) return;
        if (this.selectedSetupRank === null) return;

        const piece = this.getAvailablePieceByRank(this.selectedSetupRank);
        if (!piece) return;
        const didPlace = this.board.placePiece(row, col, piece, this.localOwner);
        if (!didPlace) return;

        if (!this.getAvailablePieceByRank(this.selectedSetupRank)) {
            this.selectedSetupRank = null;
        }
        this.updateConfirmButtonState();
        this.render();
        this.updateStatusText();
    }

    handlePlayBoardClick(row, col) {
        if (!this.myTurn) return;
        const clickedPiece = this.board.getPiece(row, col);

        if (!this.selectedBoardCell) {
            if (clickedPiece && clickedPiece.owner === this.localOwner && clickedPiece.canMove()) {
                this.selectedBoardCell = { row, col };
                this.validMoves = this.board.getValidMoves(row, col, this.localOwner);
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

        if (clickedPiece && clickedPiece.owner === this.localOwner && clickedPiece.canMove()) {
            this.selectedBoardCell = { row, col };
            this.validMoves = this.board.getValidMoves(row, col, this.localOwner);
            this.render();
            return;
        }

        if (!this.board.isValidMove(startRow, startCol, row, col, this.localOwner)) return;

        const movingPiece = this.board.getPiece(startRow, startCol);
        if (!movingPiece) return;

        if (!this.isHost) {
            this.peerClient.send(MESSAGE_TYPES.TURN_MOVE, {
                phase: 'request',
                pieceId: movingPiece.id,
                from: { row: startRow, col: startCol },
                to: { row, col },
            });
            this.clearSelection();
            this.myTurn = false;
            this.render();
            this.updateStatusText();
            return;
        }

        this.applyLocalHostTurn(movingPiece.id, startRow, startCol, row, col);
    }

    applyLocalHostTurn(pieceId, fromRow, fromCol, toRow, toCol) {
        const result = this.board.moveOrAttack(fromRow, fromCol, toRow, toCol, this.currentPlayer);
        if (!result.success) return;

        const resolvedTurn = {
            phase: 'resolved',
            pieceId,
            from: { row: fromRow, col: fromCol },
            to: { row: toRow, col: toCol },
            action: result.action,
            combatOutcome: result.action === 'combat' ? this.getCombatOutcome(result, pieceId, toRow, toCol) : null,
            defenderId: this.getDefenderId(result, toRow, toCol),
            gameOver: Boolean(result.gameOver),
            winner: result.gameOver ? result.winner : null,
            nextPlayer: this.currentPlayer === 'blue' ? 'red' : 'blue',
        };

        if (result.action === 'combat' && result.combatPieces) {
            this.revealCombatTemporarily(result.combatPieces);
            const [attacker, defender] = result.combatPieces;
            this.peerClient.send(MESSAGE_TYPES.COMBAT_RESULT, {
                attackerId: attacker.id,
                defenderId: defender.id,
                message: `Kampf: ${attacker.type} (${attacker.rank}) gegen ${defender.type} (${defender.rank})`,
            });
        }

        this.peerClient.send(MESSAGE_TYPES.TURN_MOVE, resolvedTurn);
        this.finishTurnFromResolved(resolvedTurn);
    }

    getDefenderId(result, toRow, toCol) {
        if (result.action !== 'combat') return null;
        if (result.combatPieces && result.combatPieces[1]) return result.combatPieces[1].id;
        const piece = this.board.getPiece(toRow, toCol);
        return piece ? piece.id : null;
    }

    getCombatOutcome(result, pieceId, toRow, toCol) {
        if (result.bothRemoved) return 'bothDie';
        const pieceAtTarget = this.board.getPiece(toRow, toCol);
        if (pieceAtTarget && pieceAtTarget.id === pieceId) return 'attackerWins';
        return 'defenderWins';
    }

    finishTurnFromResolved(resolvedTurn) {
        this.clearSelection();
        this.currentPlayer = resolvedTurn.nextPlayer;
        this.updateTurnState();

        if (resolvedTurn.gameOver) {
            this.enterEndState(resolvedTurn.winner);
            this.peerClient.send(MESSAGE_TYPES.GAME_OVER, { winner: resolvedTurn.winner });
            return;
        }

        this.render();
        this.updateStatusText();
    }

    handleTurnMoveMessage(payload) {
        if (!payload || typeof payload !== 'object') return;

        if (payload.phase === 'request' && this.isHost) {
            if (this.gameState !== this.GAME_STATES.PLAY) return;
            if (this.currentPlayer !== this.enemyOwner) return;
            const piece = this.board.getPiece(payload.from.row, payload.from.col);
            if (!piece || piece.owner !== this.enemyOwner || piece.id !== payload.pieceId) return;
            this.applyLocalHostTurn(payload.pieceId, payload.from.row, payload.from.col, payload.to.row, payload.to.col);
            return;
        }

        if (payload.phase === 'resolved' && !this.isHost) {
            this.board.applyResolvedTurn(payload, this.pieceById);
            this.clearSelection();
            this.currentPlayer = payload.nextPlayer;
            this.updateTurnState();
            if (payload.gameOver) {
                this.enterEndState(payload.winner);
                return;
            }
            this.render();
            this.updateStatusText();
        }
    }

    handleCombatResultMessage(payload) {
        if (!payload) return;
        const attacker = this.pieceById.get(payload.attackerId);
        const defender = this.pieceById.get(payload.defenderId);
        if (!attacker || !defender) return;
        this.lastCombatMessage = payload.message || this.lastCombatMessage;
        this.revealCombatTemporarily([attacker, defender], false);
    }

    handleRemoteSetupConfirmed(payload) {
        if (!payload || payload.owner !== this.enemyOwner) return;
        this.remoteSetupConfirmed = true;
        this.tryStartPlay();
        this.updateStatusText();
    }

    handleRemoteSetupPositions(payload) {
        if (!payload || payload.owner !== this.enemyOwner || !Array.isArray(payload.positions)) return;
        this.board.clearOwnerPieces(this.enemyOwner);
        this.board.applySetupPositions(this.pieceById, payload.positions);
        this.remoteSetupReceived = true;
        this.tryStartPlay();
        this.render();
    }

    tryStartPlay() {
        if (!this.setupSubmitted || !this.remoteSetupConfirmed || !this.remoteSetupReceived) return;
        this.gameState = this.GAME_STATES.PLAY;
        this.selectedSetupRank = null;
        this.currentPlayer = 'blue';
        this.updateConfirmButtonState();
        this.updateTurnState();
        this.render();
        this.updateStatusText();
    }

    handleRemoteGameOver(payload) {
        if (!payload) return;
        this.enterEndState(payload.winner);
    }

    enterEndState(winner) {
        if (this.revealTimeoutId) {
            clearTimeout(this.revealTimeoutId);
            this.revealTimeoutId = null;
        }
        this.temporarilyRevealedIds.clear();
        this.gameState = this.GAME_STATES.END;
        this.currentPlayer = null;
        this.updateTurnState();
        this.clearSelection();
        this.render();
        this.updateStatusText(winner);
        if (this.onGameOver) this.onGameOver(winner);
    }

    handleEndBoardClick(row, col) {
        const piece = this.board.getPiece(row, col);
        if (!piece || !piece.alive || piece.owner !== this.enemyOwner) return;
        this.endgameRevealedIds.add(piece.id);
        this.render();
        this.peerClient.send(MESSAGE_TYPES.REVEAL_REQUEST, { pieceId: piece.id });
    }

    handleRevealRequest(payload) {
        if (!payload || typeof payload.pieceId !== 'number') return;
        this.endgameRevealedIds.add(payload.pieceId);
        this.render();
    }

    clearSelection() {
        this.selectedBoardCell = null;
        this.validMoves = [];
    }

    setExternalStatusMessage(message, className = 'text-yellow-300 font-semibold') {
        this.externalStatusMessage = message;
        this.externalStatusClassName = className;
        this.updateStatusText();
    }

    clearExternalStatusMessage() {
        this.externalStatusMessage = null;
        this.updateStatusText();
    }

    updateStatusText(winner = null) {
        const statusEl = document.getElementById('status-text');
        if (!statusEl) return;

        if (this.externalStatusMessage && this.gameState !== this.GAME_STATES.END) {
            statusEl.textContent = this.externalStatusMessage;
            statusEl.className = this.externalStatusClassName;
            return;
        }

        if (this.gameState === this.GAME_STATES.SETUP) {
            if (this.setupSubmitted) {
                statusEl.textContent = this.testingMode
                    ? 'Testing: Aufstellung bestätigt.'
                    : 'Aufstellung gesendet. Warte auf den Gegner...';
                statusEl.className = 'text-yellow-300 font-semibold';
                return;
            }
            const missingCount = this.localPieces.filter(piece => !piece.alive).length;
            statusEl.textContent = missingCount === 0
                ? 'Aufstellung fertig. Jetzt bestätigen.'
                : `Setup: Platziere noch ${missingCount} Figur(en) in deinen 4 Reihen.`;
            statusEl.className = 'text-yellow-300 font-semibold';
            return;
        }

        if (this.gameState === this.GAME_STATES.END) {
            statusEl.textContent = winner === this.localOwner
                ? 'Spielende: Du hast die gegnerische Flagge geschlagen!'
                : 'Spielende: Deine Flagge wurde geschlagen.';
            statusEl.className = winner === this.localOwner
                ? 'text-green-400 font-bold'
                : 'text-red-400 font-bold';
            return;
        }

        if (this.lastCombatMessage) {
            statusEl.textContent = this.lastCombatMessage;
            statusEl.className = 'text-orange-300 font-semibold';
            return;
        }

        statusEl.textContent = this.myTurn
            ? 'Du bist am Zug.'
            : 'Warte auf den gegnerischen Zug...';
        statusEl.className = this.myTurn ? 'text-blue-300 font-semibold' : 'text-gray-300 font-semibold';
    }

    revealCombatTemporarily(combatPieces, setMessage = true) {
        const [attacker, defender] = combatPieces;
        if (!attacker || !defender) return;

        if (this.revealTimeoutId) {
            clearTimeout(this.revealTimeoutId);
            this.revealTimeoutId = null;
        }

        this.temporarilyRevealedIds = new Set([attacker.id, defender.id]);
        if (setMessage) {
            this.lastCombatMessage = `Kampf: ${attacker.type} (${attacker.rank}) gegen ${defender.type} (${defender.rank})`;
        }
        this.render();
        this.updateStatusText();

        this.revealTimeoutId = setTimeout(() => {
            this.temporarilyRevealedIds.clear();
            this.render();
            this.updateStatusText();
            this.revealTimeoutId = null;
        }, 3000);
    }

    destroy() {
        if (this.revealTimeoutId) {
            clearTimeout(this.revealTimeoutId);
            this.revealTimeoutId = null;
        }
        if (this.boardContainer && this.boundBoardClickHandler) {
            this.boardContainer.removeEventListener('click', this.boundBoardClickHandler);
            this.boundBoardClickHandler = null;
        }
        if (this.playerHudContainer && this.boundHudClickHandler) {
            this.playerHudContainer.removeEventListener('click', this.boundHudClickHandler);
            this.boundHudClickHandler = null;
        }
        if (this.confirmButton && this.boundConfirmClickHandler) {
            this.confirmButton.removeEventListener('click', this.boundConfirmClickHandler);
            this.boundConfirmClickHandler = null;
        }
    }
}
