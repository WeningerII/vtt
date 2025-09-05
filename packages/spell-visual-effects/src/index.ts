/**
 * Spell Visual Effects Integration System
 * Connects spell casting to visual and audio effects for immersive gameplay
 */

import { EventEmitter } from "events";
export * from "./PhysicsVisualBridge";

export interface VisualEffect {
  id: string;
  type: "particle" | "mesh" | "light" | "shockwave" | "beam" | "aura" | "animation" | "explosion";
  spellId: string;
  duration: number;

  // Positioning
  position?: { x: number; y: number; z?: number };
  targetPosition?: { x: number; y: number; z?: number };
  followEntity?: string; // Entity ID to follow

  // Visual properties
  color?: string;
  intensity?: number;
  scale?: number;
  opacity?: number;

  // Animation properties
  animationType?: "fade" | "grow" | "pulse" | "rotate" | "travel" | "explosion";
  animationDuration?: number;
  easing?: "linear" | "ease-in" | "ease-out" | "bounce";

  // Particle-specific
  particleCount?: number;
  particleSpread?: number;
  particleVelocity?: { x: number; y: number; z?: number };

  // Cleanup
  autoDestroy?: boolean;
  fadeOut?: boolean;
}

export interface AudioEffect {
  id: string;
  type: "sfx" | "voice" | "ambient";
  spellId: string;
  audioFile: string;

  // Audio properties
  volume?: number;
  pitch?: number;
  delay?: number;
  loop?: boolean;

  // Spatial audio
  position?: { x: number; y: number; z?: number };
  maxDistance?: number;
  rolloffFactor?: number;
}

export interface VisualEffectTemplate {
  type: "particle" | "mesh" | "light" | "shockwave" | "beam" | "aura" | "animation" | "explosion";
  duration?: number;
  
  // Visual properties  
  color?: string;
  intensity?: number;
  scale?: number;
  opacity?: number;

  // Animation properties
  animationType?: "fade" | "grow" | "pulse" | "rotate" | "travel" | "explosion";
  animationDuration?: number;
  easing?: "linear" | "ease-in" | "ease-out" | "bounce";

  // Particle-specific
  particleCount?: number;
  particleSpread?: number;
  particleVelocity?: { x: number; y: number; z?: number };

  // Cleanup
  autoDestroy?: boolean;
  fadeOut?: boolean;
}

export interface SpellVisualTemplate {
  spellId: string;
  spellName: string;
  visualEffects: Partial<VisualEffect>[];
  audioEffects: Partial<AudioEffect>[];

  // Timing
  castingEffects?: VisualEffectTemplate[]; // During casting
  projectileEffects?: VisualEffectTemplate[]; // For projectile spells
  impactEffects?: VisualEffectTemplate[]; // On impact/effect
  persistentEffects?: VisualEffectTemplate[]; // Duration effects
}

export class SpellVisualEffectsManager extends EventEmitter {
  private activeEffects: Map<string, VisualEffect> = new Map();
  private activeAudio: Map<string, AudioEffect> = new Map();
  private spellTemplates: Map<string, SpellVisualTemplate> = new Map();
  private effectIdCounter = 0;

  constructor() {
    super();
    this.setupDefaultSpellTemplates();
  }

  /**
   * Register a spell visual template
   */
  registerSpellTemplate(template: SpellVisualTemplate): void {
    this.spellTemplates.set(template.spellId, template);
    this.emit("templateRegistered", template.spellId);
  }

  /**
   * Trigger spell casting effects
   */
  triggerSpellCasting(
    spellId: string,
    casterId: string,
    position: { x: number; y: number; z?: number },
    duration: number = 1000,
  ): string[] {
    const template = this.spellTemplates.get(spellId);
    if (!template?.castingEffects) {return [];}

    const effectIds: string[] = [];

    for (const effectTemplate of template.castingEffects) {
      const { type, duration: templateDuration, ...templateRest } = effectTemplate;
      const effect: VisualEffect = {
        id: this.generateEffectId(),
        spellId,
        duration: templateDuration || duration,
        position,
        followEntity: casterId,
        type,
        ...templateRest,
      };

      this.activeEffects.set(effect.id, effect);
      effectIds.push(effect.id);

      this.emit("effectCreated", effect);
    }

    // Auto-cleanup casting effects
    setTimeout(() => {
      effectIds.forEach((id) => this.destroyEffect(id));
    }, duration);

    return effectIds;
  }

  /**
   * Trigger projectile spell effects
   */
  triggerProjectileEffect(
    spellId: string,
    startPosition: { x: number; y: number; z?: number },
    endPosition: { x: number; y: number; z?: number },
    travelTime: number = 1000,
  ): string[] {
    const template = this.spellTemplates.get(spellId);
    if (!template?.projectileEffects) {return [];}

    const effectIds: string[] = [];

    for (const effectTemplate of template.projectileEffects) {
      const { type, ...templateRest } = effectTemplate;
      const effect: VisualEffect = {
        id: this.generateEffectId(),
        spellId,
        duration: travelTime,
        position: startPosition,
        targetPosition: endPosition,
        animationType: "travel",
        animationDuration: travelTime,
        type: type || "beam",
        ...templateRest,
      };

      this.activeEffects.set(effect.id, effect);
      effectIds.push(effect.id);

      this.emit("effectCreated", effect);
    }

    return effectIds;
  }

  /**
   * Trigger spell impact effects
   */
  triggerSpellImpact(
    spellId: string,
    impactPosition: { x: number; y: number; z?: number },
    targets: string[] = [],
  ): string[] {
    const template = this.spellTemplates.get(spellId);
    if (!template?.impactEffects) {return [];}

    const effectIds: string[] = [];

    for (const effectTemplate of template.impactEffects) {
      // Create effect at impact position
      const { type, ...templateRest } = effectTemplate;
      const mainEffect: VisualEffect = {
        id: this.generateEffectId(),
        spellId,
        duration: effectTemplate.duration || 1000,
        position: impactPosition,
        animationType: effectTemplate.animationType || "explosion",
        type: type || "explosion",
        ...templateRest,
      };

      this.activeEffects.set(mainEffect.id, mainEffect);
      effectIds.push(mainEffect.id);
      this.emit("effectCreated", mainEffect);

      // Create effects on targets if specified
      targets.forEach((targetId) => {
        const { type, ...templateRest } = effectTemplate;
        const targetEffect: VisualEffect = {
          id: this.generateEffectId(),
          spellId,
          duration: effectTemplate.duration || 1000,
          followEntity: targetId,
          type: type || "aura",
          scale: (effectTemplate.scale || 1.0) * 0.7, // Smaller for individual targets
          ...templateRest,
        };

        this.activeEffects.set(targetEffect.id, targetEffect);
        effectIds.push(targetEffect.id);
        this.emit("effectCreated", targetEffect);
      });
    }

    return effectIds;
  }

  /**
   * Create persistent spell effects (e.g., concentration spells)
   */
  createPersistentEffect(spellId: string, entityId: string, duration: number): string[] {
    const template = this.spellTemplates.get(spellId);
    if (!template?.persistentEffects) {return [];}

    const effectIds: string[] = [];

    for (const effectTemplate of template.persistentEffects) {
      const { type, duration: templateDuration, ...templateRest } = effectTemplate;
      const effect: VisualEffect = {
        id: this.generateEffectId(),
        spellId,
        duration: templateDuration || duration,
        followEntity: entityId,
        autoDestroy: true,
        fadeOut: true,
        type: type || "aura",
        ...templateRest,
      };

      this.activeEffects.set(effect.id, effect);
      effectIds.push(effect.id);

      this.emit("effectCreated", effect);

      // Schedule cleanup
      setTimeout(() => {
        this.destroyEffect(effect.id, true); // With fade out
      }, duration);
    }

    return effectIds;
  }

  /**
   * Play spell audio effects
   */
  playSpellAudio(spellId: string, position?: { x: number; y: number; z?: number }): string[] {
    const template = this.spellTemplates.get(spellId);
    if (!template?.audioEffects) {return [];}

    const audioIds: string[] = [];

    for (const audioTemplate of template.audioEffects) {
      const { type, ...audioTemplateRest } = audioTemplate;
      const audio: AudioEffect = {
        id: this.generateEffectId(),
        spellId,
        audioFile: audioTemplate.audioFile || `spells/${spellId}.mp3`,
        type: type || "sfx",
        ...(position && { position }),
        ...audioTemplateRest,
      };

      this.activeAudio.set(audio.id, audio);
      audioIds.push(audio.id);

      this.emit("audioCreated", audio);
    }

    return audioIds;
  }

  /**
   * Update effect position (for following entities)
   */
  updateEffectPosition(entityId: string, position: { x: number; y: number; z?: number }): void {
    for (const effect of this.activeEffects.values()) {
      if (effect.followEntity === entityId) {
        effect.position = position;
        this.emit("effectUpdated", effect);
      }
    }
  }

  /**
   * Destroy effect
   */
  destroyEffect(effectId: string, fadeOut: boolean = false): void {
    const effect = this.activeEffects.get(effectId);
    if (!effect) {return;}

    if (fadeOut && effect.fadeOut) {
      // Trigger fade out animation
      effect.animationType = "fade";
      effect.animationDuration = 500;
      this.emit("effectUpdated", effect);

      setTimeout(() => {
        this.activeEffects.delete(effectId);
        this.emit("effectDestroyed", effectId);
      }, 500);
    } else {
      this.activeEffects.delete(effectId);
      this.emit("effectDestroyed", effectId);
    }
  }

  /**
   * Destroy all effects for a spell
   */
  destroySpellEffects(spellId: string): void {
    const effectsToDestroy = Array.from(this.activeEffects.values()).filter(
      (effect) => effect.spellId === spellId,
    );

    effectsToDestroy.forEach((effect) => {
      this.destroyEffect(effect.id, true);
    });
  }

  /**
   * Get active effects
   */
  getActiveEffects(): VisualEffect[] {
    return Array.from(this.activeEffects.values());
  }

  /**
   * Get effects for a specific spell
   */
  getSpellEffects(spellId: string): VisualEffect[] {
    return Array.from(this.activeEffects.values()).filter((effect) => effect.spellId === spellId);
  }

  /**
   * Generate unique effect ID
   */
  private generateEffectId(): string {
    return `effect_${++this.effectIdCounter}_${Date.now()}`;
  }

  /**
   * Setup default spell visual templates
   */
  private setupDefaultSpellTemplates(): void {
    // Magic Missile
    this.registerSpellTemplate({
      spellId: "magic_missile",
      spellName: "Magic Missile",
      visualEffects: [],
      audioEffects: [{ audioFile: "spells/magic_missile_cast.mp3", type: "sfx", volume: 0.8 }],
      castingEffects: [
        {
          type: "particle",
          color: "#4A90E2",
          particleCount: 20,
          duration: 800,
          animationType: "pulse",
        },
      ],
      projectileEffects: [
        {
          type: "beam",
          color: "#4A90E2",
          intensity: 1.5,
          animationType: "travel",
        },
      ],
      impactEffects: [
        {
          type: "explosion",
          color: "#4A90E2",
          duration: 300,
          scale: 0.5,
          animationType: "explosion",
        },
      ],
    });

    // Fireball
    this.registerSpellTemplate({
      spellId: "fireball",
      spellName: "Fireball",
      visualEffects: [],
      audioEffects: [
        { audioFile: "spells/fireball_cast.mp3", type: "sfx", volume: 1.0 },
        { audioFile: "spells/fireball_explosion.mp3", type: "sfx", volume: 1.2, delay: 1000 },
      ],
      castingEffects: [
        {
          type: "particle",
          color: "#FF6B35",
          particleCount: 50,
          duration: 1000,
          animationType: "grow",
        },
      ],
      projectileEffects: [
        {
          type: "mesh",
          color: "#FF6B35",
          scale: 1.0,
          animationType: "travel",
        },
      ],
      impactEffects: [
        {
          type: "explosion",
          color: "#FF6B35",
          duration: 800,
          scale: 4.0,
          particleCount: 100,
          animationType: "explosion",
        },
        {
          type: "shockwave",
          color: "#FF4500",
          duration: 1200,
          scale: 6.0,
          opacity: 0.6,
        },
      ],
    });

    // Healing Word
    this.registerSpellTemplate({
      spellId: "healing_word",
      spellName: "Healing Word",
      visualEffects: [],
      audioEffects: [{ audioFile: "spells/healing_cast.mp3", type: "voice", volume: 0.7 }],
      castingEffects: [
        {
          type: "light",
          color: "#50C878",
          intensity: 2.0,
          duration: 500,
          animationType: "pulse",
        },
      ],
      impactEffects: [
        {
          type: "aura",
          color: "#50C878",
          duration: 2000,
          scale: 1.5,
          animationType: "pulse",
          opacity: 0.7,
        },
        {
          type: "particle",
          color: "#90EE90",
          particleCount: 30,
          duration: 1500,
          particleVelocity: { x: 0, y: 0.1, z: 0 },
        },
      ],
    });

    // Shield
    this.registerSpellTemplate({
      spellId: "shield",
      spellName: "Shield",
      visualEffects: [],
      audioEffects: [{ audioFile: "spells/shield_cast.mp3", type: "sfx", volume: 0.8 }],
      castingEffects: [
        {
          type: "light",
          color: "#7B68EE",
          intensity: 1.5,
          duration: 300,
          animationType: "grow",
        },
      ],
      persistentEffects: [
        {
          type: "aura",
          color: "#7B68EE",
          scale: 1.2,
          opacity: 0.3,
          animationType: "pulse",
        },
      ],
    });

    // Web
    this.registerSpellTemplate({
      spellId: "web",
      spellName: "Web",
      visualEffects: [],
      audioEffects: [{ audioFile: "spells/web_cast.mp3", type: "sfx", volume: 0.9 }],
      castingEffects: [
        {
          type: "particle",
          color: "#8B7355",
          particleCount: 25,
          duration: 800,
          animationType: "grow",
        },
      ],
      impactEffects: [
        {
          type: "mesh",
          color: "#D2B48C",
          scale: 3.0,
          duration: 60000, // 1 minute
          opacity: 0.8,
        },
      ],
      persistentEffects: [
        {
          type: "animation",
          animationType: "pulse",
          duration: 60000,
          opacity: 0.6,
        },
      ],
    });

    // Misty Step
    this.registerSpellTemplate({
      spellId: "misty_step",
      spellName: "Misty Step",
      visualEffects: [],
      audioEffects: [{ audioFile: "spells/teleport.mp3", type: "sfx", volume: 0.9 }],
      castingEffects: [
        {
          type: "particle",
          color: "#C8A2C8",
          particleCount: 40,
          duration: 500,
          animationType: "fade",
        },
      ],
      impactEffects: [
        {
          type: "particle",
          color: "#C8A2C8",
          particleCount: 40,
          duration: 800,
          animationType: "grow",
        },
      ],
    });
  }

  /**
   * Clean up expired effects
   */
  update(currentTime: number): void {
    for (const [effectId, effect] of this.activeEffects.entries()) {
      if (effect.autoDestroy && currentTime > (effect as any).createdAt + effect.duration) {
        this.destroyEffect(effectId, true);
      }
    }
  }
}

export const _createSpellVisualEffectsManager = (): SpellVisualEffectsManager => {
  return new SpellVisualEffectsManager();
};
