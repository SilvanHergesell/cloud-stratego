export class Controller {
    constructor(board, view) {
        this.board = board;
        this.view = view;
        
        this.selectedCell = null;   // Merkt sich die Koordinaten {row, col} der angetippten Figur
        this.currentPlayer = 'red'; // Rot fängt an
    }

    init() {
        this.board.initializePieces();

        this.view.render(this.board);
        this.updateStatusText();

        this.setupEventListeners();
    }

    setupEventListeners() {
        const boardContainer = document.getElementById('game-board');

        // Event Delegation: Wir hören auf alle Klicks im Grid
        boardContainer.addEventListener('click', (event) => {
            // 1. Finde das angeklickte Feld anhand unseres Data-Attributes (data-row)
            const cell = event.target.closest('[data-row]');
            if (!cell) return; // Klick war auf den Rand, nicht auf ein Feld

            // 2. Koordinaten als Zahlen (Integer) auslesen
            const row = parseInt(cell.dataset.row, 10);
            const col = parseInt(cell.dataset.col, 10);

            // 3. Klick verarbeiten
            this.handleCellClick(row, col);
        });
    }

    handleCellClick(row, col) {
        const clickedPiece = this.board.getPiece(row, col);

        // --- Zustand 1: Es ist noch keine Figur ausgewählt ---
        if (!this.selectedCell) {
            // Man darf nur eigene Figuren auswählen
            if (clickedPiece && clickedPiece.owner === this.currentPlayer) {
                this.selectedCell = { row, col };
                console.log(`Ausgewählt: ${clickedPiece.type} auf ${row},${col}`);
                // Tipp: Hier könnten wir der View später sagen: "Mache dieses Feld gelb!"
            }
        } 
        // --- Zustand 2: Eine Figur ist bereits ausgewählt ---
        else {
            const startRow = this.selectedCell.row;
            const startCol = this.selectedCell.col;

            // Wenn man nochmal auf dieselbe Figur tippt -> Auswahl abbrechen
            if (startRow === row && startCol === col) {
                this.selectedCell = null;
                return;
            }

            // Wenn man auf eine andere EIGENE Figur tippt -> Neue Figur auswählen
            if (clickedPiece && clickedPiece.owner === this.currentPlayer) {
                this.selectedCell = { row, col };
                return;
            }

            // Wir versuchen, den Zug im Model durchzuführen
            const moveSuccessful = this.board.movePiece(startRow, startCol, row, col);

            if (moveSuccessful) {
                // Zug war legal! Auswahl aufheben, Spieler wechseln und neu zeichnen
                this.selectedCell = null;
                this.currentPlayer = this.currentPlayer === 'red' ? 'blue' : 'red';
                
                this.updateStatusText();
                this.view.render(this.board);
            } else {
                // Zug ungültig (z.B. ins Wasser gezogen). Auswahl bleibt bestehen.
                console.log("Ungültiger Zug!");
            }
        }
    }

    // Hilfsmethode, um den Text über dem Spielfeld zu ändern
    updateStatusText() {
        const statusEl = document.getElementById('status-text');
        if (statusEl) {
            statusEl.textContent = `Spieler ${this.currentPlayer === 'red' ? 'Rot' : 'Blau'} ist dran`;
            statusEl.className = this.currentPlayer === 'red' ? 'text-red-400 font-bold' : 'text-blue-400 font-bold';
        }
    }
}