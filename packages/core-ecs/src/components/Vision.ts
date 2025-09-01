export type EntityId = number;

export interface VisionData {
  sightRange: number; // in grid units
  darkvisionRange: number;
  blindsightRange: number;
  truesightRange: number;
  canSeeThroughWalls: boolean;
  canSeeInvisible: boolean;
  canSeeEthereal: boolean;
  lightSensitivity: number; // 0-1, 1 = normal, 0 = blind in bright light
  fogOfWarEnabled: boolean;
  revealedAreas: Set<string>; // grid coordinates that have been revealed
  currentVisibleAreas: Set<string>; // currently visible areas
  
  // Entity visibility state properties
  isInvisible: boolean;
  isEthereal: boolean;
  
  // Advanced visibility conditions
  isBlinded: boolean;
  hasDevilsSight: boolean;
  hasMagicalDarkness: boolean;
  
  // Condition immunities
  immuneToBlindness: boolean;
  immuneToInvisibilityDetection: boolean;
}

export class VisionStore {
  private data: Map<EntityId, VisionData> = new Map();
  private capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
  }

  add(id: EntityId, data: Partial<VisionData> = {}): void {
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

  get(id: EntityId): VisionData | undefined {
    return this.data.get(id);
  }

  has(id: EntityId): boolean {
    return this.data.has(id);
  }

  remove(id: EntityId): void {
    this.data.delete(id);
  }

  setSightRange(id: EntityId, range: number): void {
    const vision = this.data.get(id);
    if (vision) {
      vision.sightRange = Math.max(0, range);
    }
  }

  setDarkvision(id: EntityId, range: number): void {
    const vision = this.data.get(id);
    if (vision) {
      vision.darkvisionRange = Math.max(0, range);
    }
  }

  setBlindsight(id: EntityId, range: number): void {
    const vision = this.data.get(id);
    if (vision) {
      vision.blindsightRange = Math.max(0, range);
    }
  }

  setTruesight(id: EntityId, range: number): void {
    const vision = this.data.get(id);
    if (vision) {
      vision.truesightRange = Math.max(0, range);
    }
  }

  revealArea(id: EntityId, gridCoord: string): void {
    const vision = this.data.get(id);
    if (vision && vision.fogOfWarEnabled) {
      vision.revealedAreas.add(gridCoord);
    }
  }

  setVisibleAreas(id: EntityId, areas: Set<string>): void {
    const vision = this.data.get(id);
    if (vision) {
      vision.currentVisibleAreas = new Set(areas);
      // Add to revealed areas if fog of war is enabled
      if (vision.fogOfWarEnabled) {
        areas.forEach((area) => vision.revealedAreas.add(area));
      }
    }
  }

  isAreaRevealed(id: EntityId, gridCoord: string): boolean {
    const vision = this.data.get(id);
    return vision ? vision.revealedAreas.has(gridCoord) : false;
  }

  isAreaVisible(id: EntityId, gridCoord: string): boolean {
    const vision = this.data.get(id);
    return vision ? vision.currentVisibleAreas.has(gridCoord) : false;
  }

  canSeeEntity(
    observerId: EntityId,
    targetId: EntityId,
    distance: number,
    lightLevel: number,
    targetVision?: VisionData
  ): boolean {
    const observerVision = this.data.get(observerId);
    if (!observerVision || (observerVision.isBlinded && !observerVision.immuneToBlindness)) return false;

    // Get target vision data if not provided
    const targetData = targetVision || this.data.get(targetId);

    // Check target invisibility
    if (targetData?.isInvisible) {
      // Can only see invisible with truesight, blindsight, or special ability
      if (distance <= observerVision.truesightRange) return true;
      if (distance <= observerVision.blindsightRange) return true;
      if (observerVision.canSeeInvisible && !targetData.immuneToInvisibilityDetection) return true;
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
    if (distance <= observerVision.truesightRange) return true;

    // Blindsight doesn't need light
    if (distance <= observerVision.blindsightRange) return true;

    // Devil's sight penetrates magical darkness
    if (observerVision.hasDevilsSight && observerVision.hasMagicalDarkness) {
      return distance <= observerVision.sightRange;
    }

    // Normal sight in adequate light
    if (lightLevel >= 0.5 && distance <= observerVision.sightRange) return true;

    // Darkvision in dim light or darkness  
    if (lightLevel < 0.5 && distance <= observerVision.darkvisionRange) return true;

    return false;
  }

  clearFogOfWar(id: EntityId): void {
    const vision = this.data.get(id);
    if (vision) {
      vision.revealedAreas.clear();
      vision.currentVisibleAreas.clear();
    }
  }
}
