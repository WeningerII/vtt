import { EventEmitter } from 'events';
import { logger } from '@vtt/logging';

export interface OperationalTransform {
  id: string;
  type: 'insert' | 'delete' | 'retain' | 'move' | 'update';
  position?: number;
  length?: number;
  content?: any;
  path?: string[];
  timestamp: Date;
  userId: string;
}

export interface ConflictContext {
  sessionId: string;
  resourceId: string;
  resourceType: 'token' | 'map' | 'character' | 'campaign';
  currentVersion: number;
  operations: OperationalTransform[];
}

export interface MergeResult {
  success: boolean;
  mergedData: any;
  conflicts: Array<{
    path: string;
    localValue: any;
    remoteValue: any;
    resolution: 'local' | 'remote' | 'merged' | 'manual';
  }>;
  transformedOps: OperationalTransform[];
}

export class ConflictResolver extends EventEmitter {
  private pendingOperations: Map<string, OperationalTransform[]> = new Map();
  private resourceVersions: Map<string, number> = new Map();
  private lockManager: Map<string, { userId: string; timestamp: Date; ttl: number }> = new Map();

  constructor() {
    super();
    this.setMaxListeners(100);
    
    // Clean up expired locks every 30 seconds
    setInterval(() => this.cleanupExpiredLocks(), 30000);
  }

  /**
   * Transform operations for concurrent editing
   */
  transformOperations(
    localOps: OperationalTransform[],
    remoteOps: OperationalTransform[],
    context: ConflictContext
  ): { localTransformed: OperationalTransform[]; remoteTransformed: OperationalTransform[] } {
    const localTransformed: OperationalTransform[] = [];
    const remoteTransformed: OperationalTransform[] = [];

    // Sort operations by timestamp
    const allOps = [...localOps, ...remoteOps].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    let localIndex = 0;
    let remoteIndex = 0;

    for (const op of allOps) {
      const isLocal = localOps.includes(op);
      
      if (isLocal) {
        // Transform local operation against all previous remote operations
        let transformedOp = op;
        for (let i = 0; i < remoteIndex; i++) {
          transformedOp = this.transformOperation(transformedOp, remoteOps[i], 'local');
        }
        localTransformed.push(transformedOp);
        localIndex++;
      } else {
        // Transform remote operation against all previous local operations
        let transformedOp = op;
        for (let i = 0; i < localIndex; i++) {
          transformedOp = this.transformOperation(transformedOp, localOps[i], 'remote');
        }
        remoteTransformed.push(transformedOp);
        remoteIndex++;
      }
    }

    return { localTransformed, remoteTransformed };
  }

  /**
   * Merge conflicting data structures
   */
  mergeData(localData: any, remoteData: any, baseData: any, context: ConflictContext): MergeResult {
    const conflicts: MergeResult['conflicts'] = [];
    const mergedData = this.deepMerge(localData, remoteData, baseData, [], conflicts);

    return {
      success: conflicts.length === 0 || conflicts.every(c => c.resolution !== 'manual'),
      mergedData,
      conflicts,
      transformedOps: [], // Would be populated with actual transformation operations
    };
  }

  /**
   * Acquire a lock on a resource
   */
  acquireLock(resourceId: string, userId: string, ttl: number = 30000): boolean {
    const existingLock = this.lockManager.get(resourceId);
    
    if (existingLock) {
      const now = Date.now();
      const lockExpiry = existingLock.timestamp.getTime() + existingLock.ttl;
      
      if (now < lockExpiry && existingLock.userId !== userId) {
        return false; // Lock held by another user
      }
    }

    this.lockManager.set(resourceId, {
      userId,
      timestamp: new Date(),
      ttl,
    });

    this.emit('lockAcquired', resourceId, userId);
    logger.debug(`Lock acquired on ${resourceId} by ${userId}`);
    
    return true;
  }

  /**
   * Release a lock on a resource
   */
  releaseLock(resourceId: string, userId: string): boolean {
    const lock = this.lockManager.get(resourceId);
    
    if (!lock || lock.userId !== userId) {
      return false;
    }

    this.lockManager.delete(resourceId);
    this.emit('lockReleased', resourceId, userId);
    logger.debug(`Lock released on ${resourceId} by ${userId}`);
    
    return true;
  }

  /**
   * Check if a resource is locked
   */
  isLocked(resourceId: string, userId?: string): boolean {
    const lock = this.lockManager.get(resourceId);
    
    if (!lock) {
      return false;
    }

    const now = Date.now();
    const lockExpiry = lock.timestamp.getTime() + lock.ttl;
    
    if (now >= lockExpiry) {
      this.lockManager.delete(resourceId);
      return false;
    }

    return userId ? lock.userId !== userId : true;
  }

  /**
   * Resolve token position conflicts using vector-based interpolation
   */
  resolveTokenPositionConflict(
    localPosition: { x: number; y: number; z: number },
    remotePosition: { x: number; y: number; z: number },
    basePosition: { x: number; y: number; z: number },
    priority: 'local' | 'remote' | 'interpolate' = 'interpolate'
  ): { x: number; y: number; z: number } {
    if (priority === 'local') return localPosition;
    if (priority === 'remote') return remotePosition;

    // Calculate movement vectors
    const localVector = {
      x: localPosition.x - basePosition.x,
      y: localPosition.y - basePosition.y,
      z: localPosition.z - basePosition.z,
    };

    const remoteVector = {
      x: remotePosition.x - basePosition.x,
      y: remotePosition.y - basePosition.y,
      z: remotePosition.z - basePosition.z,
    };

    // Use weighted average based on vector magnitude
    const localMagnitude = Math.sqrt(localVector.x ** 2 + localVector.y ** 2 + localVector.z ** 2);
    const remoteMagnitude = Math.sqrt(remoteVector.x ** 2 + remoteVector.y ** 2 + remoteVector.z ** 2);
    
    const totalMagnitude = localMagnitude + remoteMagnitude;
    
    if (totalMagnitude === 0) {
      return basePosition;
    }

    const localWeight = localMagnitude / totalMagnitude;
    const remoteWeight = remoteMagnitude / totalMagnitude;

    return {
      x: basePosition.x + (localVector.x * localWeight + remoteVector.x * remoteWeight),
      y: basePosition.y + (localVector.y * localWeight + remoteVector.y * remoteWeight),
      z: basePosition.z + (localVector.z * localWeight + remoteVector.z * remoteWeight),
    };
  }

  /**
   * Resolve array conflicts (for initiative order, turn order, etc.)
   */
  resolveArrayConflict<T>(
    localArray: T[],
    remoteArray: T[],
    baseArray: T[],
    keyExtractor: (item: T) => string
  ): T[] {
    const baseKeys = new Set(baseArray.map(keyExtractor));
    const localKeys = new Set(localArray.map(keyExtractor));
    const remoteKeys = new Set(remoteArray.map(keyExtractor));

    // Find additions and removals
    const localAdditions = localArray.filter(item => !baseKeys.has(keyExtractor(item)));
    const remoteAdditions = remoteArray.filter(item => !baseKeys.has(keyExtractor(item)));
    const localRemovals = baseArray.filter(item => !localKeys.has(keyExtractor(item)));
    const remoteRemovals = baseArray.filter(item => !remoteKeys.has(keyExtractor(item)));

    // Start with base array
    let result = [...baseArray];

    // Apply removals (both local and remote)
    const allRemovals = new Set([
      ...localRemovals.map(keyExtractor),
      ...remoteRemovals.map(keyExtractor),
    ]);
    result = result.filter(item => !allRemovals.has(keyExtractor(item)));

    // Add new items (local first, then remote to maintain order)
    result.push(...localAdditions, ...remoteAdditions);

    return result;
  }

  private transformOperation(
    op: OperationalTransform,
    againstOp: OperationalTransform,
    priority: 'local' | 'remote'
  ): OperationalTransform {
    // Simplified operational transformation
    // In a real implementation, this would handle all operation type combinations
    
    if (op.type === 'move' && againstOp.type === 'move') {
      // Both operations are moves - use timestamp priority
      if (op.timestamp.getTime() > againstOp.timestamp.getTime()) {
        return op; // Keep the later operation
      } else {
        return againstOp; // Use the earlier operation
      }
    }

    if (op.type === 'update' && againstOp.type === 'update') {
      // Both are updates - merge the content
      return {
        ...op,
        content: { ...againstOp.content, ...op.content },
      };
    }

    // For other cases, return the operation unchanged
    return op;
  }

  private deepMerge(
    local: any,
    remote: any,
    base: any,
    path: string[],
    conflicts: MergeResult['conflicts']
  ): any {
    if (local === remote) {
      return local;
    }

    if (typeof local !== 'object' || typeof remote !== 'object' || local === null || remote === null) {
      // Primitive values conflict
      const pathStr = path.join('.');
      
      if (local === base) {
        // Local unchanged, use remote
        conflicts.push({
          path: pathStr,
          localValue: local,
          remoteValue: remote,
          resolution: 'remote',
        });
        return remote;
      } else if (remote === base) {
        // Remote unchanged, use local
        conflicts.push({
          path: pathStr,
          localValue: local,
          remoteValue: remote,
          resolution: 'local',
        });
        return local;
      } else {
        // Both changed - conflict requires manual resolution
        conflicts.push({
          path: pathStr,
          localValue: local,
          remoteValue: remote,
          resolution: 'manual',
        });
        return local; // Default to local for now
      }
    }

    // Object merging
    const result: any = {};
    const allKeys = new Set([...Object.keys(local), ...Object.keys(remote)]);

    for (const key of allKeys) {
      const localValue = local[key];
      const remoteValue = remote[key];
      const baseValue = base?.[key];

      result[key] = this.deepMerge(localValue, remoteValue, baseValue, [...path, key], conflicts);
    }

    return result;
  }

  private cleanupExpiredLocks(): void {
    const now = Date.now();
    const expiredLocks: string[] = [];

    for (const [resourceId, lock] of this.lockManager.entries()) {
      const lockExpiry = lock.timestamp.getTime() + lock.ttl;
      if (now >= lockExpiry) {
        expiredLocks.push(resourceId);
      }
    }

    expiredLocks.forEach(resourceId => {
      const lock = this.lockManager.get(resourceId);
      this.lockManager.delete(resourceId);
      this.emit('lockExpired', resourceId, lock?.userId);
      logger.debug(`Lock expired on ${resourceId}`);
    });
  }
}
