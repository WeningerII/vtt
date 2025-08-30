import { logger } from '@vtt/logging';

/**
 * Advanced Token Management System
 * Handles token properties, conditions, animations, and behaviors
 */

export type TokenType = 'character' | 'npc' | 'object' | 'effect' | 'marker';

export interface TokenProperties {
  // Core Properties
  hp?: { current: number; max: number; temp?: number };
  ac?: number;
  speed?: number;
  
  // D&D 5e Attributes
  attributes?: {
    strength?: number;
    dexterity?: number;
    constitution?: number;
    intelligence?: number;
    wisdom?: number;
    charisma?: number;
  };
  
  // Saves and Skills
  savingThrows?: Record<string, number>;
  skills?: Record<string, number>;
  proficiencyBonus?: number;
  
  // Combat
  initiative?: number;
  initiativeBonus?: number;
  
  // Vision and Senses
  darkvision?: number;
  blindsight?: number;
  truesight?: number;
  passivePerception?: number;
  
  // Resistances and Immunities
  damageResistances?: string[];
  damageImmunities?: string[];
  damageVulnerabilities?: string[];
  conditionImmunities?: string[];
  
  // Custom Properties
  custom?: Record<string, any>;
}

export interface TokenCondition {
  id: string;
  name: string;
  description: string;
  type: 'buff' | 'debuff' | 'neutral';
  duration?: number; // rounds, -1 for permanent
  concentration?: boolean;
  sourceId?: string; // ID of the token/spell that applied this
  effects?: ConditionEffect[];
  stackable?: boolean;
  suppressedBy?: string[]; // condition names that suppress this
  icon?: string;
}

export interface ConditionEffect {
  type: 'attribute' | 'save' | 'skill' | 'damage' | 'ac' | 'speed' | 'custom';
  target: string;
  modifier: number;
  operation: 'add' | 'multiply' | 'set' | 'advantage' | 'disadvantage';
}

export interface TokenAnimation {
  id: string;
  type: 'move' | 'attack' | 'spell' | 'damage' | 'heal' | 'custom';
  duration: number;
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  properties: AnimationKeyframe[];
  loop?: boolean;
  autoRemove?: boolean;
}

export interface AnimationKeyframe {
  time: number; // 0-1 representing progress
  x?: number;
  y?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  opacity?: number;
  color?: string;
}

export interface Token {
  // Basic Properties
  id: string;
  name: string;
  sceneId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  
  // Visual Properties
  imageUrl?: string;
  color?: string;
  opacity?: number;
  scaleX?: number;
  scaleY?: number;
  
  // Type and Layer
  tokenType: TokenType;
  layer: string;
  zIndex?: number;
  
  // State
  isVisible: boolean;
  isLocked?: boolean;
  isSelected?: boolean;
  
  // Game Properties
  properties: TokenProperties;
  conditions: TokenCondition[];
  
  // Ownership and Permissions
  ownerId?: string;
  controlledBy: string[];
  visibleTo: string[];
  
  // Metadata
  notes?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export class TokenManager {
  private tokens: Map<string, Token> = new Map();
  private animations: Map<string, TokenAnimation> = new Map();
  private activeAnimations: Map<string, { tokenId: string; animation: TokenAnimation; startTime: number }> = new Map();
  private changeListeners: Array<(_event: TokenChangeEvent) => void> = [];
  
  // Token CRUD Operations
  addToken(token: Token): void {
    this.tokens.set(token.id, {
      ...token,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    this.emitChange({ type: 'token-added', data: token });
  }

  removeToken(tokenId: string): void {
    const token = this.tokens.get(tokenId);
    if (token) {
      this.tokens.delete(tokenId);
      // Remove any active animations for this token
      this.stopAnimations(tokenId);
      this.emitChange({ type: 'token-removed', data: { id: tokenId, token } });
    }
  }

  updateToken(tokenId: string, updates: Partial<Token>): void {
    const token = this.tokens.get(tokenId);
    if (!token) {
      throw new Error(`Token ${tokenId} not found`);
    }

    const updatedToken = {
      ...token,
      ...updates,
      id: tokenId, // Ensure ID doesn't change
      updatedAt: new Date()
    };

    this.tokens.set(tokenId, updatedToken);
    this.emitChange({ 
      type: 'token-updated', 
      data: { id: tokenId, oldToken: token, newToken: updatedToken } 
    });
  }

  getToken(tokenId: string): Token | undefined {
    return this.tokens.get(tokenId);
  }

  getTokensInScene(sceneId: string): Token[] {
    return Array.from(this.tokens.values()).filter(token => token.sceneId === sceneId);
  }

  getTokensByType(tokenType: TokenType): Token[] {
    return Array.from(this.tokens.values()).filter(token => token.tokenType === tokenType);
  }

  // Position and Movement
  moveToken(tokenId: string, x: number, y: number, animate: boolean = false): void {
    const token = this.tokens.get(tokenId);
    if (!token) {
      throw new Error(`Token ${tokenId} not found`);
    }

    if (animate) {
      this.animateTokenMovement(tokenId, token.x, token.y, x, y);
    }

    this.updateToken(tokenId, { x, y });
  }

  private animateTokenMovement(tokenId: string, fromX: number, fromY: number, toX: number, toY: number): void {
    const animation: TokenAnimation = {
      id: `move-${tokenId}-${Date.now()}`,
      type: 'move',
      duration: 500, // ms
      easing: 'ease-out',
      properties: [
        { time: 0, x: fromX, y: fromY },
        { time: 1, x: toX, y: toY }
      ],
      autoRemove: true
    };

    this.playAnimation(tokenId, animation);
  }

  rotateToken(tokenId: string, rotation: number): void {
    this.updateToken(tokenId, { rotation });
  }

  scaleToken(tokenId: string, scaleX: number, scaleY: number = scaleX): void {
    this.updateToken(tokenId, { scaleX, scaleY });
  }

  // Properties Management
  updateTokenProperties(tokenId: string, properties: Partial<TokenProperties>): void {
    const token = this.tokens.get(tokenId);
    if (!token) {
      throw new Error(`Token ${tokenId} not found`);
    }

    const updatedProperties = { ...token.properties, ...properties };
    this.updateToken(tokenId, { properties: updatedProperties });
  }

  getTokenProperty(tokenId: string, propertyPath: string): any {
    const token = this.tokens.get(tokenId);
    if (!token) return undefined;

    const paths = propertyPath.split('.');
    let value: any = token.properties;
    
    for (const path of paths) {
      if (value && typeof value === 'object') {
        value = value[path];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  setTokenProperty(tokenId: string, propertyPath: string, value: any): void {
    const token = this.tokens.get(tokenId);
    if (!token) {
      throw new Error(`Token ${tokenId} not found`);
    }

    const paths = propertyPath.split('.');
    const properties = { ...token.properties };
    let current: any = properties;

    for (let i = 0; i < paths.length - 1; i++) {
      const path = paths[i];
      if (!path) continue; // Skip undefined paths
      
      if (!(path in current)) {
        current[path] = {};
      }
      current = current[path];
    }

    const lastPath = paths[paths.length - 1];
    if (lastPath) {
      current[lastPath] = value;
    }
    this.updateToken(tokenId, { properties });
  }

  // Condition Management
  addCondition(tokenId: string, condition: TokenCondition): void {
    const token = this.tokens.get(tokenId);
    if (!token) {
      throw new Error(`Token ${tokenId} not found`);
    }

    const conditions = [...token.conditions];
    
    // Check if condition is stackable
    if (!condition.stackable) {
      const existingIndex = conditions.findIndex(c => c.name === condition.name);
      if (existingIndex !== -1) {
        conditions[existingIndex] = condition;
      } else {
        conditions.push(condition);
      }
    } else {
      conditions.push(condition);
    }

    this.updateToken(tokenId, { conditions });
    this.emitChange({ type: 'condition-added', data: { tokenId, condition } });
  }

  removeCondition(tokenId: string, conditionId: string): void {
    const token = this.tokens.get(tokenId);
    if (!token) {
      throw new Error(`Token ${tokenId} not found`);
    }

    const conditions = token.conditions.filter(c => c.id !== conditionId);
    this.updateToken(tokenId, { conditions });
    this.emitChange({ type: 'condition-removed', data: { tokenId, conditionId } });
  }

  updateCondition(tokenId: string, conditionId: string, updates: Partial<TokenCondition>): void {
    const token = this.tokens.get(tokenId);
    if (!token) {
      throw new Error(`Token ${tokenId} not found`);
    }

    const conditions = token.conditions.map(c => 
      c.id === conditionId ? { ...c, ...updates } : c
    );

    this.updateToken(tokenId, { conditions });
    this.emitChange({ type: 'condition-updated', data: { tokenId, conditionId, updates } });
  }

  getActiveConditions(tokenId: string): TokenCondition[] {
    const token = this.tokens.get(tokenId);
    if (!token) return [];

    return token.conditions.filter(condition => {
      // Check if condition is suppressed
      const suppressedBy = condition.suppressedBy || [];
      const hasSuppressingCondition = suppressedBy.some(suppressorName =>
        token.conditions.some(c => c.name === suppressorName)
      );

      return !hasSuppressingCondition;
    });
  }

  // Calculated Properties (with conditions applied)
  getCalculatedProperty(tokenId: string, propertyPath: string): any {
    const token = this.tokens.get(tokenId);
    if (!token) return undefined;

    const baseValue = this.getTokenProperty(tokenId, propertyPath);
    if (baseValue === undefined) return undefined;

    const activeConditions = this.getActiveConditions(tokenId);
    let calculatedValue = baseValue;

    for (const condition of activeConditions) {
      if (!condition.effects) continue;

      for (const effect of condition.effects) {
        if (effect.target === propertyPath) {
          switch (effect.operation) {
            case 'add':
              if (typeof calculatedValue === 'number') {
                calculatedValue += effect.modifier;
              }
              break;
            case 'multiply':
              if (typeof calculatedValue === 'number') {
                calculatedValue *= effect.modifier;
              }
              break;
            case 'set':
              calculatedValue = effect.modifier;
              break;
          }
        }
      }
    }

    return calculatedValue;
  }

  // Animation System
  playAnimation(tokenId: string, animation: TokenAnimation): void {
    const token = this.tokens.get(tokenId);
    if (!token) {
      throw new Error(`Token ${tokenId} not found`);
    }

    this.animations.set(animation.id, animation);
    this.activeAnimations.set(animation.id, {
      tokenId,
      animation,
      startTime: Date.now()
    });

    this.emitChange({ type: 'animation-started', data: { tokenId, animation } });

    // Set up animation completion
    if (!animation.loop) {
      setTimeout(() => {
        this.stopAnimation(animation.id);
      }, animation.duration);
    }
  }

  stopAnimation(animationId: string): void {
    const activeAnimation = this.activeAnimations.get(animationId);
    if (activeAnimation) {
      this.activeAnimations.delete(animationId);
      this.animations.delete(animationId);
      
      this.emitChange({ 
        type: 'animation-stopped', 
        data: { tokenId: activeAnimation.tokenId, animationId } 
      });
    }
  }

  stopAnimations(tokenId: string): void {
    const animationsToStop = Array.from(this.activeAnimations.entries())
      .filter(([_, anim]) => anim.tokenId === tokenId)
      .map(([id]) => id);

    animationsToStop.forEach(id => this.stopAnimation(id));
  }

  getActiveAnimations(tokenId: string): TokenAnimation[] {
    return Array.from(this.activeAnimations.values())
      .filter(anim => anim.tokenId === tokenId)
      .map(anim => anim.animation);
  }

  // Damage and Healing
  applyDamage(tokenId: string, amount: number, damageType?: string): void {
    const token = this.tokens.get(tokenId);
    if (!token || !token.properties.hp) {
      throw new Error(`Token ${tokenId} not found or has no HP`);
    }

    let actualDamage = amount;

    // Apply resistances and immunities
    if (damageType && token.properties.damageResistances?.includes(damageType)) {
      actualDamage = Math.floor(actualDamage / 2);
    }
    if (damageType && token.properties.damageImmunities?.includes(damageType)) {
      actualDamage = 0;
    }
    if (damageType && token.properties.damageVulnerabilities?.includes(damageType)) {
      actualDamage = actualDamage * 2;
    }

    const newHP = Math.max(0, token.properties.hp.current - actualDamage);
    
    this.updateTokenProperties(tokenId, {
      hp: { ...token.properties.hp, current: newHP }
    });

    // Play damage animation
    if (actualDamage > 0) {
      this.playDamageAnimation(tokenId, actualDamage);
    }

    this.emitChange({ 
      type: 'damage-applied', 
      data: { tokenId, amount: actualDamage, damageType: damageType || 'physical' } 
    });
  }

  applyHealing(tokenId: string, amount: number): void {
    const token = this.tokens.get(tokenId);
    if (!token || !token.properties.hp) {
      throw new Error(`Token ${tokenId} not found or has no HP`);
    }

    const newHP = Math.min(token.properties.hp.max, token.properties.hp.current + amount);
    
    this.updateTokenProperties(tokenId, {
      hp: { ...token.properties.hp, current: newHP }
    });

    // Play healing animation
    this.playHealingAnimation(tokenId, amount);

    this.emitChange({ 
      type: 'healing-applied', 
      data: { tokenId, amount } 
    });
  }

  private playDamageAnimation(tokenId: string, _damage: number): void {
    const animation: TokenAnimation = {
      id: `damage-${tokenId}-${Date.now()}`,
      type: 'damage',
      duration: 600,
      easing: 'ease-out',
      properties: [
        { time: 0, color: '#ff0000', scaleX: 1.1, scaleY: 1.1 },
        { time: 0.3, color: '#ff4444', scaleX: 1.0, scaleY: 1.0 },
        { time: 1, scaleX: 1.0, scaleY: 1.0 }
      ],
      autoRemove: true
    };

    this.playAnimation(tokenId, animation);
  }

  private playHealingAnimation(tokenId: string, _healing: number): void {
    const animation: TokenAnimation = {
      id: `heal-${tokenId}-${Date.now()}`,
      type: 'heal',
      duration: 800,
      easing: 'ease-out',
      properties: [
        { time: 0, color: '#00ff00', scaleX: 1.05, scaleY: 1.05 },
        { time: 0.5, color: '#44ff44', scaleX: 1.0, scaleY: 1.0 },
        { time: 1, scaleX: 1.0, scaleY: 1.0 }
      ],
      autoRemove: true
    };

    this.playAnimation(tokenId, animation);
  }

  // Event System
  addChangeListener(listener: (event: TokenChangeEvent) => void): void {
    this.changeListeners.push(listener);
  }

  removeChangeListener(listener: (event: TokenChangeEvent) => void): void {
    const index = this.changeListeners.indexOf(listener);
    if (index > -1) {
      this.changeListeners.splice(index, 1);
    }
  }

  private emitChange(event: TokenChangeEvent): void {
    this.changeListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        logger.error('Token change listener error:', error);
      }
    });
  }

  // Utility Methods
  getAllTokens(): Token[] {
    return Array.from(this.tokens.values());
  }

  getTokenCount(): number {
    return this.tokens.size;
  }

  clearScene(sceneId: string): void {
    const tokensToRemove = Array.from(this.tokens.values())
      .filter(token => token.sceneId === sceneId)
      .map(token => token.id);

    tokensToRemove.forEach(tokenId => this.removeToken(tokenId));
  }

  // Export/Import
  exportTokens(): Token[] {
    return Array.from(this.tokens.values());
  }

  importTokens(tokens: Token[]): void {
    tokens.forEach(token => {
      this.tokens.set(token.id, token);
    });
  }
}

// Event Types
export type TokenChangeEvent =
  | { type: 'token-added'; data: Token }
  | { type: 'token-removed'; data: { id: string; token?: Token } }
  | { type: 'token-updated'; data: { id: string; oldToken?: Token; newToken?: Token } }
  | { type: 'condition-added'; data: { tokenId: string; condition: TokenCondition } }
  | { type: 'condition-removed'; data: { tokenId: string; conditionId: string } }
  | { type: 'condition-updated'; data: { tokenId: string; conditionId: string; updates: Partial<TokenCondition> } }
  | { type: 'animation-started'; data: { tokenId: string; animation: TokenAnimation } }
  | { type: 'animation-stopped'; data: { tokenId: string; animationId: string } }
  | { type: 'damage-applied'; data: { tokenId: string; amount: number; damageType?: string } }
  | { type: 'healing-applied'; data: { tokenId: string; amount: number } };
