import { EventEmitter } from 'events';
import { logger } from '@vtt/logging';

export interface GameSession {
  id: string;
  name: string;
  campaignId: string;
  gamemaster: string;
  players: string[];
  spectators: string[];
  isActive: boolean;
  settings: SessionSettings;
  state: SessionState;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionSettings {
  maxPlayers: number;
  allowSpectators: boolean;
  requireApproval: boolean;
  pauseOnDisconnect: boolean;
  autoSave: boolean;
  autoSaveInterval: number;
  permissions: {
    playersCanMoveTokens: boolean;
    playersCanCreateTokens: boolean;
    playersCanEditMaps: boolean;
    playersCanRollDice: boolean;
  };
}

export interface SessionState {
  isPaused: boolean;
  currentTurn?: string;
  turnOrder: string[];
  round: number;
  initiative: Array<{ userId: string; tokenId?: string; value: number }>;
  activeEffects: Array<{ id: string; name: string; duration: number; targetId: string }>;
  combatState: 'inactive' | 'active' | 'paused';
}

export interface SessionAction {
  id: string;
  type: 'token_move' | 'token_create' | 'token_update' | 'token_delete' | 
        'map_change' | 'dice_roll' | 'chat_message' | 'initiative_roll' |
        'combat_start' | 'combat_end' | 'turn_advance' | 'effect_add' | 'effect_remove';
  userId: string;
  sessionId: string;
  data: any;
  timestamp: Date;
  version: number;
}

export interface ConflictResolution {
  actionId: string;
  conflictType: 'concurrent_edit' | 'permission_denied' | 'invalid_state' | 'version_mismatch';
  resolution: 'accept' | 'reject' | 'merge' | 'queue';
  mergedData?: any;
  reason?: string;
}

export interface UserPresence {
  userId: string;
  sessionId: string;
  status: 'active' | 'idle' | 'away' | 'disconnected';
  lastSeen: Date;
  cursor?: { x: number; y: number };
  selection?: string[];
  currentAction?: string;
}

export class SessionManager extends EventEmitter {
  private sessions: Map<string, GameSession> = new Map();
  private userPresence: Map<string, UserPresence> = new Map();
  private actionQueue: Map<string, SessionAction[]> = new Map();
  private versionCounters: Map<string, number> = new Map();
  private conflictResolvers: Map<string, (action: SessionAction) => ConflictResolution> = new Map();

  constructor() {
    super();
    this.setMaxListeners(100);
    this.setupConflictResolvers();
  }

  /**
   * Create a new game session
   */
  createSession(sessionData: Omit<GameSession, 'id' | 'createdAt' | 'updatedAt'>): GameSession {
    const session: GameSession = {
      ...sessionData,
      id: this.generateSessionId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.sessions.set(session.id, session);
    this.actionQueue.set(session.id, []);
    this.versionCounters.set(session.id, 0);
    
    this.emit('sessionCreated', session);
    logger.info(`Game session created: ${session.id} (${session.name})`);
    
    return session;
  }

  /**
   * Join a session
   */
  joinSession(sessionId: string, userId: string, role: 'player' | 'spectator' = 'player'): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn(`Attempted to join non-existent session: ${sessionId}`);
      return false;
    }

    // Check permissions and limits
    if (role === 'player') {
      if (session.players.length >= session.settings.maxPlayers) {
        logger.warn(`Session ${sessionId} is full`);
        return false;
      }
      if (session.players.includes(userId)) {
        logger.debug(`User ${userId} already in session ${sessionId}`);
        return true;
      }
      session.players.push(userId);
    } else {
      if (!session.settings.allowSpectators) {
        logger.warn(`Spectators not allowed in session ${sessionId}`);
        return false;
      }
      if (!session.spectators.includes(userId)) {
        session.spectators.push(userId);
      }
    }

    // Update user presence
    this.updateUserPresence(userId, sessionId, 'active');
    
    session.updatedAt = new Date();
    this.emit('userJoined', sessionId, userId, role);
    logger.info(`User ${userId} joined session ${sessionId} as ${role}`);
    
    return true;
  }

  /**
   * Leave a session
   */
  leaveSession(sessionId: string, userId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    // Remove from players or spectators
    session.players = session.players.filter(id => id !== userId);
    session.spectators = session.spectators.filter(id => id !== userId);

    // Update presence
    this.updateUserPresence(userId, sessionId, 'disconnected');

    // Handle gamemaster leaving
    if (session.gamemaster === userId) {
      if (session.players.length > 0) {
        // Transfer GM to first player
        session.gamemaster = session.players[0];
        this.emit('gamemasterChanged', sessionId, session.gamemaster);
      } else {
        // End session if no players left
        this.endSession(sessionId);
        return true;
      }
    }

    session.updatedAt = new Date();
    this.emit('userLeft', sessionId, userId);
    logger.info(`User ${userId} left session ${sessionId}`);
    
    return true;
  }

  /**
   * Submit an action to the session
   */
  submitAction(action: Omit<SessionAction, 'id' | 'version'>): ConflictResolution | null {
    const session = this.sessions.get(action.sessionId);
    if (!session) {
      return {
        actionId: '',
        conflictType: 'invalid_state',
        resolution: 'reject',
        reason: 'Session not found',
      };
    }

    // Create full action with ID and version
    const fullAction: SessionAction = {
      ...action,
      id: this.generateActionId(),
      version: this.getNextVersion(action.sessionId),
    };

    // Check permissions
    const permissionCheck = this.checkPermissions(fullAction, session);
    if (!permissionCheck.allowed) {
      return {
        actionId: fullAction.id,
        conflictType: 'permission_denied',
        resolution: 'reject',
        reason: permissionCheck.reason,
      };
    }

    // Check for conflicts
    const conflictResolution = this.resolveConflicts(fullAction, session);
    
    if (conflictResolution.resolution === 'accept' || conflictResolution.resolution === 'merge') {
      this.applyAction(fullAction, session, conflictResolution.mergedData);
    } else if (conflictResolution.resolution === 'queue') {
      this.queueAction(fullAction);
    }

    return conflictResolution;
  }

  /**
   * Update user presence
   */
  updateUserPresence(userId: string, sessionId: string, status: UserPresence['status'], data?: Partial<UserPresence>): void {
    const presenceKey = `${userId}:${sessionId}`;
    const existing = this.userPresence.get(presenceKey);
    
    const presence: UserPresence = {
      userId,
      sessionId,
      status,
      lastSeen: new Date(),
      ...existing,
      ...data,
    };

    this.userPresence.set(presenceKey, presence);
    this.emit('presenceUpdated', presence);
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): GameSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): GameSession[] {
    return Array.from(this.sessions.values()).filter(session => session.isActive);
  }

  /**
   * Get user presence in session
   */
  getSessionPresence(sessionId: string): UserPresence[] {
    return Array.from(this.userPresence.values()).filter(p => p.sessionId === sessionId);
  }

  /**
   * Start combat in session
   */
  startCombat(sessionId: string, userId: string, initiative: Array<{ userId: string; tokenId?: string; value: number }>): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.gamemaster !== userId) {
      return false;
    }

    session.state.combatState = 'active';
    session.state.initiative = initiative.sort((a, b) => b.value - a.value);
    session.state.turnOrder = session.state.initiative.map(init => init.userId);
    session.state.currentTurn = session.state.turnOrder[0];
    session.state.round = 1;

    this.emit('combatStarted', sessionId, session.state);
    logger.info(`Combat started in session ${sessionId}`);
    
    return true;
  }

  /**
   * Advance turn in combat
   */
  advanceTurn(sessionId: string, userId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.gamemaster !== userId || session.state.combatState !== 'active') {
      return false;
    }

    const currentIndex = session.state.turnOrder.indexOf(session.state.currentTurn || '');
    const nextIndex = (currentIndex + 1) % session.state.turnOrder.length;
    
    if (nextIndex === 0) {
      session.state.round++;
    }
    
    session.state.currentTurn = session.state.turnOrder[nextIndex];
    
    this.emit('turnAdvanced', sessionId, session.state.currentTurn, session.state.round);
    logger.debug(`Turn advanced in session ${sessionId} to ${session.state.currentTurn}`);
    
    return true;
  }

  /**
   * End combat
   */
  endCombat(sessionId: string, userId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.gamemaster !== userId) {
      return false;
    }

    session.state.combatState = 'inactive';
    session.state.currentTurn = undefined;
    session.state.turnOrder = [];
    session.state.initiative = [];
    session.state.round = 0;

    this.emit('combatEnded', sessionId);
    logger.info(`Combat ended in session ${sessionId}`);
    
    return true;
  }

  /**
   * End a session
   */
  endSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.isActive = false;
    
    // Clean up presence data
    const presenceKeys = Array.from(this.userPresence.keys()).filter(key => key.endsWith(`:${sessionId}`));
    presenceKeys.forEach(key => this.userPresence.delete(key));
    
    // Clean up action queue
    this.actionQueue.delete(sessionId);
    this.versionCounters.delete(sessionId);

    this.emit('sessionEnded', sessionId);
    logger.info(`Session ended: ${sessionId}`);
    
    return true;
  }

  private setupConflictResolvers(): void {
    // Token movement conflicts - use last-writer-wins with timestamp
    this.conflictResolvers.set('token_move', (action) => {
      return {
        actionId: action.id,
        conflictType: 'concurrent_edit',
        resolution: 'accept', // Simple last-writer-wins for movement
      };
    });

    // Token creation conflicts - always allow
    this.conflictResolvers.set('token_create', (action) => {
      return {
        actionId: action.id,
        conflictType: 'concurrent_edit',
        resolution: 'accept',
      };
    });

    // Token updates - merge non-conflicting properties
    this.conflictResolvers.set('token_update', (action) => {
      return {
        actionId: action.id,
        conflictType: 'concurrent_edit',
        resolution: 'merge',
        mergedData: action.data, // Simplified - would implement proper merging
      };
    });
  }

  private checkPermissions(action: SessionAction, session: GameSession): { allowed: boolean; reason?: string } {
    const isGM = action.userId === session.gamemaster;
    const isPlayer = session.players.includes(action.userId);
    
    if (!isGM && !isPlayer) {
      return { allowed: false, reason: 'User not in session' };
    }

    switch (action.type) {
      case 'token_move':
        return { allowed: isGM || session.settings.permissions.playersCanMoveTokens };
      case 'token_create':
        return { allowed: isGM || session.settings.permissions.playersCanCreateTokens };
      case 'map_change':
        return { allowed: isGM || session.settings.permissions.playersCanEditMaps };
      case 'dice_roll':
        return { allowed: isGM || session.settings.permissions.playersCanRollDice };
      case 'combat_start':
      case 'combat_end':
      case 'turn_advance':
        return { allowed: isGM };
      default:
        return { allowed: true };
    }
  }

  private resolveConflicts(action: SessionAction, session: GameSession): ConflictResolution {
    const resolver = this.conflictResolvers.get(action.type);
    if (!resolver) {
      return {
        actionId: action.id,
        conflictType: 'concurrent_edit',
        resolution: 'accept',
      };
    }

    return resolver(action);
  }

  private applyAction(action: SessionAction, session: GameSession, mergedData?: any): void {
    const queue = this.actionQueue.get(session.id) || [];
    queue.push(action);
    this.actionQueue.set(session.id, queue);

    session.updatedAt = new Date();
    
    this.emit('actionApplied', action, session.id, mergedData);
    logger.debug(`Action applied: ${action.type} in session ${session.id}`);
  }

  private queueAction(action: SessionAction): void {
    // For now, just log queued actions - would implement proper queuing logic
    logger.debug(`Action queued: ${action.type} in session ${action.sessionId}`);
  }

  private getNextVersion(sessionId: string): number {
    const current = this.versionCounters.get(sessionId) || 0;
    const next = current + 1;
    this.versionCounters.set(sessionId, next);
    return next;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateActionId(): string {
    return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
