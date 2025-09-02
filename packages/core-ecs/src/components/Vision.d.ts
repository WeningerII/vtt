export type EntityId = number;
export interface VisionData {
    sightRange: number;
    darkvisionRange: number;
    blindsightRange: number;
    truesightRange: number;
    canSeeThroughWalls: boolean;
    canSeeInvisible: boolean;
    canSeeEthereal: boolean;
    lightSensitivity: number;
    fogOfWarEnabled: boolean;
    revealedAreas: Set<string>;
    currentVisibleAreas: Set<string>;
    isInvisible: boolean;
    isEthereal: boolean;
    isBlinded: boolean;
    hasDevilsSight: boolean;
    hasMagicalDarkness: boolean;
    immuneToBlindness: boolean;
    immuneToInvisibilityDetection: boolean;
}
export declare class VisionStore {
    private data;
    private capacity;
    constructor(capacity: number);
    add(id: EntityId, data?: Partial<VisionData>): void;
    get(id: EntityId): VisionData | undefined;
    has(id: EntityId): boolean;
    remove(id: EntityId): void;
    setSightRange(id: EntityId, range: number): void;
    setDarkvision(id: EntityId, range: number): void;
    setBlindsight(id: EntityId, range: number): void;
    setTruesight(id: EntityId, range: number): void;
    revealArea(id: EntityId, gridCoord: string): void;
    setVisibleAreas(id: EntityId, areas: Set<string>): void;
    isAreaRevealed(id: EntityId, gridCoord: string): boolean;
    isAreaVisible(id: EntityId, gridCoord: string): boolean;
    canSeeEntity(observerId: EntityId, targetId: EntityId, distance: number, lightLevel: number, targetVision?: VisionData): boolean;
    clearFogOfWar(id: EntityId): void;
}
//# sourceMappingURL=Vision.d.ts.map