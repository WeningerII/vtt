import { vec3 } from 'gl-matrix';
import { Camera } from '../engine/Camera';

export interface LODLevel {
  distance: number;
  meshId: string;
  textureId?: string;
  materialId?: string;
  vertexCount?: number;
  triangleCount?: number;
  quality: number; // 0-1 scale
}

export interface LODObject {
  id: string;
  position: vec3;
  boundingRadius: number;
  levels: LODLevel[];
  currentLevel: number;
  lastUpdateFrame: number;
  distanceFromCamera: number;
  hysteresis: number; // Prevents LOD popping
  lockLevel?: number; // Force specific LOD level
  priority: number; // Higher priority objects get better LODs
}

export interface LODStats {
  totalObjects: number;
  level0Objects: number;
  level1Objects: number;
  level2Objects: number;
  level3Objects: number;
  switchesThisFrame: number;
  totalSwitches: number;
  updateTime: number;
  lastUpdate: number;
}

export interface LODConfig {
  enableHysteresis: boolean;
  hysteresisRatio: number;
  maxLODLevel: number;
  adaptiveQuality: boolean;
  performanceBudget: number; // Max triangles per frame
  priorityBias: number;
  updateFrequency: number; // How often to update LODs (in frames)
}

export class LODSystem {
  private objects = new Map<string, LODObject>();
  private stats: LODStats;
  private config: LODConfig;
  private currentFrame = 0;
  private triangleBudget = 0;
  private qualityScale = 1.0;
  
  // Adaptive quality parameters
  private targetFramerate = 60;
  private frameTimeHistory: number[] = [];
  private maxHistorySize = 30;
  
  constructor(config?: Partial<LODConfig>) {
    this.config = {
      enableHysteresis: true,
      hysteresisRatio: 1.2,
      maxLODLevel: 4,
      adaptiveQuality: true,
      performanceBudget: 1000000, // 1M triangles
      priorityBias: 0.5,
      updateFrequency: 1,
      ...config
    };
    
    this.stats = {
      totalObjects: 0,
      level0Objects: 0,
      level1Objects: 0,
      level2Objects: 0,
      level3Objects: 0,
      switchesThisFrame: 0,
      totalSwitches: 0,
      updateTime: 0,
      lastUpdate: 0
    };
  }
  
  public addObject(lodObject: LODObject): void {
    // Initialize object state
    lodObject.currentLevel = 0;
    lodObject.lastUpdateFrame = 0;
    lodObject.distanceFromCamera = 0;
    
    // Set default hysteresis if not specified
    if (lodObject.hysteresis === undefined) {
      lodObject.hysteresis = this.config.hysteresisRatio;
    }
    
    // Sort LOD levels by distance
    lodObject.levels.sort((_a, _b) => a.distance - b.distance);
    
    this.objects.set(lodObject.id, lodObject);
  }
  
  public removeObject(objectId: string): void {
    this.objects.delete(objectId);
  }
  
  public updateObject(objectId: string, position: vec3): void {
    const object = this.objects.get(objectId);
    if (object) {
      vec3.copy(object.position, position);
    }
  }
  
  public lockLODLevel(objectId: string, level?: number): void {
    const object = this.objects.get(objectId);
    if (object) {
      object.lockLevel = level;
    }
  }
  
  public update(camera: Camera, deltaTime: number): void {
    const startTime = performance.now();
    this.currentFrame++;
    
    // Skip update if not needed based on frequency
    if (this.currentFrame % this.config.updateFrequency !== 0) {
      return;
    }
    
    // Update adaptive quality
    if (this.config.adaptiveQuality) {
      this.updateAdaptiveQuality(deltaTime);
    }
    
    // Reset frame stats
    this.stats.switchesThisFrame = 0;
    this.stats.totalObjects = this.objects.size;
    this.stats.level0Objects = 0;
    this.stats.level1Objects = 0;
    this.stats.level2Objects = 0;
    this.stats.level3Objects = 0;
    
    const cameraPosition = camera.getPosition();
    this.triangleBudget = this.config.performanceBudget;
    
    // Collect objects with distances and sort by priority
    const objectsToUpdate: Array<{ object: LODObject; distance: number; priority: number }> = [];
    
    for (const object of this.objects.values()) {
      const distance = vec3.distance(cameraPosition, object.position);
      object.distanceFromCamera = distance;
      
      // Calculate effective priority (closer + higher priority = better LOD)
      const distancePriority = 1.0 / (1.0 + distance * 0.01);
      const effectivePriority = distancePriority * object.priority;
      
      objectsToUpdate.push({
        object,
        distance,
        priority: effectivePriority
      });
    }
    
    // Sort by priority (highest first)
    objectsToUpdate.sort((_a, _b) => b.priority - a.priority);
    
    // Update LOD levels
    for (const { object,  distance  } of objectsToUpdate) {
      this.updateObjectLOD(object, distance);
    }
    
    // Update timing stats
    this.stats.updateTime = performance.now() - startTime;
    this.stats.lastUpdate = Date.now();
  }
  
  private updateObjectLOD(object: LODObject, distance: number): void {
    // Skip if locked to specific level
    if (object.lockLevel !== undefined) {
      const newLevel = Math.max(0, Math.min(object.lockLevel, object.levels.length - 1));
      if (newLevel !== object.currentLevel) {
        object.currentLevel = newLevel;
        this.stats.switchesThisFrame++;
        this.stats.totalSwitches++;
      }
      this.updateLevelStats(object.currentLevel);
      return;
    }
    
    let newLevel = object.currentLevel;
    const adjustedDistance = distance / this.qualityScale;
    
    // Find appropriate LOD level
    for (let i = 0; i < object.levels.length; i++) {
      const levelDistance = object.levels[i].distance;
      
      // Apply hysteresis to prevent popping
      let thresholdDistance = levelDistance;
      if (this.config.enableHysteresis && object.lastUpdateFrame > 0) {
        if (i > object.currentLevel) {
          // Moving to lower quality - use normal threshold
          thresholdDistance = levelDistance;
        } else if (i < object.currentLevel) {
          // Moving to higher quality - use hysteresis
          thresholdDistance = levelDistance * object.hysteresis;
        }
      }
      
      if (adjustedDistance >= thresholdDistance) {
        newLevel = i;
      } else {
        break;
      }
    }
    
    // Apply performance budget constraints
    if (this.config.performanceBudget > 0) {
      newLevel = this.applyPerformanceBudget(object, newLevel);
    }
    
    // Update level if changed
    if (newLevel !== object.currentLevel) {
      object.currentLevel = newLevel;
      object.lastUpdateFrame = this.currentFrame;
      this.stats.switchesThisFrame++;
      this.stats.totalSwitches++;
    }
    
    this.updateLevelStats(newLevel);
  }
  
  private applyPerformanceBudget(object: LODObject, proposedLevel: number): number {
    const level = object.levels[proposedLevel];
    const triangleCount = level.triangleCount || 0;
    
    // If we have budget, allow the proposed level
    if (this.triangleBudget >= triangleCount) {
      this.triangleBudget -= triangleCount;
      return proposedLevel;
    }
    
    // Find the lowest quality level that fits in budget
    for (let i = object.levels.length - 1; i >= 0; i--) {
      const fallbackLevel = object.levels[i];
      const fallbackTriangles = fallbackLevel.triangleCount || 0;
      
      if (fallbackTriangles <= this.triangleBudget) {
        this.triangleBudget -= fallbackTriangles;
        return i;
      }
    }
    
    // If nothing fits, use the lowest quality level
    return object.levels.length - 1;
  }
  
  private updateLevelStats(level: number): void {
    switch (level) {
      case 0: this.stats.level0Objects++; break;
      case 1: this.stats.level1Objects++; break;
      case 2: this.stats.level2Objects++; break;
      case 3: this.stats.level3Objects++; break;
    }
  }
  
  private updateAdaptiveQuality(deltaTime: number): void {
    const frameTime = deltaTime * 1000; // Convert to ms
    this.frameTimeHistory.push(frameTime);
    
    if (this.frameTimeHistory.length > this.maxHistorySize) {
      this.frameTimeHistory.shift();
    }
    
    if (this.frameTimeHistory.length >= this.maxHistorySize) {
      const averageFrameTime = this.frameTimeHistory.reduce((_a, _b) => a + b, 0) / this.frameTimeHistory.length;
      const targetFrameTime = 1000 / this.targetFramerate;
      
      // Adjust quality scale based on performance
      if (averageFrameTime > targetFrameTime * 1.2) {
        // Performance is poor, reduce quality
        this.qualityScale *= 0.98;
        this.qualityScale = Math.max(0.5, this.qualityScale);
      } else if (averageFrameTime < targetFrameTime * 0.8) {
        // Performance is good, increase quality
        this.qualityScale *= 1.01;
        this.qualityScale = Math.min(1.5, this.qualityScale);
      }
    }
  }
  
  // Query methods
  public getCurrentLOD(objectId: string): LODLevel | null {
    const object = this.objects.get(objectId);
    if (!object || object.currentLevel >= object.levels.length) {
      return null;
    }
    return object.levels[object.currentLevel];
  }
  
  public getObject(objectId: string): LODObject | undefined {
    return this.objects.get(objectId);
  }
  
  public getAllObjects(): LODObject[] {
    return Array.from(this.objects.values());
  }
  
  public getObjectsAtLevel(level: number): LODObject[] {
    return Array.from(this.objects.values()).filter(obj => obj.currentLevel === level);
  }
  
  // Statistics
  public getStats(): LODStats {
    return { ...this.stats };
  }
  
  public getQualityScale(): number {
    return this.qualityScale;
  }
  
  public getTriangleCount(): number {
    let totalTriangles = 0;
    for (const object of this.objects.values()) {
      const level = object.levels[object.currentLevel];
      totalTriangles += level.triangleCount || 0;
    }
    return totalTriangles;
  }
  
  public getAverageQuality(): number {
    if (this.objects.size === 0) return 1.0;
    
    let totalQuality = 0;
    for (const object of this.objects.values()) {
      const level = object.levels[object.currentLevel];
      totalQuality += level.quality;
    }
    
    return totalQuality / this.objects.size;
  }
  
  // Configuration
  public setConfig(config: Partial<LODConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  public getConfig(): LODConfig {
    return { ...this.config };
  }
  
  public setTargetFramerate(fps: number): void {
    this.targetFramerate = fps;
  }
  
  public setPerformanceBudget(triangles: number): void {
    this.config.performanceBudget = triangles;
  }
  
  // Debugging and utilities
  public debugObject(objectId: string): any {
    const object = this.objects.get(objectId);
    if (!object) return null;
    
    const currentLOD = this.getCurrentLOD(objectId);
    
    return {
      id: object.id,
      position: object.position,
      distance: object.distanceFromCamera,
      currentLevel: object.currentLevel,
      totalLevels: object.levels.length,
      currentLOD,
      quality: currentLOD?.quality || 0,
      triangles: currentLOD?.triangleCount || 0,
      locked: object.lockLevel !== undefined,
      priority: object.priority
    };
  }
  
  public exportLODData(): any {
    const objects = Array.from(this.objects.values()).map(obj => ({
      id: obj.id,
      currentLevel: obj.currentLevel,
      distance: obj.distanceFromCamera,
      levels: obj.levels.map(level => ({
        distance: level.distance,
        quality: level.quality,
        triangleCount: level.triangleCount
      }))
    }));
    
    return {
      objects,
      stats: this.stats,
      config: this.config,
      qualityScale: this.qualityScale,
      triangleBudget: this.config.performanceBudget - this.triangleBudget
    };
  }
  
  public importLODData(data: any): void {
    // Restore configuration
    if (data.config) {
      this.config = { ...this.config, ...data.config };
    }
    
    // Restore quality scale
    if (data.qualityScale) {
      this.qualityScale = data.qualityScale;
    }
    
    // Note: Object data would need to be restored separately
    // as it requires the actual LOD objects to exist
  }
  
  public clear(): void {
    this.objects.clear();
    this.frameTimeHistory = [];
    this.qualityScale = 1.0;
    this.triangleBudget = 0;
  }
}

// Helper functions for creating LOD objects
export function createLODObject(
  _id: string,
  _position: vec3,
  _boundingRadius: number,
  levels: Array<{
    distance: number;
    meshId: string;
    quality: number;
    triangleCount?: number;
  }>,
  _priority: number = 1.0
): LODObject {
  return {
    id,
    position: vec3.copy(vec3.create(), position),
    boundingRadius,
    levels: levels.map(level => ({
      distance: level.distance,
      meshId: level.meshId,
      quality: level.quality,
      triangleCount: level.triangleCount || 1000
    })),
    currentLevel: 0,
    lastUpdateFrame: 0,
    distanceFromCamera: 0,
    hysteresis: 1.2,
    priority
  };
}

export function createStandardLODLevels(
  _baseMeshId: string,
  _baseTriangles: number = 10000
): LODLevel[] {
  return [
    {
      distance: 0,
      meshId: `${baseMeshId}_lod0`,
      quality: 1.0,
      triangleCount: baseTriangles
    },
    {
      distance: 50,
      meshId: `${baseMeshId}_lod1`,
      quality: 0.75,
      triangleCount: Math.floor(baseTriangles * 0.5)
    },
    {
      distance: 150,
      meshId: `${baseMeshId}_lod2`,
      quality: 0.5,
      triangleCount: Math.floor(baseTriangles * 0.25)
    },
    {
      distance: 300,
      meshId: `${baseMeshId}_lod3`,
      quality: 0.25,
      triangleCount: Math.floor(baseTriangles * 0.1)
    }
  ];
}

// Advanced LOD strategies
export class AdaptiveLODStrategy {
  private performanceHistory: number[] = [];
  private qualityThresholds = [0.9, 0.7, 0.5, 0.3];
  
  public updateLODDistances(
    lodObject: LODObject,
    currentPerformance: number,
    targetPerformance: number
  ): void {
    const performanceRatio = currentPerformance / targetPerformance;
    
    // Adjust LOD distances based on performance
    for (let i = 0; i < lodObject.levels.length; i++) {
      const baseDistance = lodObject.levels[i].distance;
      const adjustment = 1.0 / performanceRatio;
      
      lodObject.levels[i].distance = baseDistance * adjustment;
    }
  }
}

export class TemporalLOD {
  private objectHistories = new Map<string, number[]>();
  private historySize = 10;
  
  public updateTemporalLOD(object: LODObject, currentDistance: number): number {
    let history = this.objectHistories.get(object.id);
    if (!history) {
      history = [];
      this.objectHistories.set(object.id, history);
    }
    
    history.push(currentDistance);
    if (history.length > this.historySize) {
      history.shift();
    }
    
    // Use trend to predict future distance
    if (history.length >= 2) {
      const trend = history[history.length - 1] - history[0];
      const predictedDistance = currentDistance + trend * 0.1;
      return Math.max(0, predictedDistance);
    }
    
    return currentDistance;
  }
}
