// Minimal ECS exports to unblock server startup
// Full ECS implementation has build errors that need separate resolution
export class World {
    constructor(capacity = 1000) {
        this.entities = new Set();
        this.aliveEntities = new Set();
        this.nextId = 1;
        this.capacity = capacity;
        // Initialize component stores
        this.transforms = {
            has: (id) => this.aliveEntities.has(id),
            x: {},
            y: {},
            rot: {},
            sx: {},
            sy: {},
            zIndex: {}
        };
        this.appearance = {
            has: (id) => this.aliveEntities.has(id),
            sprite: {},
            tintR: {},
            tintG: {},
            tintB: {},
            alpha: {},
            frame: {}
        };
        this.movement = {
            has: (id) => this.aliveEntities.has(id),
            vx: {},
            vy: {},
            speed: {},
            targetX: {},
            targetY: {}
        };
    }
    create() {
        const id = this.nextId++;
        this.entities.add(id);
        this.aliveEntities.add(id);
        return id;
    }
    createEntity() {
        return this.create();
    }
    removeEntity(id) {
        this.entities.delete(id);
        this.aliveEntities.delete(id);
    }
    destroyEntity(id) {
        this.removeEntity(id);
    }
    hasEntity(id) {
        return this.entities.has(id);
    }
    isAlive(id) {
        return this.aliveEntities.has(id);
    }
    getEntities() {
        return Array.from(this.entities);
    }
    update(deltaTime) {
        // Stub implementation for world update
    }
}
export class NetworkSyncSystem {
    constructor() {
        this.seq = 0;
        this.last = new Map();
    }
    update(world) {
        const next = new Map();
        const created = [];
        const updated = [];
        const removed = [];
        // Collect current state for all alive entities that have transforms
        for (let id = 0; id < world.capacity; id++) {
            if (!world.isAlive(id)) {
                continue;
            }
            if (!world.transforms.has(id)) {
                continue;
            }
            const state = {
                id,
                x: world.transforms.x[id] ?? 0,
                y: world.transforms.y[id] ?? 0,
                rot: world.transforms.rot[id] ?? 0,
                sx: world.transforms.sx[id] ?? 1,
                sy: world.transforms.sy[id] ?? 1,
                zIndex: world.transforms.zIndex[id] ?? 0
            };
            next.set(id, state);
            const prev = this.last.get(id);
            if (!prev) {
                created.push(state);
            }
            else if (JSON.stringify(prev) !== JSON.stringify(state)) {
                updated.push(state);
            }
        }
        // Compute removals
        for (const id of this.last.keys()) {
            if (!next.has(id)) {
                removed.push(id);
            }
        }
        const baseSeq = this.seq;
        this.seq = baseSeq + 1;
        this.last = next;
        return { seq: this.seq, baseSeq, created, updated, removed };
    }
    getSnapshot() {
        return { seq: this.seq, entities: Array.from(this.last.values()) };
    }
}
export function MovementSystem(world, deltaTime) {
    // Process movement for all entities with movement components
    for (const id of world.getEntities()) {
        if (!world.movement.has(id)) {
            continue;
        }
        if (!world.transforms.has(id)) {
            continue;
        }
        const vx = world.movement.vx[id] ?? 0;
        const vy = world.movement.vy[id] ?? 0;
        if (vx !== 0 || vy !== 0) {
            world.transforms.x[id] = (world.transforms.x[id] ?? 0) + vx * deltaTime;
            world.transforms.y[id] = (world.transforms.y[id] ?? 0) + vy * deltaTime;
        }
    }
}
//# sourceMappingURL=index-minimal.js.map