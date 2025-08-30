import type { EntityId } from "./Transform2D";
export declare class MovementStore {
  readonly capacity: number;
  readonly present: Uint8Array;
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  readonly maxSpeed: Float32Array;
  constructor(capacity: number);
  add(
    id: EntityId,
    m?: Partial<{
      vx: number;
      vy: number;
      maxSpeed: number;
    }>,
  ): void;
  remove(id: EntityId): void;
  has(id: EntityId): boolean;
}
//# sourceMappingURL=Movement.d.ts.map
