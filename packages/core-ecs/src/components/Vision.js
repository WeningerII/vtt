export class VisionStore {
    constructor(capacity) {
        this.data = new Map();
        this.capacity = capacity;
    }
    add(id, data = {}) {
        this.data.set(id, {
            sightRange: data.sightRange ?? 6, // 30 feet in 5ft squares
            darkvisionRange: data.darkvisionRange ?? 0,
            blindsightRange: data.blindsightRange ?? 0,
            truesightRange: data.truesightRange ?? 0,
            canSeeThroughWalls: data.canSeeThroughWalls ?? false,
            canSeeInvisible: data.canSeeInvisible ?? false,
            canSeeEthereal: data.canSeeEthereal ?? false,
            lightSensitivity: data.lightSensitivity ?? 1,
            fogOfWarEnabled: data.fogOfWarEnabled ?? true,
            revealedAreas: data.revealedAreas ?? new Set(),
            currentVisibleAreas: data.currentVisibleAreas ?? new Set(),
            // Entity visibility state properties
            isInvisible: data.isInvisible ?? false,
            isEthereal: data.isEthereal ?? false,
            // Advanced visibility conditions
            isBlinded: data.isBlinded ?? false,
            hasDevilsSight: data.hasDevilsSight ?? false,
            hasMagicalDarkness: data.hasMagicalDarkness ?? false,
            // Condition immunities
            immuneToBlindness: data.immuneToBlindness ?? false,
            immuneToInvisibilityDetection: data.immuneToInvisibilityDetection ?? false,
        });
    }
    get(id) {
        return this.data.get(id);
    }
    has(id) {
        return this.data.has(id);
    }
    remove(id) {
        this.data.delete(id);
    }
    setSightRange(id, range) {
        const vision = this.data.get(id);
        if (vision) {
            vision.sightRange = Math.max(0, range);
        }
    }
    setDarkvision(id, range) {
        const vision = this.data.get(id);
        if (vision) {
            vision.darkvisionRange = Math.max(0, range);
        }
    }
    setBlindsight(id, range) {
        const vision = this.data.get(id);
        if (vision) {
            vision.blindsightRange = Math.max(0, range);
        }
    }
    setTruesight(id, range) {
        const vision = this.data.get(id);
        if (vision) {
            vision.truesightRange = Math.max(0, range);
        }
    }
    revealArea(id, gridCoord) {
        const vision = this.data.get(id);
        if (vision && vision.fogOfWarEnabled) {
            vision.revealedAreas.add(gridCoord);
        }
    }
    setVisibleAreas(id, areas) {
        const vision = this.data.get(id);
        if (vision) {
            vision.currentVisibleAreas = new Set(areas);
            // Add to revealed areas if fog of war is enabled
            if (vision.fogOfWarEnabled) {
                areas.forEach((area) => vision.revealedAreas.add(area));
            }
        }
    }
    isAreaRevealed(id, gridCoord) {
        const vision = this.data.get(id);
        return vision ? vision.revealedAreas.has(gridCoord) : false;
    }
    isAreaVisible(id, gridCoord) {
        const vision = this.data.get(id);
        return vision ? vision.currentVisibleAreas.has(gridCoord) : false;
    }
    canSeeEntity(observerId, targetId, distance, lightLevel, targetVision) {
        const observerVision = this.data.get(observerId);
        if (!observerVision || (observerVision.isBlinded && !observerVision.immuneToBlindness)) {
            return false;
        }
        // Get target vision data if not provided
        const targetData = targetVision || this.data.get(targetId);
        // Check target invisibility
        if (targetData?.isInvisible) {
            // Can only see invisible with truesight, blindsight, or special ability
            if (distance <= observerVision.truesightRange) {
                return true;
            }
            if (distance <= observerVision.blindsightRange) {
                return true;
            }
            if (observerVision.canSeeInvisible && !targetData.immuneToInvisibilityDetection) {
                return true;
            }
            return false;
        }
        // Check ethereal plane
        if (targetData?.isEthereal) {
            // Only truesight can see ethereal creatures
            return distance <= observerVision.truesightRange;
        }
        // Check if blinded by light sensitivity
        if (lightLevel > observerVision.lightSensitivity && !observerVision.immuneToBlindness) {
            return false;
        }
        // Truesight sees everything within range
        if (distance <= observerVision.truesightRange) {
            return true;
        }
        // Blindsight doesn't need light
        if (distance <= observerVision.blindsightRange) {
            return true;
        }
        // Devil's sight penetrates magical darkness
        if (observerVision.hasDevilsSight && observerVision.hasMagicalDarkness) {
            return distance <= observerVision.sightRange;
        }
        // Normal sight in adequate light
        if (lightLevel >= 0.5 && distance <= observerVision.sightRange) {
            return true;
        }
        // Darkvision in dim light or darkness  
        if (lightLevel < 0.5 && distance <= observerVision.darkvisionRange) {
            return true;
        }
        return false;
    }
    clearFogOfWar(id) {
        const vision = this.data.get(id);
        if (vision) {
            vision.revealedAreas.clear();
            vision.currentVisibleAreas.clear();
        }
    }
}
//# sourceMappingURL=Vision.js.map