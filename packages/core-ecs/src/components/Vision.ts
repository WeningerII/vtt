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
      currentVisibleAreas: data.currentVisibleAreas ?? new Set()
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
        areas.forEach(area => vision.revealedAreas.add(area));
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

  canSeeEntity(observerId: EntityId, targetId: EntityId, distance: number, lightLevel: number): boolean {
    const vision = this.data.get(observerId);
    if (!vision) return false;

    // Check if blinded by light sensitivity
    if (lightLevel > vision.lightSensitivity) return false;

    // Truesight sees everything
    if (distance <= vision.truesightRange) return true;

    // Blindsight doesn't need light
    if (distance <= vision.blindsightRange) return true;

    // Normal sight and darkvision
    let effectiveRange = vision.sightRange;
    if (lightLevel < 0.5) { // Dim light or darkness
      effectiveRange = Math.max(effectiveRange, vision.darkvisionRange);
    }

    return distance <= effectiveRange;
  }

  clearFogOfWar(id: EntityId): void {
    const vision = this.data.get(id);
    if (vision) {
      vision.revealedAreas.clear();
      vision.currentVisibleAreas.clear();
    }
  }
}
