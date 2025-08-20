export type EntityId = number;
export declare class Transform2DStore {
    readonly capacity: number;
    readonly present: Uint8Array;
    readonly x: Float32Array;
    readonly y: Float32Array;
    readonly rot: Float32Array;
    readonly sx: Float32Array;
    readonly sy: Float32Array;
    readonly zIndex: Int16Array;
    constructor(capacity: number);
    add(id: EntityId, t?: Partial<{
        x: number;
        y: number;
        rot: number;
        sx: number;
        sy: number;
        zIndex: number;
    }>): void;
    remove(id: EntityId): void;
    has(id: EntityId): boolean;
}
//# sourceMappingURL=Transform2D.d.ts.map