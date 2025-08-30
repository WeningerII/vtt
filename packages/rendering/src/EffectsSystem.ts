import { logger } from "@vtt/logging";

/**
 * Visual Effects System
 * Handles particle effects, spell animations, and visual enhancements
 */

export interface Effect {
  id: string;
  type: "particle" | "animation" | "shader" | "overlay";
  position: { x: number; y: number; z?: number };
  scale: { x: number; y: number };
  rotation: number;
  opacity: number;
  duration: number; // ms, -1 for infinite
  startTime: number;
  isActive: boolean;

  // Animation properties
  animations: EffectAnimation[];

  // Rendering properties
  blendMode: "normal" | "add" | "multiply" | "screen" | "overlay";
  renderOrder: number;

  // Targeting
  targetId?: string; // Token or object ID
  followTarget?: boolean;

  // Spell/combat specific
  spellName?: string;
  damageType?: string;

  // Event callbacks
  onStart?: () => void;
  onUpdate?: (_progress: number) => void;
  onComplete?: () => void;
}

export interface ParticleEffect extends Effect {
  type: "particle";
  particleSystem: {
    maxParticles: number;
    emissionRate: number;
    lifetime: { min: number; max: number };
    velocity: {
      initial: { x: number; y: number };
      variation: { x: number; y: number };
    };
    acceleration: { x: number; y: number };
    size: {
      initial: { min: number; max: number };
      final: { min: number; max: number };
    };
    color: {
      initial: { r: number; g: number; b: number; a: number };
      final: { r: number; g: number; b: number; a: number };
    };
    texture?: string;
    shape: "circle" | "square" | "triangle" | "star";
  };
}

export interface AnimationEffect extends Effect {
  type: "animation";
  spriteSheet: {
    texture: string;
    frameWidth: number;
    frameHeight: number;
    frameCount: number;
    fps: number;
    loop: boolean;
  };
}

export interface ShaderEffect extends Effect {
  type: "shader";
  shaderName: string;
  uniforms: Record<string, any>;
}

export interface OverlayEffect extends Effect {
  type: "overlay";
  texture: string;
  tiling: { x: number; y: number };
  scrollSpeed: { x: number; y: number };
}

export interface EffectAnimation {
  property: "position" | "scale" | "rotation" | "opacity" | "color";
  from: any;
  to: any;
  duration: number;
  delay: number;
  easing: "linear" | "ease-in" | "ease-out" | "ease-in-out" | "bounce" | "elastic";
  repeat: number; // -1 for infinite
  yoyo: boolean;
}

export interface EffectTemplate {
  id: string;
  name: string;
  category: "spell" | "weapon" | "environmental" | "ui";
  description: string;
  createEffect: (_position: { x: number; y: number }, _options?: any) => Effect;
  previewImage?: string;
}

export class EffectsSystem {
  private effects: Map<string, Effect> = new Map();
  private templates: Map<string, EffectTemplate> = new Map();
  private updateInterval: ReturnType<typeof setTimeout> | null = null;
  private lastUpdate: number = 0;
  private changeListeners: Array<(_event: EffectsEvent) => void> = [];

  constructor() {
    this.initializeDefaultTemplates();
    this.startUpdateLoop();
  }

  /**
   * Create effect from template
   */
  createEffect(templateId: string, position: { x: number; y: number }, options: any = {}): string {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Effect template '${templateId}' not found`);
    }

    const effect = template.createEffect(position, options);
    effect.startTime = Date.now();

    this.effects.set(effect.id, effect);

    if (effect.onStart) {
      effect.onStart();
    }

    this.emitEvent({
      type: "effect-created",
      data: { effectId: effect.id, effect },
    });

    return effect.id;
  }

  /**
   * Create custom effect
   */
  createCustomEffect(effect: Effect): string {
    effect.startTime = Date.now();
    this.effects.set(effect.id, effect);

    if (effect.onStart) {
      effect.onStart();
    }

    this.emitEvent({
      type: "effect-created",
      data: { effectId: effect.id, effect },
    });

    return effect.id;
  }

  /**
   * Remove effect
   */
  removeEffect(effectId: string): void {
    const effect = this.effects.get(effectId);
    if (effect) {
      if (effect.onComplete) {
        effect.onComplete();
      }

      this.effects.delete(effectId);

      this.emitEvent({
        type: "effect-removed",
        data: { effectId, effect },
      });
    }
  }

  /**
   * Update effect properties
   */
  updateEffect(effectId: string, updates: Partial<Effect>): void {
    const effect = this.effects.get(effectId);
    if (effect) {
      Object.assign(effect, updates);

      this.emitEvent({
        type: "effect-updated",
        data: { effectId, effect, updates },
      });
    }
  }

  /**
   * Get all active effects
   */
  getActiveEffects(): Effect[] {
    return Array.from(this.effects.values()).filter((effect) => effect.isActive);
  }

  /**
   * Get effects by type
   */
  getEffectsByType(type: Effect["type"]): Effect[] {
    return Array.from(this.effects.values()).filter((effect) => effect.type === type);
  }

  /**
   * Get effects targeting specific entity
   */
  getEffectsByTarget(targetId: string): Effect[] {
    return Array.from(this.effects.values()).filter((effect) => effect.targetId === targetId);
  }

  private startUpdateLoop(): void {
    this.updateInterval = setInterval(() => {
      this.updateEffects();
    }, 16); // ~60 FPS
  }

  private updateEffects(): void {
    const currentTime = Date.now();
    const _deltaTime = currentTime - this.lastUpdate;
    this.lastUpdate = currentTime;

    const effectsToRemove: string[] = [];

    for (const [effectId, effect] of this.effects.entries()) {
      if (!effect.isActive) continue;

      const elapsed = currentTime - effect.startTime;
      const progress = effect.duration > 0 ? Math.min(1, elapsed / effect.duration) : 0;

      // Update animations
      this.updateEffectAnimations(effect, elapsed);

      // Call update callback
      if (effect.onUpdate) {
        effect.onUpdate(progress);
      }

      // Check if effect should be removed
      if (effect.duration > 0 && elapsed >= effect.duration) {
        effectsToRemove.push(effectId);
      }
    }

    // Remove completed effects
    effectsToRemove.forEach((effectId) => {
      this.removeEffect(effectId);
    });

    if (effectsToRemove.length > 0 || this.effects.size > 0) {
      this.emitEvent({
        type: "effects-updated",
        data: { activeCount: this.effects.size, removedCount: effectsToRemove.length },
      });
    }
  }

  private updateEffectAnimations(effect: Effect, elapsed: number): void {
    for (const animation of effect.animations) {
      if (elapsed < animation.delay) continue;

      const animationElapsed = elapsed - animation.delay;
      const animationDuration = animation.duration;

      if (animationElapsed >= animationDuration && animation.repeat !== -1) continue;

      let progress = Math.min(1, animationElapsed / animationDuration);

      // Apply easing
      progress = this.applyEasing(progress, animation.easing);

      // Handle yoyo
      if (animation.yoyo && Math.floor(animationElapsed / animationDuration) % 2 === 1) {
        progress = 1 - progress;
      }

      // Interpolate value
      const value = this.interpolateValue(animation.from, animation.to, progress);

      // Apply to effect property
      this.setEffectProperty(effect, animation.property, value);
    }
  }

  private applyEasing(t: number, easing: EffectAnimation["easing"]): number {
    switch (easing) {
      case "linear":
        return t;
      case "ease-in":
        return t * t;
      case "ease-out":
        return 1 - Math.pow(1 - t, 2);
      case "ease-in-out":
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      case "bounce":
        if (t < 1 / 2.75) return 7.5625 * t * t;
        if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
        if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
        return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
      case "elastic": {
        const c4 = (2 * Math.PI) / 3;
        return t === 0
          ? 0
          : t === 1
            ? 1
            : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
      }
      default:
        return t;
    }
  }

  private interpolateValue(from: any, to: any, progress: number): any {
    if (typeof from === "number" && typeof to === "number") {
      return from + (to - from) * progress;
    }

    if (typeof from === "object" && typeof to === "object") {
      const result: any = {};
      for (const key in from) {
        if (typeof from[key] === "number" && typeof to[key] === "number") {
          result[key] = from[key] + (to[key] - from[key]) * progress;
        } else {
          result[key] = progress < 0.5 ? from[key] : to[key];
        }
      }
      return result;
    }

    return progress < 0.5 ? from : to;
  }

  private setEffectProperty(
    effect: Effect,
    property: EffectAnimation["property"],
    value: any,
  ): void {
    switch (property) {
      case "position":
        effect.position = value;
        break;
      case "scale":
        effect.scale = value;
        break;
      case "rotation":
        effect.rotation = value;
        break;
      case "opacity":
        effect.opacity = value;
        break;
      // Color and other complex properties would be handled here
    }
  }

  private initializeDefaultTemplates(): void {
    // Fireball spell effect
    this.templates.set("fireball", {
      id: "fireball",
      name: "Fireball",
      category: "spell",
      description: "Explosive fireball with particle trail",
      createEffect: (position, _options) =>
        ({
          id: `fireball-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: "particle",
          position: { ...position },
          scale: { x: 1, y: 1 },
          rotation: 0,
          opacity: 1,
          duration: 2000,
          startTime: 0,
          isActive: true,
          animations: [
            {
              property: "scale",
              from: { x: 0.1, y: 0.1 },
              to: { x: 2, y: 2 },
              duration: 500,
              delay: 0,
              easing: "ease-out",
              repeat: 0,
              yoyo: false,
            },
            {
              property: "opacity",
              from: 1,
              to: 0,
              duration: 1500,
              delay: 500,
              easing: "ease-out",
              repeat: 0,
              yoyo: false,
            },
          ],
          blendMode: "add",
          renderOrder: 100,
          spellName: "Fireball",
          damageType: "fire",
          particleSystem: {
            maxParticles: 50,
            emissionRate: 25,
            lifetime: { min: 0.5, max: 1.5 },
            velocity: {
              initial: { x: 0, y: 0 },
              variation: { x: 100, y: 100 },
            },
            acceleration: { x: 0, y: 50 },
            size: {
              initial: { min: 2, max: 8 },
              final: { min: 0, max: 2 },
            },
            color: {
              initial: { r: 1, g: 0.8, b: 0.2, a: 1 },
              final: { r: 1, g: 0.2, b: 0, a: 0 },
            },
            shape: "circle",
          },
        }) as ParticleEffect,
    });

    // Lightning bolt effect
    this.templates.set("lightning", {
      id: "lightning",
      name: "Lightning Bolt",
      category: "spell",
      description: "Electric lightning strike",
      createEffect: (position, options) =>
        ({
          id: `lightning-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: "animation",
          position: { ...position },
          scale: { x: 1, y: 1 },
          rotation: options.rotation || 0,
          opacity: 1,
          duration: 800,
          startTime: 0,
          isActive: true,
          animations: [
            {
              property: "opacity",
              from: 0,
              to: 1,
              duration: 100,
              delay: 0,
              easing: "linear",
              repeat: 0,
              yoyo: false,
            },
            {
              property: "opacity",
              from: 1,
              to: 0,
              duration: 200,
              delay: 600,
              easing: "ease-out",
              repeat: 0,
              yoyo: false,
            },
          ],
          blendMode: "add",
          renderOrder: 110,
          spellName: "Lightning Bolt",
          damageType: "lightning",
          spriteSheet: {
            texture: "lightning_bolt.png",
            frameWidth: 64,
            frameHeight: 256,
            frameCount: 8,
            fps: 24,
            loop: false,
          },
        }) as AnimationEffect,
    });

    // Healing aura
    this.templates.set("heal", {
      id: "heal",
      name: "Healing Light",
      category: "spell",
      description: "Gentle healing radiance",
      createEffect: (position, _options) =>
        ({
          id: `heal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: "particle",
          position: { ...position },
          scale: { x: 1, y: 1 },
          rotation: 0,
          opacity: 0.8,
          duration: 3000,
          startTime: 0,
          isActive: true,
          animations: [
            {
              property: "scale",
              from: { x: 0.5, y: 0.5 },
              to: { x: 1.5, y: 1.5 },
              duration: 1500,
              delay: 0,
              easing: "ease-in-out",
              repeat: 0,
              yoyo: false,
            },
          ],
          blendMode: "add",
          renderOrder: 50,
          spellName: "Cure Wounds",
          particleSystem: {
            maxParticles: 30,
            emissionRate: 10,
            lifetime: { min: 1, max: 2 },
            velocity: {
              initial: { x: 0, y: -20 },
              variation: { x: 20, y: 10 },
            },
            acceleration: { x: 0, y: -10 },
            size: {
              initial: { min: 1, max: 4 },
              final: { min: 0, max: 1 },
            },
            color: {
              initial: { r: 1, g: 1, b: 0.8, a: 0.8 },
              final: { r: 0.8, g: 1, b: 0.6, a: 0 },
            },
            shape: "star",
          },
        }) as ParticleEffect,
    });

    // Sword swing effect
    this.templates.set("sword_slash", {
      id: "sword_slash",
      name: "Sword Slash",
      category: "weapon",
      description: "Melee weapon slash effect",
      createEffect: (position, options) =>
        ({
          id: `slash-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: "animation",
          position: { ...position },
          scale: { x: 1, y: 1 },
          rotation: options.rotation || 0,
          opacity: 1,
          duration: 600,
          startTime: 0,
          isActive: true,
          animations: [
            {
              property: "scale",
              from: { x: 0.3, y: 0.3 },
              to: { x: 1.2, y: 1.2 },
              duration: 300,
              delay: 0,
              easing: "ease-out",
              repeat: 0,
              yoyo: false,
            },
            {
              property: "opacity",
              from: 1,
              to: 0,
              duration: 300,
              delay: 300,
              easing: "ease-in",
              repeat: 0,
              yoyo: false,
            },
          ],
          blendMode: "normal",
          renderOrder: 80,
          spriteSheet: {
            texture: "slash_effect.png",
            frameWidth: 128,
            frameHeight: 128,
            frameCount: 6,
            fps: 20,
            loop: false,
          },
        }) as AnimationEffect,
    });
  }

  /**
   * Register custom effect template
   */
  registerTemplate(template: EffectTemplate): void {
    this.templates.set(template.id, template);

    this.emitEvent({
      type: "template-registered",
      data: { templateId: template.id, template },
    });
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
  getTemplatesByCategory(category: EffectTemplate["category"]): EffectTemplate[] {
    return Array.from(this.templates.values()).filter((template) => template.category === category);
  }

  /**
   * Clear all effects
   */
  clearAllEffects(): void {
    const removedCount = this.effects.size;
    this.effects.clear();

    this.emitEvent({
      type: "all-effects-cleared",
      data: { removedCount },
    });
  }

  /**
   * Cleanup
   */
  dispose(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.clearAllEffects();
    this.changeListeners = [];
  }

  // Event system
  addEventListener(_listener: (event: EffectsEvent) => void): void {
    this.changeListeners.push(_listener);
  }

  removeEventListener(_listener: (event: EffectsEvent) => void): void {
    const index = this.changeListeners.indexOf(_listener);
    if (index > -1) {
      this.changeListeners.splice(index, 1);
    }
  }

  private emitEvent(event: EffectsEvent): void {
    this.changeListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        logger.error("Effects event listener error:", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }
}

// Event types
export type EffectsEvent =
  | { type: "effect-created"; data: { effectId: string; effect: Effect } }
  | { type: "effect-removed"; data: { effectId: string; effect: Effect } }
  | { type: "effect-updated"; data: { effectId: string; effect: Effect; updates: Partial<Effect> } }
  | { type: "effects-updated"; data: { activeCount: number; removedCount: number } }
  | { type: "template-registered"; data: { templateId: string; template: EffectTemplate } }
  | { type: "all-effects-cleared"; data: { removedCount: number } };
