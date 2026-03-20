export class Piece {
    constructor(id, type, rank, owner, alive = false) {
        this.id = id;
        this.type = type;
        this.displayType = type;
        this.rank = rank;
        this.owner = owner;
        this.alive = alive;
        this.revealed = false;
    }

    canMove() {
        return this.type !== 'Flagge' && this.type !== 'Bombe';
    }
}