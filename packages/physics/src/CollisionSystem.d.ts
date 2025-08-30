import type { World } from "@vtt/core-ecs";
/**
 * Minimal AABB overlap checker using `World.transforms`.
 *
 * Assumptions:
 * - Transform2D (x, y) defines center position in world units.
 * - (sx, sy) act as full extents; we use half-extents = (max(0.5, sx/2), max(0.5, sy/2)).
 * - Only considers entities that are alive and have a transform.
 *
 * Behavior:
 * - Iterates naive O(n^2) and logs number of overlaps once per update.
 */
export declare class CollisionSystem {
    update(world: World): void;
}
//# sourceMappingURL=CollisionSystem.d.ts.map