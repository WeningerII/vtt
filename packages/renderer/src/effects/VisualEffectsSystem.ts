import { EventEmitter } from 'events';
import { logger } from '@vtt/logging';

export interface VisualEffect {
  id: string;
  name: string;
  type: 'particle' | 'animation' | 'shader' | 'sprite' | 'mesh';
  position: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  duration: number; // milliseconds, -1 for infinite
  startTime: Date;
  endTime?: Date;
  
  // Visual properties
  color: { r: number; g: number; b: number; a: number };
  blendMode: 'normal' | 'additive' | 'multiply' | 'screen';
  zIndex: number;
  
  // Animation properties
  loop: boolean;
  autoDestroy: boolean;
  fadeIn: number;
  fadeOut: number;
  
  // Targeting
  targetId?: string;
  followTarget: boolean;
  attachToTarget: boolean;
  
  // Gameplay properties
  affectsGameplay: boolean;
  blocksVision: boolean;
  blocksMovement: boolean;
  
  // Effect-specific data
  data: any;
}

export interface ParticleSystemConfig {
  maxParticles: number;
  emissionRate: number;
  lifetime: { min: number; max: number };
  velocity: { 
    x: { min: number; max: number };
    y: { min: number; max: number };
    z: { min: number; max: number };
  };
  acceleration: { x: number; y: number; z: number };
  size: { start: number; end: number };
  color: {
    start: { r: number; g: number; b: number; a: number };
    end: { r: number; g: number; b: number; a: number };
  };
  texture?: string;
  shape: 'point' | 'sphere' | 'box' | 'cone';
  gravity: number;
  wind: { x: number; y: number; z: number };
}

export interface AnimationKeyframe {
  time: number; // 0-1
  position?: { x: number; y: number; z: number };
  scale?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  color?: { r: number; g: number; b: number; a: number };
  data?: any;
}

export interface EffectTemplate {
  id: string;
  name: string;
  category: 'spell' | 'weapon' | 'environment' | 'ui' | 'ambient';
  description: string;
  config: Partial<VisualEffect>;
  particleConfig?: ParticleSystemConfig;
  keyframes?: AnimationKeyframe[];
  sounds?: string[];
}

export class VisualEffectsSystem extends EventEmitter {
  private effects: Map<string, VisualEffect> = new Map();
  private templates: Map<string, EffectTemplate> = new Map();
  private animationFrame: number | null = null;
  private lastUpdateTime: number = 0;

  constructor() {
    super();
    this.setMaxListeners(100);
    this.initializeTemplates();
    this.startUpdateLoop();
  }

  /**
   * Create a visual effect from template
   */
  createEffect(
    templateId: string,
    position: { x: number; y: number; z: number },
    options?: {
      targetId?: string;
      duration?: number;
      scale?: number;
      color?: { r: number; g: number; b: number; a: number };
      data?: any;
    }
  ): string | null {
    const template = this.templates.get(templateId);
    if (!template) {
      logger.warn(`Effect template not found: ${templateId}`);
      return null;
    }

    const effect: VisualEffect = {
      id: this.generateEffectId(),
      name: template.name,
      type: template.config.type || 'particle',
      position,
      scale: template.config.scale || { x: 1, y: 1, z: 1 },
      rotation: template.config.rotation || { x: 0, y: 0, z: 0 },
      duration: options?.duration || template.config.duration || 1000,
      startTime: new Date(),
      color: options?.color || template.config.color || { r: 1, g: 1, b: 1, a: 1 },
      blendMode: template.config.blendMode || 'normal',
      zIndex: template.config.zIndex || 0,
      loop: template.config.loop || false,
      autoDestroy: template.config.autoDestroy !== false,
      fadeIn: template.config.fadeIn || 0,
      fadeOut: template.config.fadeOut || 0,
      targetId: options?.targetId ?? '',
      followTarget: template.config.followTarget || false,
      attachToTarget: template.config.attachToTarget || false,
      affectsGameplay: template.config.affectsGameplay || false,
      blocksVision: template.config.blocksVision || false,
      blocksMovement: template.config.blocksMovement || false,
      data: { ...template.config.data, ...options?.data },
    };

    // Apply scale override
    if (options?.scale) {
      effect.scale.x *= options.scale;
      effect.scale.y *= options.scale;
      effect.scale.z *= options.scale;
    }

    // Set end time if not infinite
    if (effect.duration > 0) {
      effect.endTime = new Date(effect.startTime.getTime() + effect.duration);
    }

    this.effects.set(effect.id, effect);
    this.emit('effectCreated', effect);
    logger.debug(`Visual effect created: ${effect.name} (${effect.id})`);

    return effect.id;
  }

  /**
   * Create a custom effect
   */
  createCustomEffect(config: Omit<VisualEffect, 'id' | 'startTime'>): string {
    const effect: VisualEffect = {
      ...config,
      id: this.generateEffectId(),
      startTime: new Date(),
    };

    if (effect.duration > 0) {
      effect.endTime = new Date(effect.startTime.getTime() + effect.duration);
    }

    this.effects.set(effect.id, effect);
    this.emit('effectCreated', effect);
    logger.debug(`Custom visual effect created: ${effect.name} (${effect.id})`);

    return effect.id;
  }

  /**
   * Remove an effect
   */
  removeEffect(effectId: string): boolean {
    const effect = this.effects.get(effectId);
    if (!effect) {
      return false;
    }

    this.effects.delete(effectId);
    this.emit('effectRemoved', effectId, effect);
    logger.debug(`Visual effect removed: ${effectId}`);

    return true;
  }

  /**
   * Update effect properties
   */
  updateEffect(effectId: string, updates: Partial<VisualEffect>): boolean {
    const effect = this.effects.get(effectId);
    if (!effect) {
      return false;
    }

    Object.assign(effect, updates);
    this.emit('effectUpdated', effect);

    return true;
  }

  /**
   * Get effect by ID
   */
  getEffect(effectId: string): VisualEffect | undefined {
    return this.effects.get(effectId);
  }

  /**
   * Get all active effects
   */
  getAllEffects(): VisualEffect[] {
    return Array.from(this.effects.values());
  }

  /**
   * Get effects by type
   */
  getEffectsByType(type: VisualEffect['type']): VisualEffect[] {
    return Array.from(this.effects.values()).filter(effect => effect.type === type);
  }

  /**
   * Get effects attached to a target
   */
  getEffectsForTarget(targetId: string): VisualEffect[] {
    return Array.from(this.effects.values()).filter(effect => effect.targetId === targetId);
  }

  /**
   * Create spell effect
   */
  createSpellEffect(
    spellName: string,
    casterPosition: { x: number; y: number; z: number },
    targetPosition?: { x: number; y: number; z: number },
    targetId?: string
  ): string[] {
    const effectIds: string[] = [];

    switch (spellName.toLowerCase()) {
      case 'fireball': {
        // Launch effect
        const launchId = this.createEffect('fire_projectile', casterPosition, {
          targetId: targetId ?? '',
          data: { targetPosition },
        });
        if (launchId) {effectIds.push(launchId);}

        // Explosion effect (delayed)
        if (targetPosition) {
          setTimeout(() => {
            const explosionId = this.createEffect('fire_explosion', targetPosition, {
              scale: 2.0,
            });
            if (explosionId) {effectIds.push(explosionId);}
          }, 1000);
        }
        break;
      }

      case 'magic missile': {
        // Multiple missile effects
        for (let i = 0; i < 3; i++) {
          setTimeout(() => {
            const missileId = this.createEffect('magic_missile', casterPosition, {
              targetId: targetId ?? '',
              data: { delay: i * 200 },
            });
            if (missileId) {effectIds.push(missileId);}
          }, i * 200);
        }
        break;
      }

      case 'healing word': {
        const healId = this.createEffect('healing_sparkles', targetPosition || casterPosition, {
          targetId: targetId ?? '',
          duration: 2000,
        });
        if (healId) {effectIds.push(healId);}
        break;
      }

      case 'shield': {
        const shieldId = this.createEffect('magical_shield', casterPosition, {
          targetId: targetId ?? '',
          duration: 6000, // 1 round
        });
        if (shieldId) {effectIds.push(shieldId);}
        break;
      }

      default: {
        // Generic spell effect
        const genericId = this.createEffect('generic_spell', casterPosition, {
          targetId: targetId ?? '',
        });
        if (genericId) {effectIds.push(genericId);}
        break;
      }
    }

    return effectIds;
  }

  /**
   * Create weapon attack effect
   */
  createWeaponEffect(
    weaponType: string,
    attackerPosition: { x: number; y: number; z: number },
    targetPosition: { x: number; y: number; z: number },
    hit: boolean
  ): string[] {
    const effectIds: string[] = [];

    // Impact effect
    const impactTemplate = hit ? 'weapon_hit' : 'weapon_miss';
    const impactId = this.createEffect(impactTemplate, targetPosition);
    if (impactId) {effectIds.push(impactId);}

    // Weapon-specific effects
    switch (weaponType.toLowerCase()) {
      case 'sword':
      case 'longsword':
      case 'shortsword': {
        const slashId = this.createEffect('sword_slash', attackerPosition, {
          data: { targetPosition },
        });
        if (slashId) {effectIds.push(slashId);}
        break;
      }

      case 'bow':
      case 'longbow':
      case 'shortbow': {
        const arrowId = this.createEffect('arrow_trail', attackerPosition, {
          data: { targetPosition },
        });
        if (arrowId) {effectIds.push(arrowId);}
        break;
      }

      case 'staff':
      case 'wand': {
        const magicId = this.createEffect('magic_bolt', attackerPosition, {
          data: { targetPosition },
        });
        if (magicId) {effectIds.push(magicId);}
        break;
      }
    }

    return effectIds;
  }

  /**
   * Create environmental effect
   */
  createEnvironmentalEffect(
    type: 'rain' | 'snow' | 'fog' | 'wind' | 'fire' | 'smoke',
    area: { x: number; y: number; width: number; height: number },
    intensity: number = 1.0
  ): string {
    const position = {
      x: area.x + area.width / 2,
      y: area.y + area.height / 2,
      z: 0,
    };

    const templateMap = {
      rain: 'weather_rain',
      snow: 'weather_snow',
      fog: 'weather_fog',
      wind: 'weather_wind',
      fire: 'environment_fire',
      smoke: 'environment_smoke',
    };

    const effectId = this.createEffect(templateMap[type], position, {
      scale: intensity,
      duration: -1, // Infinite
      data: { area },
    });

    return effectId || '';
  }

  /**
   * Create area of effect indicator
   */
  createAOEIndicator(
    shape: 'circle' | 'square' | 'cone' | 'line',
    position: { x: number; y: number; z: number },
    size: number,
    color: { r: number; g: number; b: number; a: number } = { r: 1, g: 0, b: 0, a: 0.3 }
  ): string {
    const templateMap = {
      circle: 'aoe_circle',
      square: 'aoe_square',
      cone: 'aoe_cone',
      line: 'aoe_line',
    };

    const effectId = this.createEffect(templateMap[shape], position, {
      scale: size,
      color,
      duration: -1, // Infinite until removed
    });

    return effectId || '';
  }

  /**
   * Add effect template
   */
  addTemplate(template: EffectTemplate): void {
    this.templates.set(template.id, template);
    this.emit('templateAdded', template);
    logger.debug(`Effect template added: ${template.id}`);
  }

  /**
   * Get all templates
   */
  getTemplates(): EffectTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(category: EffectTemplate['category']): EffectTemplate[] {
    return Array.from(this.templates.values()).filter(template => template.category === category);
  }

  private startUpdateLoop(): void {
    const update = (currentTime: number) => {
      const deltaTime = currentTime - this.lastUpdateTime;
      this.lastUpdateTime = currentTime;

      this.updateEffects(deltaTime);
      this.animationFrame = requestAnimationFrame(update);
    };

    this.animationFrame = requestAnimationFrame(update);
  }

  private updateEffects(deltaTime: number): void {
    const now = new Date();
    const effectsToRemove: string[] = [];

    for (const [effectId, effect] of this.effects.entries()) {
      // Check if effect should be removed
      if (effect.endTime && now >= effect.endTime && effect.autoDestroy) {
        effectsToRemove.push(effectId);
        continue;
      }

      // Update effect properties based on time
      this.updateEffectAnimation(effect, now);

      // Update position if following target
      if (effect.followTarget && effect.targetId) {
        this.updateEffectTargetPosition(effect);
      }
    }

    // Remove expired effects
    effectsToRemove.forEach(effectId => {
      this.removeEffect(effectId);
    });

    if (effectsToRemove.length > 0 || this.effects.size > 0) {
      this.emit('effectsUpdated', Array.from(this.effects.values()));
    }
  }

  private updateEffectAnimation(effect: VisualEffect, currentTime: Date): void {
    const elapsed = currentTime.getTime() - effect.startTime.getTime();
    const progress = effect.duration > 0 ? Math.min(1, elapsed / effect.duration) : 0;

    // Apply fade in/out
    let alpha = effect.color.a;
    if (effect.fadeIn > 0 && elapsed < effect.fadeIn) {
      alpha *= elapsed / effect.fadeIn;
    }
    if (effect.fadeOut > 0 && effect.endTime) {
      const timeUntilEnd = effect.endTime.getTime() - currentTime.getTime();
      if (timeUntilEnd < effect.fadeOut) {
        alpha *= timeUntilEnd / effect.fadeOut;
      }
    }

    // Update color alpha
    if (alpha !== effect.color.a) {
      effect.color.a = Math.max(0, Math.min(1, alpha));
      this.emit('effectUpdated', effect);
    }
  }

  private updateEffectTargetPosition(effect: VisualEffect): void {
    // This would integrate with the token system to get target position
    // For now, it's a placeholder
    this.emit('effectTargetPositionUpdate', effect);
  }

  private initializeTemplates(): void {
    const templates: EffectTemplate[] = [
      // Spell effects
      {
        id: 'fire_projectile',
        name: 'Fire Projectile',
        category: 'spell',
        description: 'A fiery projectile that travels to target',
        config: {
          type: 'particle',
          duration: 1000,
          color: { r: 1, g: 0.5, b: 0, a: 1 },
          blendMode: 'additive',
          followTarget: true,
        },
      },
      {
        id: 'fire_explosion',
        name: 'Fire Explosion',
        category: 'spell',
        description: 'A fiery explosion effect',
        config: {
          type: 'particle',
          duration: 2000,
          color: { r: 1, g: 0.3, b: 0, a: 0.8 },
          blendMode: 'additive',
          fadeOut: 500,
        },
      },
      {
        id: 'magic_missile',
        name: 'Magic Missile',
        category: 'spell',
        description: 'A glowing magical projectile',
        config: {
          type: 'particle',
          duration: 800,
          color: { r: 0.5, g: 0.5, b: 1, a: 1 },
          blendMode: 'additive',
          followTarget: true,
        },
      },
      {
        id: 'healing_sparkles',
        name: 'Healing Sparkles',
        category: 'spell',
        description: 'Gentle healing sparkles',
        config: {
          type: 'particle',
          duration: 3000,
          color: { r: 0.5, g: 1, b: 0.5, a: 0.7 },
          blendMode: 'additive',
          attachToTarget: true,
        },
      },
      {
        id: 'magical_shield',
        name: 'Magical Shield',
        category: 'spell',
        description: 'A protective magical barrier',
        config: {
          type: 'animation',
          duration: 6000,
          color: { r: 0.3, g: 0.3, b: 1, a: 0.5 },
          blendMode: 'normal',
          attachToTarget: true,
          loop: true,
        },
      },

      // Weapon effects
      {
        id: 'weapon_hit',
        name: 'Weapon Hit',
        category: 'weapon',
        description: 'Impact effect for successful weapon attacks',
        config: {
          type: 'particle',
          duration: 500,
          color: { r: 1, g: 1, b: 0, a: 0.8 },
          blendMode: 'additive',
        },
      },
      {
        id: 'weapon_miss',
        name: 'Weapon Miss',
        category: 'weapon',
        description: 'Effect for missed weapon attacks',
        config: {
          type: 'particle',
          duration: 300,
          color: { r: 0.5, g: 0.5, b: 0.5, a: 0.5 },
          blendMode: 'normal',
        },
      },
      {
        id: 'sword_slash',
        name: 'Sword Slash',
        category: 'weapon',
        description: 'Slashing motion effect',
        config: {
          type: 'animation',
          duration: 400,
          color: { r: 1, g: 1, b: 1, a: 0.8 },
          blendMode: 'normal',
        },
      },

      // Environmental effects
      {
        id: 'weather_rain',
        name: 'Rain',
        category: 'environment',
        description: 'Falling rain effect',
        config: {
          type: 'particle',
          duration: -1,
          color: { r: 0.7, g: 0.8, b: 1, a: 0.6 },
          blendMode: 'normal',
          loop: true,
        },
      },
      {
        id: 'environment_fire',
        name: 'Fire',
        category: 'environment',
        description: 'Flickering fire effect',
        config: {
          type: 'particle',
          duration: -1,
          color: { r: 1, g: 0.5, b: 0, a: 0.8 },
          blendMode: 'additive',
          loop: true,
          blocksVision: true,
        },
      },

      // AOE indicators
      {
        id: 'aoe_circle',
        name: 'Circular AOE',
        category: 'ui',
        description: 'Circular area of effect indicator',
        config: {
          type: 'sprite',
          duration: -1,
          color: { r: 1, g: 0, b: 0, a: 0.3 },
          blendMode: 'normal',
        },
      },
    ];

    templates.forEach(template => {
      this.templates.set(template.id, template);
    });

    logger.info(`Initialized ${templates.length} effect templates`);
  }

  private generateEffectId(): string {
    return `effect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  destroy(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    
    this.effects.clear();
    this.templates.clear();
  }
}
