/**
 * Fog of War Management System
 * Handles vision, line of sight, and fog exploration for VTT scenes
 */

export interface FogSettings {
  enabled: boolean;
  exploredColor: string;
  unexploredColor: string;
  opacity: number;
  blurRadius: number;
  autoReveal: boolean;
  persistExplored: boolean;
}

export interface VisionSource {
  id: string;
  x: number;
  y: number;
  radius: number;
  dimRadius?: number;
  angle?: number;
  direction?: number;
  tokenId?: string;
}

export interface ExploredArea {
  id: string;
  points: Array<{ x: number; y: number }>;
  timestamp: number;
}

export interface LineOfSightResult {
  visible: boolean;
  blocked: boolean;
  blockingPoints: Array<{ x: number; y: number }>;
  distance: number;
}

export class FogOfWarManager {
  private settings: FogSettings;
  private visionSources: Map<string, VisionSource> = new Map();
  private exploredAreas: Map<string, ExploredArea> = new Map();
  private walls: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  private sceneWidth: number;
  private sceneHeight: number;

  constructor(settings: FogSettings, sceneWidth: number, sceneHeight: number) {
    this.settings = settings;
    this.sceneWidth = sceneWidth;
    this.sceneHeight = sceneHeight;
  }

  /**
   * Add a vision source (typically attached to a token)
   */
  addVisionSource(source: VisionSource): void {
    this.visionSources.set(source.id, source);
  }

  /**
   * Remove a vision source
   */
  removeVisionSource(sourceId: string): void {
    this.visionSources.delete(sourceId);
  }

  /**
   * Update a vision source
   */
  updateVisionSource(sourceId: string, updates: Partial<VisionSource>): void {
    const source = this.visionSources.get(sourceId);
    if (!source) {
      throw new Error(`Vision source ${sourceId} not found`);
    }

    this.visionSources.set(sourceId, { ...source, ...updates });
  }

  /**
   * Add wall segments for line of sight calculations
   */
  addWall(x1: number, y1: number, x2: number, y2: number): void {
    this.walls.push({ x1, y1, x2, y2 });
  }

  /**
   * Remove all walls
   */
  clearWalls(): void {
    this.walls = [];
  }

  /**
   * Calculate line of sight between two points
   */
  calculateLineOfSight(fromX: number, fromY: number, toX: number, toY: number): LineOfSightResult {
    const distance = Math.sqrt((toX - fromX) ** 2 + (toY - fromY) ** 2);
    const blockingPoints: Array<{ x: number; y: number }> = [];
    let blocked = false;

    for (const wall of this.walls) {
      const intersection = this.lineIntersection(
        fromX, fromY, toX, toY,
        wall.x1, wall.y1, wall.x2, wall.y2
      );

      if (intersection) {
        blocked = true;
        blockingPoints.push(intersection);
      }
    }

    return {
      visible: !blocked,
      blocked,
      blockingPoints,
      distance
    };
  }

  private lineIntersection(
    x1: number, y1: number, x2: number, y2: number,
    x3: number, y3: number, x4: number, y4: number
  ): { x: number; y: number } | null {
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 0.0001) return null;

    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      return {
        x: x1 + t * (x2 - x1),
        y: y1 + t * (y2 - y1)
      };
    }

    return null;
  }

  /**
   * Calculate vision polygon for a vision source
   */
  calculateVisionPolygon(sourceId: string): Array<{ x: number; y: number }> {
    const source = this.visionSources.get(sourceId);
    if (!source) {
      return [];
    }

    const rays = this.castRays(source);
    return this.raysToPolygon(rays, source);
  }

  private castRays(source: VisionSource): Array<{ x: number; y: number; distance: number }> {
    const rays: Array<{ x: number; y: number; distance: number }> = [];
    const rayCount = 360; // Cast rays in 1-degree increments
    
    const startAngle = source.angle ? source.direction! - source.angle / 2 : 0;
    const endAngle = source.angle ? source.direction! + source.angle / 2 : 360;

    for (let angle = startAngle; angle < endAngle; angle += 360 / rayCount) {
      const rad = (angle * Math.PI) / 180;
      const endX = source.x + Math.cos(rad) * source.radius;
      const endY = source.y + Math.sin(rad) * source.radius;

      const lineOfSight = this.calculateLineOfSight(source.x, source.y, endX, endY);
      
      if (lineOfSight.blocked && lineOfSight.blockingPoints.length > 0) {
        // Use the closest blocking point
        let closestPoint = lineOfSight.blockingPoints[0]!;
        let closestDistance = Math.sqrt(
          (closestPoint.x - source.x) ** 2 + (closestPoint.y - source.y) ** 2
        );

        for (const point of lineOfSight.blockingPoints) {
          const distance = Math.sqrt((point.x - source.x) ** 2 + (point.y - source.y) ** 2);
          if (distance < closestDistance) {
            closestPoint = point;
            closestDistance = distance;
          }
        }

        rays.push({
          x: closestPoint.x,
          y: closestPoint.y,
          distance: closestDistance
        });
      } else {
        rays.push({
          x: endX,
          y: endY,
          distance: source.radius
        });
      }
    }

    return rays;
  }

  private raysToPolygon(
    rays: Array<{ x: number; y: number; distance: number }>,
    source: VisionSource
  ): Array<{ x: number; y: number }> {
    const polygon: Array<{ x: number; y: number }> = [];

    // Add source point
    polygon.push({ x: source.x, y: source.y });

    // Add ray endpoints
    rays.forEach(ray => {
      polygon.push({ x: ray.x, y: ray.y });
    });

    return polygon;
  }

  /**
   * Mark area as explored
   */
  addExploredArea(points: Array<{ x: number; y: number }>): string {
    const areaId = `area-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    this.exploredAreas.set(areaId, {
      id: areaId,
      points,
      timestamp: Date.now()
    });

    return areaId;
  }

  /**
   * Remove explored area
   */
  removeExploredArea(areaId: string): void {
    this.exploredAreas.delete(areaId);
  }

  /**
   * Clear all explored areas
   */
  clearExploredAreas(): void {
    this.exploredAreas.clear();
  }

  /**
   * Check if a point is in explored area
   */
  isPointExplored(x: number, y: number): boolean {
    if (!this.settings.enabled) return true;

    for (const area of this.exploredAreas.values()) {
      if (this.pointInPolygon(x, y, area.points)) {
        return true;
      }
    }

    return false;
  }

  private pointInPolygon(x: number, y: number, polygon: Array<{ x: number; y: number }>): boolean {
    let inside = false;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const pointI = polygon[i]!;
      const pointJ = polygon[j]!;
      
      if (
        (pointI.y > y) !== (pointJ.y > y) &&
        x < ((pointJ.x - pointI.x) * (y - pointI.y)) / (pointJ.y - pointI.y) + pointI.x
      ) {
        inside = !inside;
      }
    }
    
    return inside;
  }

  /**
   * Update vision for all sources and auto-reveal areas
   */
  updateVision(): void {
    if (!this.settings.enabled || !this.settings.autoReveal) return;

    for (const source of this.visionSources.values()) {
      const visionPolygon = this.calculateVisionPolygon(source.id);
      
      if (visionPolygon.length > 0) {
        this.addExploredArea(visionPolygon);
      }
    }
  }

  /**
   * Get fog mask data for rendering
   */
  getFogMask(): {
    exploredAreas: ExploredArea[];
    visibleAreas: Array<{ sourceId: string; polygon: Array<{ x: number; y: number }> }>;
  } {
    const exploredAreas = Array.from(this.exploredAreas.values());
    const visibleAreas: Array<{ sourceId: string; polygon: Array<{ x: number; y: number }> }> = [];

    for (const [sourceId, _source] of this.visionSources.entries()) {
      const polygon = this.calculateVisionPolygon(sourceId);
      visibleAreas.push({ sourceId, polygon });
    }

    return { exploredAreas, visibleAreas };
  }

  /**
   * Check if a token can see another token
   */
  canTokenSeeToken(fromTokenId: string, toX: number, toY: number): boolean {
    const source = Array.from(this.visionSources.values()).find(s => s.tokenId === fromTokenId);
    if (!source) return false;

    const distance = Math.sqrt((toX - source.x) ** 2 + (toY - source.y) ** 2);
    if (distance > source.radius) return false;

    const lineOfSight = this.calculateLineOfSight(source.x, source.y, toX, toY);
    return lineOfSight.visible;
  }

  /**
   * Get all tokens visible to a specific token
   */
  getVisibleTokens(fromTokenId: string, allTokens: Array<{ id: string; x: number; y: number }>): string[] {
    const visibleTokenIds: string[] = [];

    for (const token of allTokens) {
      if (token.id === fromTokenId) continue;
      
      if (this.canTokenSeeToken(fromTokenId, token.x, token.y)) {
        visibleTokenIds.push(token.id);
      }
    }

    return visibleTokenIds;
  }

  /**
   * Update fog settings
   */
  updateSettings(newSettings: Partial<FogSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
  }

  /**
   * Get current fog settings
   */
  getSettings(): FogSettings {
    return { ...this.settings };
  }

  /**
   * Export fog data
   */
  exportFogData(): {
    settings: FogSettings;
    visionSources: VisionSource[];
    exploredAreas: ExploredArea[];
    walls: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  } {
    return {
      settings: this.settings,
      visionSources: Array.from(this.visionSources.values()),
      exploredAreas: Array.from(this.exploredAreas.values()),
      walls: [...this.walls]
    };
  }

  /**
   * Import fog data
   */
  importFogData(data: {
    settings: FogSettings;
    visionSources: VisionSource[];
    exploredAreas: ExploredArea[];
    walls: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  }): void {
    this.settings = data.settings;
    this.walls = data.walls;
    
    this.visionSources.clear();
    data.visionSources.forEach(source => {
      this.visionSources.set(source.id, source);
    });

    this.exploredAreas.clear();
    data.exploredAreas.forEach(area => {
      this.exploredAreas.set(area.id, area);
    });
  }
}
