import { EventEmitter } from 'events';
import { logger } from '@vtt/logging';

export interface Token {
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  rotation: number;
  scale: { x: number; y: number };
  size: 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan';
  color: string;
  imageUrl?: string;
  visibility: 'visible' | 'hidden' | 'dimmed';
  conditions: string[];
  hitPoints?: { current: number; max: number };
  armorClass?: number;
  speed?: number;
  initiative?: number;
  ownerId: string;
  locked: boolean;
  layer: 'background' | 'tokens' | 'foreground';
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface TokenUpdate {
  id: string;
  changes: Partial<Omit<Token, 'id' | 'createdAt'>>;
  userId: string;
  timestamp: Date;
}

export interface TokenInteraction {
  type: 'move' | 'rotate' | 'scale' | 'select' | 'deselect' | 'attack' | 'spell' | 'ability';
  tokenId: string;
  userId: string;
  data: any;
  timestamp: Date;
}

export class TokenManager extends EventEmitter {
  private tokens: Map<string, Token> = new Map();
  private selectedTokens: Set<string> = new Set();
  private dragState: {
    isDragging: boolean;
    tokenId?: string;
    startPosition?: { x: number; y: number };
    currentPosition?: { x: number; y: number };
  } = { isDragging: false };

  constructor() {
    super();
    this.setMaxListeners(100);
  }

  /**
   * Create a new token
   */
  createToken(tokenData: Omit<Token, 'id' | 'createdAt' | 'updatedAt'>): Token {
    const token: Token = {
      ...tokenData,
      id: this.generateTokenId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.tokens.set(token.id, token);
    this.emit('tokenCreated', token);
    logger.info(`Token created: ${token.id} (${token.name})`);
    
    return token;
  }

  /**
   * Update an existing token
   */
  updateToken(update: TokenUpdate): boolean {
    const token = this.tokens.get(update.id);
    if (!token) {
      logger.warn(`Attempted to update non-existent token: ${update.id}`);
      return false;
    }

    if (token.locked && update.userId !== token.ownerId) {
      logger.warn(`User ${update.userId} attempted to update locked token ${update.id}`);
      return false;
    }

    const updatedToken: Token = {
      ...token,
      ...update.changes,
      updatedAt: update.timestamp,
    };

    this.tokens.set(update.id, updatedToken);
    this.emit('tokenUpdated', updatedToken, update);
    logger.debug(`Token updated: ${update.id}`);
    
    return true;
  }

  /**
   * Delete a token
   */
  deleteToken(tokenId: string, userId: string): boolean {
    const token = this.tokens.get(tokenId);
    if (!token) {
      return false;
    }

    if (token.locked && userId !== token.ownerId) {
      logger.warn(`User ${userId} attempted to delete locked token ${tokenId}`);
      return false;
    }

    this.tokens.delete(tokenId);
    this.selectedTokens.delete(tokenId);
    this.emit('tokenDeleted', tokenId, token);
    logger.info(`Token deleted: ${tokenId}`);
    
    return true;
  }

  /**
   * Get a token by ID
   */
  getToken(tokenId: string): Token | undefined {
    return this.tokens.get(tokenId);
  }

  /**
   * Get all tokens
   */
  getAllTokens(): Token[] {
    return Array.from(this.tokens.values());
  }

  /**
   * Get tokens by layer
   */
  getTokensByLayer(layer: Token['layer']): Token[] {
    return this.getAllTokens().filter(token => token.layer === layer);
  }

  /**
   * Get visible tokens for a specific user
   */
  getVisibleTokens(userId: string): Token[] {
    return this.getAllTokens().filter(token => {
      if (token.visibility === 'visible') return true;
      if (token.visibility === 'hidden' && token.ownerId === userId) return true;
      return false;
    });
  }

  /**
   * Select tokens
   */
  selectTokens(tokenIds: string[], userId: string): void {
    const validTokens = tokenIds.filter(id => this.tokens.has(id));
    this.selectedTokens.clear();
    validTokens.forEach(id => this.selectedTokens.add(id));
    
    this.emit('tokensSelected', validTokens, userId);
    logger.debug(`Tokens selected: ${validTokens.join(', ')}`);
  }

  /**
   * Get selected tokens
   */
  getSelectedTokens(): string[] {
    return Array.from(this.selectedTokens);
  }

  /**
   * Start dragging a token
   */
  startDrag(tokenId: string, position: { x: number; y: number }, userId: string): boolean {
    const token = this.tokens.get(tokenId);
    if (!token || (token.locked && token.ownerId !== userId)) {
      return false;
    }

    this.dragState = {
      isDragging: true,
      tokenId,
      startPosition: position,
      currentPosition: position,
    };

    this.emit('dragStart', tokenId, position, userId);
    return true;
  }

  /**
   * Update drag position
   */
  updateDrag(position: { x: number; y: number }, userId: string): boolean {
    if (!this.dragState.isDragging || !this.dragState.tokenId) {
      return false;
    }

    this.dragState.currentPosition = position;
    this.emit('dragUpdate', this.dragState.tokenId, position, userId);
    return true;
  }

  /**
   * End dragging and update token position
   */
  endDrag(position: { x: number; y: number }, userId: string): boolean {
    if (!this.dragState.isDragging || !this.dragState.tokenId) {
      return false;
    }

    const tokenId = this.dragState.tokenId;
    const token = this.tokens.get(tokenId);
    
    if (token) {
      const update: TokenUpdate = {
        id: tokenId,
        changes: {
          position: { ...token.position, x: position.x, y: position.y },
        },
        userId,
        timestamp: new Date(),
      };
      
      this.updateToken(update);
    }

    this.dragState = { isDragging: false };
    this.emit('dragEnd', tokenId, position, userId);
    return true;
  }

  /**
   * Handle token interaction
   */
  handleInteraction(interaction: TokenInteraction): boolean {
    const token = this.tokens.get(interaction.tokenId);
    if (!token) {
      return false;
    }

    this.emit('tokenInteraction', interaction);
    logger.debug(`Token interaction: ${interaction.type} on ${interaction.tokenId}`);
    
    switch (interaction.type) {
      case 'move':
        return this.handleMoveInteraction(interaction);
      case 'rotate':
        return this.handleRotateInteraction(interaction);
      case 'scale':
        return this.handleScaleInteraction(interaction);
      case 'attack':
        return this.handleAttackInteraction(interaction);
      default:
        return true;
    }
  }

  /**
   * Get tokens within a specific area
   */
  getTokensInArea(area: { x: number; y: number; width: number; height: number }): Token[] {
    return this.getAllTokens().filter(token => {
      return token.position.x >= area.x &&
             token.position.x <= area.x + area.width &&
             token.position.y >= area.y &&
             token.position.y <= area.y + area.height;
    });
  }

  /**
   * Calculate distance between two tokens
   */
  getDistance(tokenId1: string, tokenId2: string): number | null {
    const token1 = this.tokens.get(tokenId1);
    const token2 = this.tokens.get(tokenId2);
    
    if (!token1 || !token2) {
      return null;
    }

    const dx = token2.position.x - token1.position.x;
    const dy = token2.position.y - token1.position.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private generateTokenId(): string {
    return `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private handleMoveInteraction(interaction: TokenInteraction): boolean {
    const { x, y } = interaction.data;
    const update: TokenUpdate = {
      id: interaction.tokenId,
      changes: {
        position: { x, y, z: this.tokens.get(interaction.tokenId)?.position.z || 0 },
      },
      userId: interaction.userId,
      timestamp: interaction.timestamp,
    };
    return this.updateToken(update);
  }

  private handleRotateInteraction(interaction: TokenInteraction): boolean {
    const { rotation } = interaction.data;
    const update: TokenUpdate = {
      id: interaction.tokenId,
      changes: { rotation },
      userId: interaction.userId,
      timestamp: interaction.timestamp,
    };
    return this.updateToken(update);
  }

  private handleScaleInteraction(interaction: TokenInteraction): boolean {
    const { scale } = interaction.data;
    const update: TokenUpdate = {
      id: interaction.tokenId,
      changes: { scale },
      userId: interaction.userId,
      timestamp: interaction.timestamp,
    };
    return this.updateToken(update);
  }

  private handleAttackInteraction(interaction: TokenInteraction): boolean {
    // Emit attack event for combat system to handle
    this.emit('tokenAttack', interaction);
    return true;
  }
}
