export class MovementStore {
    capacity;
    present;
    vx;
    vy;
    maxSpeed;
    constructor(capacity) {
        this.capacity = capacity;
        this.present = new Uint8Array(capacity);
        this.vx = new Float32Array(capacity);
        this.vy = new Float32Array(capacity);
        this.maxSpeed = new Float32Array(capacity).fill(Infinity);
    }
    add(id, m) {
        this.present[id] = 1;
        if (m?.vx !== undefined)
            this.vx[id] = m.vx;
        if (m?.vy !== undefined)
            this.vy[id] = m.vy;
        if (m?.maxSpeed !== undefined)
            this.maxSpeed[id] = m.maxSpeed;
    }
    remove(id) { this.present[id] = 0; }
    has(id) { return this.present[id] === 1; }
}
//# sourceMappingURL=Movement.js.map