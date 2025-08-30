export class AppearanceStore {
    constructor(capacity) {
        this.capacity = capacity;
        this.present = new Uint8Array(capacity);
        this.sprite = new Uint32Array(capacity);
        this.tintR = new Uint8Array(capacity);
        this.tintG = new Uint8Array(capacity);
        this.tintB = new Uint8Array(capacity);
        this.alpha = new Float32Array(capacity).fill(1);
        this.frame = new Uint16Array(capacity);
    }
    add(id, a) {
        this.present[id] = 1;
        if (a?.sprite !== undefined)
            this.sprite[id] = a.sprite;
        if (a?.tintR !== undefined)
            this.tintR[id] = a.tintR;
        if (a?.tintG !== undefined)
            this.tintG[id] = a.tintG;
        if (a?.tintB !== undefined)
            this.tintB[id] = a.tintB;
        if (a?.alpha !== undefined)
            this.alpha[id] = a.alpha;
        if (a?.frame !== undefined)
            this.frame[id] = a.frame;
    }
    remove(id) {
        this.present[id] = 0;
    }
    has(id) {
        return this.present[id] === 1;
    }
}
//# sourceMappingURL=Appearance.js.map