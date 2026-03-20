export class BoardView {
    constructor(cellSize = 56) {
        this.boardContainer = document.getElementById('game-board');
        this.cellSize = cellSize;
        this.perspective = 'red';
    }

    setPerspective(owner) {
        this.perspective = owner;
    }

    toModelCoords(displayRow, displayCol, board) {
        if (this.perspective === 'red') {
            return { row: displayRow, col: displayCol };
        }
        return {
            row: board.rows - 1 - displayRow,
            col: board.columns - 1 - displayCol,
        };
    }

    render(board, selectedCell = null, validMoves = [], gameState = 'setup', temporarilyRevealedIds = new Set()) {
        this.boardContainer.innerHTML = '';

        this.boardContainer.style.gridTemplateRows = `repeat(${board.rows}, minmax(0, 1fr))`;
        this.boardContainer.style.gridTemplateColumns = `repeat(${board.columns}, minmax(0, 1fr))`;
        this.boardContainer.style.width = `${board.columns * this.cellSize}px`;
        this.boardContainer.style.height = `${board.rows * this.cellSize}px`;

        const validMoveKeySet = new Set(validMoves.map(move => `${move.row},${move.col}`));
        const selectedKey = selectedCell ? `${selectedCell.row},${selectedCell.col}` : null;

        for (let displayRow = 0; displayRow < board.rows; displayRow++) {
            for (let displayCol = 0; displayCol < board.columns; displayCol++) {
                const { row, col } = this.toModelCoords(displayRow, displayCol, board);
                const piece = board.getPiece(row, col);
                const isWater = board.isWaterPosition(row, col);
                const isSelected = selectedKey === `${row},${col}`;
                const isValidMove = validMoveKeySet.has(`${row},${col}`);
                const cellElement = this.createCell(row, col, piece, isSelected, isValidMove, gameState, temporarilyRevealedIds, isWater);
                this.boardContainer.appendChild(cellElement);
            }
        }
    }

    createCell(row, col, piece, isSelected, isValidMove, gameState, temporarilyRevealedIds, isWater) {
        const cell = document.createElement('div');
        cell.className = 'w-full h-full border border-gray-700 flex items-center justify-center cursor-pointer bg-gray-800';
        
        cell.dataset.row = row;
        cell.dataset.col = col;

        if (isWater) {
            cell.classList.remove('bg-gray-800');
            cell.classList.add('bg-cyan-900', 'cursor-not-allowed');
            cell.textContent = 'W';
        } else if (isValidMove) {
            cell.classList.add('bg-green-900');
        }

        if (!isWater && piece && piece.alive) {
            const pieceElement = this.createPiece(piece, gameState, temporarilyRevealedIds, isSelected);
            cell.appendChild(pieceElement);
        }

        return cell;
    }

    createPiece(piece, gameState, temporarilyRevealedIds, isSelected) {
        const pieceElement = document.createElement('div');
        
        pieceElement.className = 'w-11/12 h-11/12 rounded-sm flex items-center justify-center text-[10px] md:text-xs font-semibold shadow-md select-none px-1 text-center leading-tight';
        const isEnemyPiece = piece.owner !== this.perspective;
        const isTemporarilyRevealed = temporarilyRevealedIds.has(piece.id);
        const shouldHide = isEnemyPiece && !isTemporarilyRevealed;

        if (piece.owner === 'red') {
            pieceElement.classList.add('bg-red-600', 'text-white');
            pieceElement.textContent = shouldHide ? '?' : piece.type;
            
        } else if (piece.owner === 'blue') {
            pieceElement.classList.add('bg-blue-600', 'text-white');
            pieceElement.textContent = shouldHide ? '?' : piece.type;
        }

        if (isSelected) {
            pieceElement.classList.remove('text-white');
            pieceElement.classList.add('text-yellow-300');
        }

        return pieceElement;
    }
}