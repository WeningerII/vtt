import { World, EntityId } from "../World";
import { VisionStore, VisionData } from "../components/Vision";
import { LightingStore } from "../components/Lighting";

export interface GridCell {
  x: number;
  y: number;
  blocked: boolean;
  lightLevel: number;
}

export class VisionSystem {
  private world: World;
  private vision: VisionStore;
  private lighting: LightingStore;
  private gridSize: number = 5; // 5 feet per grid square
  private mapWidth: number = 100;
  private mapHeight: number = 100;
  private obstacles: Set<string> = new Set(); // Grid coordinates that block vision

  constructor(world: World, vision: VisionStore, lighting: LightingStore) {
    this.world = world;
    this.vision = vision;
    this.lighting = lighting;
  }

  setMapDimensions(width: number, height: number): void {
    this.mapWidth = width;
    this.mapHeight = height;
  }

  addObstacle(x: number, y: number): void {
    this.obstacles.add(`${x},${y}`);
  }

  removeObstacle(x: number, y: number): void {
    this.obstacles.delete(`${x},${y}`);
  }

  isObstacle(x: number, y: number): boolean {
    return this.obstacles.has(`${x},${y}`);
  }

  calculateVisibility(entityId: EntityId, x: number, y: number): void {
    const visionData = this.vision.get(entityId);
    if (!visionData) return;

    const visibleCells = new Set<string>();

    // Calculate line of sight using ray casting
    const maxRange = Math.max(
      visionData.sightRange,
      visionData.darkvisionRange,
      visionData.blindsightRange,
      visionData.truesightRange,
    );

    // Cast rays in all directions
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 180) {
      // 1 degree steps
      this.castRay(x, y, angle, maxRange, visionData, visibleCells);
    }

    // Update vision data
    this.vision.setVisibleAreas(entityId, visibleCells);
  }

  private castRay(
    startX: number,
    startY: number,
    angle: number,
    maxRange: number,
    visionData: VisionData,
    visibleCells: Set<string>,
  ): void {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);

    for (let step = 0; step <= maxRange; step += 0.5) {
      const x = Math.floor(startX + dx * step);
      const y = Math.floor(startY + dy * step);

      // Check bounds
      if (x < 0 || x >= this.mapWidth || y < 0 || y >= this.mapHeight) {
        break;
      }

      const cellKey = `${x},${y}`;
      const lightLevel = this.lighting.calculateLightLevel(x, y);
      const distance = Math.sqrt((x - startX) ** 2 + (y - startY) ** 2);

      // Check if this cell can be seen based on vision type
      if (this.canSeeCell(visionData, distance, lightLevel)) {
        visibleCells.add(cellKey);
      }

      // Stop if we hit an obstacle (unless we have truesight or can see through walls)
      if (this.isObstacle(x, y)) {
        if (!visionData.canSeeThroughWalls && distance > visionData.truesightRange) {
          break;
        }
      }
    }
  }

  private canSeeCell(visionData: VisionData, distance: number, lightLevel: number): boolean {
    // Truesight sees everything within range
    if (distance <= visionData.truesightRange) {
      return true;
    }

    // Blindsight doesn't need light
    if (distance <= visionData.blindsightRange) {
      return true;
    }

    // Check light sensitivity
    if (lightLevel > visionData.lightSensitivity) {
      return false; // Blinded by bright light
    }

    // Normal sight in bright light
    if (lightLevel >= 0.5 && distance <= visionData.sightRange) {
      return true;
    }

    // Darkvision in dim light or darkness
    if (lightLevel < 0.5 && distance <= visionData.darkvisionRange) {
      return true;
    }

    return false;
  }

  getVisibleEntities(observerId: EntityId): EntityId[] {
    const observerVision = this.vision.get(observerId);
    if (!observerVision) return [];

    const visibleEntities: EntityId[] = [];
    const observerTransform = this.world.transforms.get(observerId);
    if (!observerTransform) return [];

    // Check all other entities
    for (const entityId of this.world.getEntities()) {
      if (entityId === observerId) continue;

      const targetTransform = this.world.transforms.get(entityId);
      if (!targetTransform) continue;

      const distance = Math.sqrt(
        (targetTransform.x - observerTransform.x) ** 2 +
          (targetTransform.y - observerTransform.y) ** 2,
      );

      const targetGridX = Math.floor(targetTransform.x / this.gridSize);
      const targetGridY = Math.floor(targetTransform.y / this.gridSize);
      const cellKey = `${targetGridX},${targetGridY}`;

      // Check if the target's cell is visible
      if (observerVision.currentVisibleAreas.has(cellKey)) {
        const lightLevel = this.lighting.calculateLightLevel(targetGridX, targetGridY);

        // Additional checks for invisible creatures, etc.
        if (this.canSeeEntity(observerId, entityId, distance, lightLevel)) {
          visibleEntities.push(entityId);
        }
      }
    }

    return visibleEntities;
  }

  private canSeeEntity(
    observerId: EntityId,
    targetId: EntityId,
    distance: number,
    lightLevel: number,
  ): boolean {
    const visionData = this.vision.get(observerId);
    if (!visionData) return false;

    // Use the enhanced canSeeEntity method from VisionStore
    const targetVision = this.vision.get(targetId);
    return this.vision.canSeeEntity(observerId, targetId, distance, lightLevel, targetVision);
  }

  // Line of sight check between two points
  hasLineOfSight(x1: number, y1: number, x2: number, y2: number): boolean {
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;

    let x = x1;
    let y = y1;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      // Check if current cell blocks vision
      if (this.isObstacle(x, y)) {
        return false;
      }

      // Reached target
      if (x === x2 && y === y2) {
        return true;
      }

      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
  }

  // Update all vision calculations
  update(_deltaTime: number): void {
    for (const entityId of this.world.getEntities()) {
      if (!this.vision.has(entityId)) continue;

      const transform = this.world.transforms.get(entityId);
      if (!transform) continue;

      const gridX = Math.floor(transform.x / this.gridSize);
      const gridY = Math.floor(transform.y / this.gridSize);

      this.calculateVisibility(entityId, gridX, gridY);
    }
  }

  // Fog of war management
  revealArea(entityId: EntityId, centerX: number, centerY: number, radius: number): void {
    const visionData = this.vision.get(entityId);
    if (!visionData || !visionData.fogOfWarEnabled) return;

    for (let x = centerX - radius; x <= centerX + radius; x++) {
      for (let y = centerY - radius; y <= centerY + radius; y++) {
        const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        if (distance <= radius) {
          this.vision.revealArea(entityId, `${x},${y}`);
        }
      }
    }
  }

  clearAllFogOfWar(): void {
    for (const entityId of this.world.getEntities()) {
      if (this.vision.has(entityId)) {
        this.vision.clearFogOfWar(entityId);
      }
    }
  }
}
