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
export class CollisionSystem {
    update(world) {
        const t = world.transforms;
        const alive = world.alive;
        let overlaps = 0;
        const n = alive.length; // iterate up to capacity; check presence flags
        for (let i = 0; i < n; i++) {
            if (alive[i] !== 1 || !t.has(i))
                continue;
            const xi = t.x[i] ?? 0;
            const yi = t.y[i] ?? 0;
            const sxi = t.sx[i] ?? 1;
            const syi = t.sy[i] ?? 1;
            const hxi = Math.max(0.5, sxi * 0.5);
            const hyi = Math.max(0.5, syi * 0.5);
            for (let j = i + 1; j < n; j++) {
                if (alive[j] !== 1 || !t.has(j))
                    continue;
                const xj = t.x[j] ?? 0;
                const yj = t.y[j] ?? 0;
                const sxj = t.sx[j] ?? 1;
                const syj = t.sy[j] ?? 1;
                const hxj = Math.max(0.5, sxj * 0.5);
                const hyj = Math.max(0.5, syj * 0.5);
                const dx = Math.abs(xi - xj);
                const dy = Math.abs(yi - yj);
                if (dx <= hxi + hxj && dy <= hyi + hyj) {
                    overlaps++;
                }
            }
        }
        if (overlaps > 0) {
            // Keep logging minimal to avoid spam; still provides functional behavior
            // to verify collisions are detected in simulation.
            // eslint-disable-next-line no-console
            console.log(`[physics] overlaps: ${overlaps}`);
        }
    }
}
//# sourceMappingURL=CollisionSystem.js.map