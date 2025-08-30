import { vec3, mat4 } from 'gl-matrix';
import { Camera } from '../engine/Camera';

export interface CullableObject {
  id: string;
  position: vec3;
  boundingRadius: number;
  boundingBox?: BoundingBox;
  visible: boolean;
  lastCullFrame: number;
  distanceFromCamera: number;
  renderPriority: number;
}

export interface BoundingBox {
  min: vec3;
  max: vec3;
  center: vec3;
  extents: vec3;
}

export interface Plane {
  normal: vec3;
  distance: number;
}

export interface Frustum {
  planes: Plane[]; // 6 planes: left, right, top, bottom, near, far
}

export interface CullingStats {
  totalObjects: number;
  visibleObjects: number;
  frustumCulled: number;
  occlusionCulled: number;
  distanceCulled: number;
  cullTime: number;
  lastUpdate: number;
}

export class FrustumCuller {
  private frustum: Frustum = { planes: [] };
  
  public updateFrustum(camera: Camera): void {
    const viewProjectionMatrix = mat4.create();
    mat4.multiply(viewProjectionMatrix, camera.getProjectionMatrix(), camera.getViewMatrix());
    
    this.extractFrustumPlanes(viewProjectionMatrix);
  }
  
  private extractFrustumPlanes(viewProjectionMatrix: mat4): void {
    const m = viewProjectionMatrix;
    this.frustum.planes = [
      // Left plane
      this.normalizePlane({
        normal: vec3.fromValues(m[3] + m[0], m[7] + m[4], m[11] + m[8]),
        distance: m[15] + m[12]
      }),
      // Right plane
      this.normalizePlane({
        normal: vec3.fromValues(m[3] - m[0], m[7] - m[4], m[11] - m[8]),
        distance: m[15] - m[12]
      }),
      // Top plane
      this.normalizePlane({
        normal: vec3.fromValues(m[3] - m[1], m[7] - m[5], m[11] - m[9]),
        distance: m[15] - m[13]
      }),
      // Bottom plane
      this.normalizePlane({
        normal: vec3.fromValues(m[3] + m[1], m[7] + m[5], m[11] + m[9]),
        distance: m[15] + m[13]
      }),
      // Near plane
      this.normalizePlane({
        normal: vec3.fromValues(m[3] + m[2], m[7] + m[6], m[11] + m[10]),
        distance: m[15] + m[14]
      }),
      // Far plane
      this.normalizePlane({
        normal: vec3.fromValues(m[3] - m[2], m[7] - m[6], m[11] - m[10]),
        distance: m[15] - m[14]
      })
    ];
  }
  
  private normalizePlane(plane: Plane): Plane {
    const length = vec3.length(plane.normal);
    return {
      normal: vec3.scale(vec3.create(), plane.normal, 1 / length),
      distance: plane.distance / length
    };
  }
  
  public isPointInFrustum(point: vec3): boolean {
    for (const plane of this.frustum.planes) {
      if (vec3.dot(plane.normal, point) + plane.distance < 0) {
        return false;
      }
    }
    return true;
  }
  
  public isSphereInFrustum(center: vec3, radius: number): boolean {
    for (const plane of this.frustum.planes) {
      if (vec3.dot(plane.normal, center) + plane.distance < -radius) {
        return false;
      }
    }
    return true;
  }
  
  public isBoxInFrustum(box: BoundingBox): boolean {
    for (const plane of this.frustum.planes) {
      const positiveVertex = vec3.create();
      const negativeVertex = vec3.create();
      
      // Find the positive and negative vertices relative to the plane normal
      for (let i = 0; i < 3; i++) {
        if (plane.normal[i] >= 0) {
          positiveVertex[i] = box.max[i];
          negativeVertex[i] = box.min[i];
        } else {
          positiveVertex[i] = box.min[i];
          negativeVertex[i] = box.max[i];
        }
      }
      
      // If the positive vertex is behind the plane, the box is outside
      if (vec3.dot(plane.normal, positiveVertex) + plane.distance < 0) {
        return false;
      }
    }
    return true;
  }
  
  public getFrustum(): Frustum {
    return this.frustum;
  }
}

export class OcclusionCuller {
  private gl: WebGL2RenderingContext;
  private occlusionQueries = new Map<string, WebGLQuery>();
  private queryResults = new Map<string, boolean>();
  private queryPending = new Set<string>();
  private frameDelay = 2; // Wait 2 frames before reading results
  private queryFrames = new Map<string, number>();
  
  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
  }
  
  public beginQuery(objectId: string): boolean {
    if (this.queryPending.has(objectId)) {
      return this.queryResults.get(objectId) ?? true;
    }
    
    let query = this.occlusionQueries.get(objectId);
    if (!query) {
      query = this.gl.createQuery();
      if (!query) return true;
      this.occlusionQueries.set(objectId, query);
    }
    
    this.gl.beginQuery(this.gl.ANY_SAMPLES_PASSED, query);
    this.queryPending.add(objectId);
    this.queryFrames.set(objectId, 0);
    
    return this.queryResults.get(objectId) ?? true;
  }
  
  public endQuery(): void {
    this.gl.endQuery(this.gl.ANY_SAMPLES_PASSED);
  }
  
  public updateQueries(): void {
    for (const [objectId, frameCount] of this.queryFrames) {
      const newFrameCount = frameCount + 1;
      this.queryFrames.set(objectId, newFrameCount);
      
      if (newFrameCount >= this.frameDelay) {
        const query = this.occlusionQueries.get(objectId);
        if (query) {
          const available = this.gl.getQueryParameter(query, this.gl.QUERY_RESULT_AVAILABLE);
          if (available) {
            const result = this.gl.getQueryParameter(query, this.gl.QUERY_RESULT);
            this.queryResults.set(objectId, result > 0);
            this.queryPending.delete(objectId);
            this.queryFrames.delete(objectId);
          }
        }
      }
    }
  }
  
  public isVisible(objectId: string): boolean {
    return this.queryResults.get(objectId) ?? true;
  }
  
  public cleanup(): void {
    for (const query of this.occlusionQueries.values()) {
      this.gl.deleteQuery(query);
    }
    this.occlusionQueries.clear();
    this.queryResults.clear();
    this.queryPending.clear();
    this.queryFrames.clear();
  }
}

export class SpatialHashGrid {
  private cellSize: number;
  private grid = new Map<string, CullableObject[]>();
  
  constructor(cellSize: number = 100) {
    this.cellSize = cellSize;
  }
  
  private getGridKey(x: number, y: number, z: number): string {
    const gx = Math.floor(x / this.cellSize);
    const gy = Math.floor(y / this.cellSize);
    const gz = Math.floor(z / this.cellSize);
    return `${gx},${gy},${gz}`;
  }
  
  public insert(object: CullableObject): void {
    const key = this.getGridKey(object.position[0], object.position[1], object.position[2]);
    
    if (!this.grid.has(key)) {
      this.grid.set(key, []);
    }
    
    const cell = this.grid.get(key)!;
    if (!cell.includes(object)) {
      cell.push(object);
    }
  }
  
  public remove(object: CullableObject): void {
    const key = this.getGridKey(object.position[0], object.position[1], object.position[2]);
    const cell = this.grid.get(key);
    
    if (cell) {
      const index = cell.indexOf(object);
      if (index >= 0) {
        cell.splice(index, 1);
        if (cell.length === 0) {
          this.grid.delete(key);
        }
      }
    }
  }
  
  public update(object: CullableObject, oldPosition: vec3): void {
    this.remove({ ...object, position: oldPosition } as CullableObject);
    this.insert(object);
  }
  
  public queryRadius(center: vec3, radius: number): CullableObject[] {
    const results: CullableObject[] = [];
    const cellRadius = Math.ceil(radius / this.cellSize);
    
    const centerX = Math.floor(center[0] / this.cellSize);
    const centerY = Math.floor(center[1] / this.cellSize);
    const centerZ = Math.floor(center[2] / this.cellSize);
    
    for (let x = centerX - cellRadius; x <= centerX + cellRadius; x++) {
      for (let y = centerY - cellRadius; y <= centerY + cellRadius; y++) {
        for (let z = centerZ - cellRadius; z <= centerZ + cellRadius; z++) {
          const key = `${x},${y},${z}`;
          const cell = this.grid.get(key);
          
          if (cell) {
            for (const object of cell) {
              const distance = vec3.distance(center, object.position);
              if (distance <= radius) {
                results.push(object);
              }
            }
          }
        }
      }
    }
    
    return results;
  }
  
  public clear(): void {
    this.grid.clear();
  }
  
  public getStats() {
    return {
      cellCount: this.grid.size,
      objectCount: Array.from(this.grid.values()).reduce((_sum, _cell) => sum + cell.length, 0),
      cellSize: this.cellSize
    };
  }
}

export class CullingSystem {
  private frustumCuller: FrustumCuller;
  private occlusionCuller: OcclusionCuller;
  private spatialGrid: SpatialHashGrid;
  private objects = new Map<string, CullableObject>();
  private stats: CullingStats;
  private currentFrame = 0;
  
  // Configuration
  private maxDistance = 1000;
  private enableFrustumCulling = true;
  private enableOcclusionCulling = false; // Disabled by default due to performance cost
  private enableDistanceCulling = true;
  private enableSpatialOptimization = true;
  
  constructor(gl: WebGL2RenderingContext, spatialCellSize: number = 100) {
    this.frustumCuller = new FrustumCuller();
    this.occlusionCuller = new OcclusionCuller(gl);
    this.spatialGrid = new SpatialHashGrid(spatialCellSize);
    
    this.stats = {
      totalObjects: 0,
      visibleObjects: 0,
      frustumCulled: 0,
      occlusionCulled: 0,
      distanceCulled: 0,
      cullTime: 0,
      lastUpdate: 0
    };
  }
  
  public addObject(object: CullableObject): void {
    this.objects.set(object.id, object);
    
    if (this.enableSpatialOptimization) {
      this.spatialGrid.insert(object);
    }
  }
  
  public removeObject(objectId: string): void {
    const object = this.objects.get(objectId);
    if (object) {
      this.objects.delete(objectId);
      
      if (this.enableSpatialOptimization) {
        this.spatialGrid.remove(object);
      }
    }
  }
  
  public updateObject(objectId: string, newPosition: vec3): void {
    const object = this.objects.get(objectId);
    if (object) {
      const oldPosition = vec3.copy(vec3.create(), object.position);
      vec3.copy(object.position, newPosition);
      
      if (this.enableSpatialOptimization) {
        this.spatialGrid.update(object, oldPosition);
      }
    }
  }
  
  public cull(camera: Camera): CullableObject[] {
    const startTime = performance.now();
    this.currentFrame++;
    
    // Reset stats
    this.stats.totalObjects = this.objects.size;
    this.stats.visibleObjects = 0;
    this.stats.frustumCulled = 0;
    this.stats.occlusionCulled = 0;
    this.stats.distanceCulled = 0;
    
    // Update frustum
    if (this.enableFrustumCulling) {
      this.frustumCuller.updateFrustum(camera);
    }
    
    // Update occlusion queries
    if (this.enableOcclusionCulling) {
      this.occlusionCuller.updateQueries();
    }
    
    const visibleObjects: CullableObject[] = [];
    const cameraPosition = camera.getPosition();
    
    // Get objects to test (all or spatial subset)
    let objectsToTest: CullableObject[];
    if (this.enableSpatialOptimization) {
      // Query objects within view distance
      objectsToTest = this.spatialGrid.queryRadius(cameraPosition, this.maxDistance);
    } else {
      objectsToTest = Array.from(this.objects.values());
    }
    
    // Process each object
    for (const object of objectsToTest) {
      let visible = true;
      
      // Calculate distance to camera
      object.distanceFromCamera = vec3.distance(cameraPosition, object.position);
      
      // Distance culling
      if (this.enableDistanceCulling && object.distanceFromCamera > this.maxDistance) {
        visible = false;
        this.stats.distanceCulled++;
      }
      
      // Frustum culling
      if (visible && this.enableFrustumCulling) {
        if (object.boundingBox) {
          visible = this.frustumCuller.isBoxInFrustum(object.boundingBox);
        } else {
          visible = this.frustumCuller.isSphereInFrustum(object.position, object.boundingRadius);
        }
        
        if (!visible) {
          this.stats.frustumCulled++;
        }
      }
      
      // Occlusion culling (expensive - only for important objects)
      if (visible && this.enableOcclusionCulling && object.renderPriority > 0.5) {
        visible = this.occlusionCuller.isVisible(object.id);
        if (!visible) {
          this.stats.occlusionCulled++;
        }
      }
      
      // Update object state
      object.visible = visible;
      object.lastCullFrame = this.currentFrame;
      
      if (visible) {
        visibleObjects.push(object);
        this.stats.visibleObjects++;
      }
    }
    
    // Sort by distance for rendering order
    visibleObjects.sort((_a, _b) => a.distanceFromCamera - b.distanceFromCamera);
    
    // Update timing stats
    this.stats.cullTime = performance.now() - startTime;
    this.stats.lastUpdate = Date.now();
    
    return visibleObjects;
  }
  
  public beginOcclusionQuery(objectId: string): boolean {
    if (!this.enableOcclusionCulling) return true;
    return this.occlusionCuller.beginQuery(objectId);
  }
  
  public endOcclusionQuery(): void {
    if (!this.enableOcclusionCulling) return;
    this.occlusionCuller.endQuery();
  }
  
  // Configuration methods
  public setMaxDistance(distance: number): void {
    this.maxDistance = distance;
  }
  
  public enableFrustum(enabled: boolean): void {
    this.enableFrustumCulling = enabled;
  }
  
  public enableOcclusion(enabled: boolean): void {
    this.enableOcclusionCulling = enabled;
  }
  
  public enableDistance(enabled: boolean): void {
    this.enableDistanceCulling = enabled;
  }
  
  public enableSpatial(enabled: boolean): void {
    this.enableSpatialOptimization = enabled;
  }
  
  // Statistics and debugging
  public getStats(): CullingStats {
    return { ...this.stats };
  }
  
  public getVisibilityRate(): number {
    return this.stats.totalObjects > 0 ? this.stats.visibleObjects / this.stats.totalObjects : 0;
  }
  
  public getSpatialStats() {
    return this.spatialGrid.getStats();
  }
  
  public getObject(objectId: string): CullableObject | undefined {
    return this.objects.get(objectId);
  }
  
  public getAllObjects(): CullableObject[] {
    return Array.from(this.objects.values());
  }
  
  public getVisibleObjects(): CullableObject[] {
    return Array.from(this.objects.values()).filter(obj => obj.visible);
  }
  
  public cleanup(): void {
    this.occlusionCuller.cleanup();
    this.spatialGrid.clear();
    this.objects.clear();
  }
  
  // Utility functions
  public static createBoundingBox(min: vec3, max: vec3): BoundingBox {
    const center = vec3.create();
    vec3.add(center, min, max);
    vec3.scale(center, center, 0.5);
    
    const extents = vec3.create();
    vec3.subtract(extents, max, center);
    
    return {
      min: vec3.copy(vec3.create(), min),
      max: vec3.copy(vec3.create(), max),
      center,
      extents
    };
  }
  
  public static createBoundingSphere(center: vec3, radius: number): { center: vec3; radius: number } {
    return {
      center: vec3.copy(vec3.create(), center),
      radius
    };
  }
}
