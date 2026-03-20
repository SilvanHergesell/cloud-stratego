export class HudView {
    constructor(cellSize = 56) {
        this.playerHudContainer = document.getElementById('player-hud');
        this.enemyHudContainer = document.getElementById('enemy-hud');
        this.cellSize = cellSize;
        this.rankOrder = [10, 9, 3, 2, 1, 11, 0];
    }

    setCellSize(cellSize) {
        this.cellSize = cellSize;
    }

    countByRank(pieces, predicate) {
        const map = new Map();
        pieces.filter(predicate).forEach(piece => {
            map.set(piece.rank, (map.get(piece.rank) || 0) + 1);
        });
        return map;
    }

    getPieceTypeByRank(pieces, rank) {
        const found = pieces.find(piece => piece.rank === rank);
        return found ? found.type : `Rang ${rank}`;
    }

    render({
        playerPieces,
        enemyPieces,
        gameState,
        selectedSetupRank,
    }) {
        const isSetup = gameState === 'setup';
        const playerCountMap = this.countByRank(playerPieces, piece => !piece.alive);
        const enemyCountMap = this.countByRank(enemyPieces, piece => !piece.alive);
        const columnCount = this.rankOrder.length;

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

        this.rankOrder.forEach((rank) => {
            const playerType = this.getPieceTypeByRank(playerPieces, rank);
            const enemyType = this.getPieceTypeByRank(enemyPieces, rank);
            const playerCount = playerCountMap.get(rank) || 0;
            const enemyCount = enemyCountMap.get(rank) || 0;

            this.playerHudContainer.appendChild(
                this.createCell({
                    type: playerType,
                    rank,
                    count: playerCount,
                    selectable: isSetup,
                    selected: selectedSetupRank === rank,
                }),
            );
            this.enemyHudContainer.appendChild(
                this.createCell({
                    type: enemyType,
                    rank,
                    count: enemyCount,
                    selectable: false,
                    selected: false,
                }),
            );
        });
    }

    createCell({ type, rank, count, selectable, selected }) {
        const cell = document.createElement('div');
        cell.className = 'w-full h-full border border-gray-700 flex flex-col items-center justify-center px-1 text-[10px] leading-tight';

        if (selectable) {
            cell.classList.add('cursor-pointer', 'hover:bg-gray-700');
            cell.dataset.rank = String(rank);
        } else {
            cell.classList.add('cursor-default');
        }
        if (selected) {
            cell.classList.add('ring-2', 'ring-yellow-400', 'bg-gray-700');
        }

        cell.dataset.type = type;
        cell.dataset.count = count;
        cell.innerHTML = `<span class="font-semibold">${type}</span><span>x${count}</span>`;

        return cell;
    }
}