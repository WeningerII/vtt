export class Transform2DStore {
    constructor(capacity) {
        this.capacity = capacity;
        this.present = new Uint8Array(capacity);
        this.x = new Float32Array(capacity);
        this.y = new Float32Array(capacity);
        this.rot = new Float32Array(capacity);
        this.sx = new Float32Array(capacity).fill(1);
        this.sy = new Float32Array(capacity).fill(1);
        this.zIndex = new Int16Array(capacity);
    }
    add(id, t) {
        this.present[id] = 1;
        if (t?.x !== undefined)
            this.x[id] = t.x;
        if (t?.y !== undefined)
            this.y[id] = t.y;
        if (t?.rot !== undefined)
            this.rot[id] = t.rot;
        if (t?.sx !== undefined)
            this.sx[id] = t.sx;
        if (t?.sy !== undefined)
            this.sy[id] = t.sy;
        if (t?.zIndex !== undefined)
            this.zIndex[id] = t.zIndex | 0;
    }
    remove(id) {
        this.present[id] = 0;
    }
    has(id) {
        return this.present[id] === 1;
    }
    get(id) {
        if (!this.has(id))
            return null;
        return {
            x: this.x[id] || 0,
            y: this.y[id] || 0,
            rot: this.rot[id] || 0,
            sx: this.sx[id] || 1,
            sy: this.sy[id] || 1,
            zIndex: this.zIndex[id] || 0
        };
    }
}
//# sourceMappingURL=Transform2D.js.map