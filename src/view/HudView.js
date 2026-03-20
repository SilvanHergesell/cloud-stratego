export class HudView {
    constructor(playerPieces, cellSize = 56) {
        this.playerHudContainer = document.getElementById('player-hud');
        this.enemyHudContainer = document.getElementById('enemy-hud');
        this.sortedIndexArray = [];
        this.cellSize = cellSize;

        this.sortedIndexArray = this.createSortedIndexArray(this.createHudMap(playerPieces));
    }

    createHudMap(pieces) {
        let hudMap = new Map();
        pieces.filter(piece => !piece.alive)
              .map(piece => {
                if (!hudMap.has(piece.rank)) {
                    hudMap.set(piece.rank, 1);
                    return;
                }
                hudMap.set(piece.rank, hudMap.get(piece.rank) + 1);
              });
        return hudMap;
    }

    createSortedIndexArray(hudMap) {
        let indexArray = [];
        hudMap.forEach((value, key) => {
            indexArray.push(key);
        });
        indexArray.sort((a, b) => b - a);
        return indexArray;
    }

    render(playerPieces, enemyPieces) {
        const playerHudMap = this.createHudMap(playerPieces);
        const enemyHudMap = this.createHudMap(enemyPieces);
        const allRanks = new Set([...playerHudMap.keys(), ...enemyHudMap.keys()]);
        this.sortedIndexArray = [...allRanks].sort((a, b) => b - a);

        const columnCount = Math.max(1, this.sortedIndexArray.length);

        this.playerHudContainer.innerHTML = '';
        this.playerHudContainer.style.gridTemplateRows = `repeat(1, minmax(0, 1fr))`;
        this.playerHudContainer.style.gridTemplateColumns = `repeat(${columnCount}, minmax(0, 1fr))`;
        this.playerHudContainer.style.width = `${columnCount * this.cellSize}px`;
        this.playerHudContainer.style.height = `${this.cellSize}px`;

        this.enemyHudContainer.innerHTML = '';
        this.enemyHudContainer.style.gridTemplateRows = `repeat(1, minmax(0, 1fr))`;
        this.enemyHudContainer.style.gridTemplateColumns = `repeat(${columnCount}, minmax(0, 1fr))`;
        this.enemyHudContainer.style.width = `${columnCount * this.cellSize}px`;
        this.enemyHudContainer.style.height = `${this.cellSize}px`;

        this.sortedIndexArray.forEach((rank, index) => {
            const playerCount = playerHudMap.get(rank) || 0;
            const enemyCount = enemyHudMap.get(rank) || 0;

            const playerType = playerPieces.find(piece => piece.rank === rank)?.type;
            const enemyType = enemyPieces.find(piece => piece.rank === rank)?.type;

            this.playerHudContainer.appendChild(this.createCell(index, playerType, playerCount));
            this.enemyHudContainer.appendChild(this.createCell(index, enemyType, enemyCount));
        });
    }

    createCell(col, type, count) {
        const cell = document.createElement('div');
        cell.className = 'w-full h-full border border-gray-700 flex items-center justify-center cursor-pointer';
        
        cell.dataset.col = col;
        cell.dataset.type = type;
        cell.dataset.count = count;
        cell.textContent = `Typ: ${type}, Anzahl: ${count}`;

        return cell;
    }
}