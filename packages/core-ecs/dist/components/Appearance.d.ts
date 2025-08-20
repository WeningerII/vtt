import type { EntityId } from './Transform2D';
export declare class AppearanceStore {
    readonly capacity: number;
    readonly present: Uint8Array;
    readonly sprite: Uint32Array;
    readonly tintR: Uint8Array;
    readonly tintG: Uint8Array;
    readonly tintB: Uint8Array;
    readonly alpha: Float32Array;
    readonly frame: Uint16Array;
    constructor(capacity: number);
    add(id: EntityId, a?: Partial<{
        sprite: number;
        tintR: number;
        tintG: number;
        tintB: number;
        alpha: number;
        frame: number;
    }>): void;
    remove(id: EntityId): void;
    has(id: EntityId): boolean;
}
//# sourceMappingURL=Appearance.d.ts.map