export class Piece {
    constructor(id, type, rank, owner, alive) {
        this.id = id;
        this.type = type;
        this.rank = rank;
        this.owner = owner;
        this.alive = alive;
    }
}