export class View {
    constructor() {
        this.boardContainer = document.getElementById('game-board');
    }

    render(board) {
        this.boardContainer.innerHTML = '';
        this.boardContainer.style.gridTemplateRows = `repeat(${board.rows}, minmax(0, 1fr))`;
        this.boardContainer.style.gridTemplateColumns = `repeat(${board.columns}, minmax(0, 1fr))`;

        for (let row = 0; row < board.rows; row++) {
            for (let col = 0; col < board.columns; col++) {
                const piece = board.getPiece(row, col);
                const cellElement = this.createCell(row, col, piece);
                this.boardContainer.appendChild(cellElement);
            }
        }
    }

    createCell(row, col, piece) {
        const cell = document.createElement('div');
        cell.className = 'w-full h-full border border-gray-700 flex items-center justify-center cursor-pointer';
        
        cell.dataset.row = row;
        cell.dataset.col = col;

        if (piece) {
            const pieceElement = this.createPiece(piece);
            cell.appendChild(pieceElement);
        }

        return cell;
    }

    createPiece(piece) {
        const pieceElement = document.createElement('div');
        
        pieceElement.className = 'w-4/5 h-4/5 rounded-sm flex items-center justify-center text-xs md:text-sm font-bold shadow-md select-none';

        if (piece.owner === 'red') {
            pieceElement.classList.add('bg-red-600', 'text-white');
            pieceElement.textContent = piece.type.substring(0, 2); // z.B. "Mi" für Miner
            
        } else if (piece.owner === 'blue') {
            pieceElement.classList.add('bg-blue-600', 'text-white');
            pieceElement.textContent = piece.type.substring(0, 2); // z.B. "Sp" für Spy
            
        } else if (piece.owner === 'neutral') { // Das Wasser in der Mitte
            pieceElement.className = 'w-full h-full bg-cyan-700 flex items-center justify-center text-cyan-300 text-xs select-none';
            pieceElement.textContent = '≈≈';
        }

        return pieceElement;
    }
}