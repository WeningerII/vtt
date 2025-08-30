import { logger } from '@vtt/logging';

/**
 * Presence Manager
 * Tracks user presence, cursors, and collaborative indicators
 */

export interface UserPresence {
  userId: string;
  username: string;
  role: 'gm' | 'player' | 'spectator';
  status: 'active' | 'idle' | 'away';
  lastSeen: number;
  cursor?: {
    x: number;
    y: number;
    sceneId: string;
  };
  selection?: {
    entityType: string;
    entityIds: string[];
  };
  viewport?: {
    x: number;
    y: number;
    zoom: number;
    sceneId: string;
  };
  color: string;
  avatar?: string;
}

export interface PresenceUpdate {
  userId: string;
  updates: Partial<UserPresence>;
  timestamp: number;
}

export class PresenceManager {
  private users: Map<string, UserPresence> = new Map();
  private currentUserId: string;
  private presenceInterval: NodeJS.Timeout | null = null;
  private changeListeners: ((event: PresenceEvent) => void)[] = [];
  private idleTimeout = 5 * 60 * 1000; // 5 minutes
  private awayTimeout = 15 * 60 * 1000; // 15 minutes

  constructor(currentUserId: string) {
    this.currentUserId = currentUserId;
    this.startPresenceTracking();
  }

  private startPresenceTracking(): void {
    // Update presence status based on activity
    this.presenceInterval = setInterval(() => {
      this.updatePresenceStatuses();
    }, 30000); // Check every 30 seconds

    // Track user activity
    if (typeof document !== 'undefined') {
      document.addEventListener('mousemove', () => this.recordActivity());
      document.addEventListener('keypress', () => this.recordActivity());
      document.addEventListener('click', () => this.recordActivity());
    }
  }

  private recordActivity(): void {
    const currentUser = this.users.get(this.currentUserId);
    if (currentUser) {
      this.updateUserPresence(this.currentUserId, {
        status: 'active',
        lastSeen: Date.now()
      });
    }
  }

  private updatePresenceStatuses(): void {
    const now = Date.now();
    
    for (const [userId, presence] of this.users.entries()) {
      const timeSinceLastSeen = now - presence.lastSeen;
      let newStatus = presence.status;

      if (timeSinceLastSeen > this.awayTimeout) {
        newStatus = 'away';
      } else if (timeSinceLastSeen > this.idleTimeout) {
        newStatus = 'idle';
      }

      if (newStatus !== presence.status) {
        this.updateUserPresence(userId, { status: newStatus });
      }
    }
  }

  /**
   * Add or update user presence
   */
  updateUserPresence(userId: string, updates: Partial<UserPresence>): void {
    const existingPresence = this.users.get(userId);
    const updatedPresence: UserPresence = existingPresence 
      ? { ...existingPresence, ...updates }
      : {
          userId,
          username: updates.username || 'Unknown User',
          role: updates.role || 'player',
          status: updates.status || 'active',
          lastSeen: Date.now(),
          color: updates.color || this.generateUserColor(userId),
          ...updates
        };

    this.users.set(userId, updatedPresence);
    
    this.emitChange({
      type: 'presence-updated',
      data: { userId, presence: updatedPresence, isCurrentUser: userId === this.currentUserId }
    });
  }

  /**
   * Remove user presence
   */
  removeUserPresence(userId: string): void {
    const presence = this.users.get(userId);
    if (presence) {
      this.users.delete(userId);
      this.emitChange({
        type: 'presence-removed',
        data: { userId, presence }
      });
    }
  }

  /**
   * Update cursor position
   */
  updateCursor(userId: string, x: number, y: number, sceneId: string): void {
    this.updateUserPresence(userId, {
      cursor: { x, y, sceneId },
      lastSeen: Date.now()
    });
  }

  /**
   * Update user selection
   */
  updateSelection(userId: string, entityType: string, entityIds: string[]): void {
    this.updateUserPresence(userId, {
      selection: { entityType, entityIds },
      lastSeen: Date.now()
    });
  }

  /**
   * Update viewport position
   */
  updateViewport(userId: string, x: number, y: number, zoom: number, sceneId: string): void {
    this.updateUserPresence(userId, {
      viewport: { x, y, zoom, sceneId },
      lastSeen: Date.now()
    });
  }

  /**
   * Get user presence
   */
  getUserPresence(userId: string): UserPresence | undefined {
    return this.users.get(userId);
  }

  /**
   * Get all active users
   */
  getActiveUsers(): UserPresence[] {
    return Array.from(this.users.values())
      .filter(user => user.status !== 'away');
  }

  /**
   * Get users in scene
   */
  getUsersInScene(sceneId: string): UserPresence[] {
    return Array.from(this.users.values())
      .filter(user => user.viewport?.sceneId === sceneId || user.cursor?.sceneId === sceneId);
  }

  /**
   * Get users with cursor in area
   */
  getUserCursorsInArea(sceneId: string, x: number, y: number, width: number, height: number): UserPresence[] {
    return Array.from(this.users.values())
      .filter(user => {
        const cursor = user.cursor;
        return cursor && 
               cursor.sceneId === sceneId &&
               cursor.x >= x && cursor.x <= x + width &&
               cursor.y >= y && cursor.y <= y + height;
      });
  }

  /**
   * Get users with overlapping selections
   */
  getUsersWithSelection(entityType: string, entityId: string): UserPresence[] {
    return Array.from(this.users.values())
      .filter(user => {
        const selection = user.selection;
        return selection &&
               selection.entityType === entityType &&
               selection.entityIds.includes(entityId);
      });
  }

  /**
   * Check if entity is being edited by another user
   */
  isEntityLocked(entityType: string, entityId: string): { locked: boolean; users: UserPresence[] } {
    const editingUsers = this.getUsersWithSelection(entityType, entityId)
      .filter(user => user.userId !== this.currentUserId);

    return {
      locked: editingUsers.length > 0,
      users: editingUsers
    };
  }

  /**
   * Generate consistent color for user
   */
  private generateUserColor(userId: string): string {
    // Generate consistent color based on user ID
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
      '#FECA57', '#FF9FF3', '#54A0FF', '#5F27CD',
      '#00D2D3', '#FF9F43', '#10AC84', '#EE5A24'
    ];
    
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash + userId.charCodeAt(i)) & 0xffffffff;
    }
    
    const color = colors[Math.abs(hash) % colors.length];
    return color || '#808080'; // Fallback color if undefined
  }

  /**
   * Get current user presence
   */
  getCurrentUserPresence(): UserPresence | undefined {
    return this.users.get(this.currentUserId);
  }

  /**
   * Set current user info
   */
  setCurrentUser(username: string, role: 'gm' | 'player' | 'spectator', avatar?: string): void {
    const presenceUpdate: Partial<UserPresence> = {
      username,
      role,
      status: 'active',
      lastSeen: Date.now()
    };
    
    if (avatar !== undefined) {
      presenceUpdate.avatar = avatar;
    }
    
    this.updateUserPresence(this.currentUserId, presenceUpdate);
  }

  /**
   * Bulk update from remote presence data
   */
  updateFromRemotePresence(presenceUpdates: PresenceUpdate[]): void {
    for (const update of presenceUpdates) {
      if (update.userId !== this.currentUserId) {
        this.updateUserPresence(update.userId, update.updates);
      }
    }
  }

  /**
   * Get presence data for synchronization
   */
  getPresenceUpdatesForSync(since?: number): PresenceUpdate[] {
    const updates: PresenceUpdate[] = [];
    const cutoff = since || 0;

    for (const [userId, presence] of this.users.entries()) {
      if (presence.lastSeen > cutoff) {
        updates.push({
          userId,
          updates: presence,
          timestamp: presence.lastSeen
        });
      }
    }

    return updates;
  }

  /**
   * Get collaboration indicators for UI
   */
  getCollaborationIndicators(sceneId: string): {
    cursors: Array<{ userId: string; x: number; y: number; color: string; username: string }>;
    selections: Array<{ userId: string; entityIds: string[]; color: string; username: string }>;
    viewers: Array<{ userId: string; username: string; color: string; status: string }>;
  } {
    const users = this.getUsersInScene(sceneId);

    return {
      cursors: users
        .filter(user => user.cursor && user.userId !== this.currentUserId)
        .map(user => ({
          userId: user.userId,
          x: user.cursor!.x,
          y: user.cursor!.y,
          color: user.color,
          username: user.username
        })),
      
      selections: users
        .filter(user => user.selection && user.userId !== this.currentUserId)
        .map(user => ({
          userId: user.userId,
          entityIds: user.selection!.entityIds,
          color: user.color,
          username: user.username
        })),
      
      viewers: users.map(user => ({
        userId: user.userId,
        username: user.username,
        color: user.color,
        status: user.status
      }))
    };
  }

  /**
   * Clear all presence data
   */
  clear(): void {
    this.users.clear();
    this.emitChange({ type: 'presence-cleared', data: {} });
  }

  /**
   * Export presence data
   */
  exportPresence(): UserPresence[] {
    return Array.from(this.users.values());
  }

  /**
   * Import presence data
   */
  importPresence(presenceData: UserPresence[]): void {
    this.users.clear();
    
    for (const presence of presenceData) {
      this.users.set(presence.userId, presence);
    }

    this.emitChange({ type: 'presence-imported', data: { users: presenceData } });
  }

  // Event System
  addEventListener(listener: (event: PresenceEvent) => void): void {
    this.changeListeners.push(listener);
  }

  removeEventListener(listener: (event: PresenceEvent) => void): void {
    const index = this.changeListeners.indexOf(listener);
    if (index > -1) {
      this.changeListeners.splice(index, 1);
    }
  }

  private emitChange(event: PresenceEvent): void {
    this.changeListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        logger.error('Presence event listener error:', error as Error);
      }
    });
  }

  /**
   * Cleanup
   */
  dispose(): void {
    if (this.presenceInterval) {
      clearInterval(this.presenceInterval);
      this.presenceInterval = null;
    }
    this.changeListeners = [];
  }
}

// Event Types
export type PresenceEvent =
  | { type: 'presence-updated'; data: { userId: string; presence: UserPresence; isCurrentUser: boolean } }
  | { type: 'presence-removed'; data: { userId: string; presence: UserPresence } }
  | { type: 'presence-cleared'; data: {} }
  | { type: 'presence-imported'; data: { users: UserPresence[] } };
