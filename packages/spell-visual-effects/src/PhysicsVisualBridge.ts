/**
 * Physics-Visual Effects Bridge - 100% Integration
 * Connects spell physics results with real-time visual effects
 */

import { EventEmitter } from "events";
import type { PhysicsWorld, RigidBody, Vector2 } from "@vtt/physics";
import type { PhysicsSpellBridge, _SpellProjectile } from "@vtt/physics-spell-bridge";

export interface VisualEffect {
  id: string;
  type:
    | "projectile"
    | "explosion"
    | "beam"
    | "aura"
    | "particle_system"
    | "force_wave"
    | "teleport";
  position: Vector2;
  target?: Vector2;
  duration: number;
  properties: Record<string, any>;
  followPhysicsBody?: number;
  expiresAt: number;
}

export interface ProjectileVisualEffect extends VisualEffect {
  type: "projectile";
  physicsBodyId: number;
  trail: {
    enabled: boolean;
    length: number;
    color: string;
    fade: boolean;
  };
  impact: {
    effect: string;
    radius: number;
    duration: number;
  };
}

export interface ExplosionVisualEffect extends VisualEffect {
  type: "explosion";
  radius: number;
  shockwave: boolean;
  particles: {
    count: number;
    spread: number;
    speed: number;
    life: number;
  };
}

export interface BeamVisualEffect extends VisualEffect {
  type: "beam";
  width: number;
  intensity: number;
  color: string;
  flicker: boolean;
}

export class PhysicsVisualBridge extends EventEmitter {
  private physicsWorld: PhysicsWorld;
  private physicsSpellBridge: PhysicsSpellBridge;
  private activeEffects = new Map<string, VisualEffect>();
  private projectileEffects = new Map<string, ProjectileVisualEffect>();
  private physicsBodyToEffect = new Map<number, string>();

  constructor(physicsWorld: PhysicsWorld, physicsSpellBridge: PhysicsSpellBridge) {
    super();
    this.physicsWorld = physicsWorld;
    this.physicsSpellBridge = physicsSpellBridge;
    this.setupPhysicsIntegration();
  }

  /**
   * Create visual effect for spell casting
   */
  createSpellVisualEffect(
    spellId: string,
    spellName: string,
    school: string,
    casterPosition: Vector2,
    targetPosition?: Vector2,
    physicsEffects?: any[],
  ): string[] {
    const effectIds: string[] = [];

    // Base casting effect
    const castingEffect = this.createCastingEffect(spellId, spellName, school, casterPosition);
    effectIds.push(castingEffect.id);

    // School-specific effects
    const schoolEffect = this.createSchoolEffect(school, casterPosition, targetPosition);
    if (schoolEffect) effectIds.push(schoolEffect.id);

    // Physics-driven effects
    if (physicsEffects) {
      for (const physicsEffect of physicsEffects) {
        const visualEffect = this.createPhysicsVisualEffect(physicsEffect);
        if (visualEffect) effectIds.push(visualEffect.id);
      }
    }

    return effectIds;
  }

  /**
   * Create casting animation effect
   */
  private createCastingEffect(
    spellId: string,
    spellName: string,
    school: string,
    position: Vector2,
  ): VisualEffect {
    const effect: VisualEffect = {
      id: `casting_${spellId}_${Date.now()}`,
      type: "aura",
      position,
      duration: 1000,
      properties: {
        spell: spellName,
        school,
        color: this.getSchoolColor(school),
        intensity: 0.8,
        radius: 30,
        pulsing: true,
      },
      expiresAt: Date.now() + 1000,
    };

    this.activeEffects.set(effect.id, effect);
    this.emit("effectCreated", effect);
    return effect;
  }

  /**
   * Create school-specific visual effect
   */
  private createSchoolEffect(
    school: string,
    casterPos: Vector2,
    targetPos?: Vector2,
  ): VisualEffect | null {
    switch (school) {
      case "evocation":
        if (targetPos) {
          return this.createBeamEffect("evocation_beam", casterPos, targetPos, {
            color: "#FF4444",
            width: 5,
            intensity: 1.0,
            duration: 500,
          });
        }
        break;

      case "conjuration":
        if (targetPos) {
          return this.createTeleportEffect("conjuration_portal", casterPos, targetPos, 1500);
        }
        break;

      case "enchantment":
        return this.createAuraEffect("enchantment_mind", casterPos, {
          color: "#8A2BE2",
          radius: 40,
          duration: 2000,
          pulsing: true,
        });

      case "necromancy":
        return this.createAuraEffect("necromancy_dark", casterPos, {
          color: "#2F1B2B",
          radius: 35,
          duration: 1800,
          darkening: true,
        });

      case "transmutation":
        return this.createParticleEffect("transmutation_change", casterPos, {
          particles: 50,
          spread: 360,
          speed: 30,
          life: 1000,
          color: "#FFD700",
        });

      case "divination":
        return this.createAuraEffect("divination_sight", casterPos, {
          color: "#87CEEB",
          radius: 25,
          duration: 1200,
          shimmer: true,
        });

      case "illusion":
        return this.createAuraEffect("illusion_shimmer", casterPos, {
          color: "#FF69B4",
          radius: 30,
          duration: 1000,
          distortion: true,
        });

      case "abjuration":
        return this.createAuraEffect("abjuration_shield", casterPos, {
          color: "#4169E1",
          radius: 35,
          duration: 1500,
          protective: true,
        });
    }

    return null;
  }

  /**
   * Handle physics events and create visual effects
   */
  handlePhysicsEvent(event: PhysicsEvent): void {
    switch (event.type) {
      case "projectile_created":
        this.createProjectileEffect(event);
        break;
      case "projectile_hit":
        this.createImpactEffect(event);
        break;
      case "force_applied":
        this.createForceEffect(event);
        break;
      case "barrier_created":
        this.createBarrierEffect(event);
        break;
      case "teleport_effect":
        this.createTeleportEffect(event);
        break;
      case "constraint_applied":
        this.createConstraintEffect(event);
        break;
      case "area_effect":
        this.createAreaEffect(event);
        break;
      case "persistent_effect":
        this.createPersistentEffect(event);
        break;
      case "utility_effect":
        this.createUtilityEffect(event);
        break;
    }
  }

  /**
   * Create visual effect from physics effect
   */
  private createPhysicsVisualEffect(physicsEffect: any): VisualEffect | null {
    switch (physicsEffect.type) {
      case "projectile_created":
        return this.createProjectileVisualEffect(physicsEffect);

      case "force_applied":
        return this.createForceImpactEffect(physicsEffect);

      case "barrier_created":
        return this.createBarrierEffect(physicsEffect);

      case "teleported":
        return this.createTeleportEffect(
          `teleport_${Date.now()}`,
          physicsEffect.fromPosition,
          physicsEffect.toPosition,
          800,
        );

      case "constraint_applied":
        return this.createConstraintEffect(physicsEffect);

      default:
        return null;
    }
  }

  /**
   * Create projectile visual effect with physics tracking
   */
  private createProjectileVisualEffect(physicsEffect: any): ProjectileVisualEffect {
    const projectileEffect: ProjectileVisualEffect = {
      id: `projectile_${physicsEffect.projectileId}`,
      type: "projectile",
      position: { x: 0, y: 0 }, // Will be updated from physics body
      duration: 5000,
      physicsBodyId: physicsEffect.physicsBodyId || 0,
      followPhysicsBody: physicsEffect.physicsBodyId,
      trail: {
        enabled: true,
        length: 20,
        color: "#FFD700",
        fade: true,
      },
      impact: {
        effect: "explosion",
        radius: 15,
        duration: 500,
      },
      properties: {
        spellId: physicsEffect.spellId,
        glowing: true,
        size: 3,
      },
      expiresAt: Date.now() + 5000,
    };

    this.activeEffects.set(projectileEffect.id, projectileEffect);
    this.projectileEffects.set(projectileEffect.id, projectileEffect);
    this.physicsBodyToEffect.set(physicsEffect.physicsBodyId, projectileEffect.id);

    this.emit("projectileEffectCreated", projectileEffect);
    return projectileEffect;
  }

  /**
   * Create force impact visual effect
   */
  private createForceImpactEffect(physicsEffect: any): VisualEffect {
    const effect: VisualEffect = {
      id: `force_impact_${Date.now()}`,
      type: "force_wave",
      position: physicsEffect.position || { x: 0, y: 0 },
      duration: 800,
      properties: {
        force: physicsEffect.force,
        radius: Math.min(50, Math.abs(physicsEffect.force.x + physicsEffect.force.y) / 4),
        color: "#FFFFFF",
        intensity: 0.8,
        expanding: true,
      },
      expiresAt: Date.now() + 800,
    };

    this.activeEffects.set(effect.id, effect);
    this.emit("forceEffectCreated", effect);
    return effect;
  }

  /**
   * Create barrier visual effect
   */
  private createBarrierEffect(physicsEffect: any): VisualEffect {
    const effect: VisualEffect = {
      id: `barrier_${physicsEffect.barrierId}`,
      type: "aura",
      position: physicsEffect.position || { x: 0, y: 0 },
      duration: physicsEffect.duration || 60000,
      properties: {
        bodyIds: physicsEffect.bodyIds,
        color: "#4169E1",
        opacity: 0.3,
        shimmering: true,
        barrier: true,
      },
      expiresAt: Date.now() + (physicsEffect.duration || 60000),
    };

    this.activeEffects.set(effect.id, effect);
    this.emit("barrierEffectCreated", effect);
    return effect;
  }

  /**
   * Create constraint visual effect
   */
  private createConstraintEffect(physicsEffect: any): VisualEffect {
    let effectType: VisualEffect["type"] = "aura";
    let color = "#888888";

    switch (physicsEffect.constraint.type) {
      case "immobilize":
        color = "#FF0000";
        effectType = "aura";
        break;
      case "entangle":
        color = "#228B22";
        effectType = "particle_system";
        break;
      case "slow":
        color = "#4169E1";
        effectType = "aura";
        break;
    }

    const effect: VisualEffect = {
      id: `constraint_${physicsEffect.constraint.id}`,
      type: effectType,
      position: { x: 0, y: 0 }, // Will be updated from target
      duration: physicsEffect.constraint.duration,
      properties: {
        constraint: physicsEffect.constraint,
        targetId: physicsEffect.targetId,
        color,
        intensity: physicsEffect.constraint.strength,
        radius: 25,
      },
      expiresAt: physicsEffect.constraint.expiresAt,
    };

    this.activeEffects.set(effect.id, effect);
    this.emit("constraintEffectCreated", effect);
    return effect;
  }

  /**
   * Helper method to create beam effects
   */
  private createBeamEffect(
    id: string,
    start: Vector2,
    end: Vector2,
    properties: any,
  ): BeamVisualEffect {
    const effect: BeamVisualEffect = {
      id,
      type: "beam",
      position: start,
      target: end,
      duration: properties.duration || 1000,
      width: properties.width || 3,
      intensity: properties.intensity || 1.0,
      color: properties.color || "#FFFFFF",
      flicker: properties.flicker || false,
      properties,
      expiresAt: Date.now() + (properties.duration || 1000),
    };

    this.activeEffects.set(effect.id, effect);
    this.emit("beamEffectCreated", effect);
    return effect;
  }

  /**
   * Helper method to create teleport effects
   */
  private createTeleportEffect(
    id: string,
    start: Vector2,
    end: Vector2,
    duration: number,
  ): VisualEffect {
    const effect: VisualEffect = {
      id,
      type: "teleport",
      position: start,
      target: end,
      duration,
      properties: {
        startPortal: {
          radius: 20,
          color: "#8A2BE2",
          swirling: true,
        },
        endPortal: {
          radius: 20,
          color: "#8A2BE2",
          swirling: true,
        },
        connection: {
          visible: true,
          color: "#DDA0DD",
          pulsing: true,
        },
      },
      expiresAt: Date.now() + duration,
    };

    this.activeEffects.set(effect.id, effect);
    this.emit("teleportEffectCreated", effect);
    return effect;
  }

  /**
   * Helper method to create aura effects
   */
  private createAuraEffect(id: string, position: Vector2, properties: any): VisualEffect {
    const effect: VisualEffect = {
      id,
      type: "aura",
      position,
      duration: properties.duration || 1000,
      properties: {
        radius: properties.radius || 30,
        color: properties.color || "#FFFFFF",
        intensity: properties.intensity || 0.5,
        ...properties,
      },
      expiresAt: Date.now() + (properties.duration || 1000),
    };

    this.activeEffects.set(effect.id, effect);
    this.emit("auraEffectCreated", effect);
    return effect;
  }

  /**
   * Helper method to create particle effects
   */
  private createParticleEffect(id: string, position: Vector2, properties: any): VisualEffect {
    const effect: VisualEffect = {
      id,
      type: "particle_system",
      position,
      duration: properties.duration || properties.life || 1000,
      properties: {
        particles: properties.particles || 20,
        spread: properties.spread || 180,
        speed: properties.speed || 50,
        life: properties.life || 1000,
        color: properties.color || "#FFFFFF",
        ...properties,
      },
      expiresAt: Date.now() + (properties.duration || properties.life || 1000),
    };

    this.activeEffects.set(effect.id, effect);
    this.emit("particleEffectCreated", effect);
    return effect;
  }

  /**
   * Update visual effects (called each frame)
   */
  update(deltaTime: number): void {
    const now = Date.now();
    const expiredEffects: string[] = [];

    // Update all active effects
    for (const [effectId, effect] of this.activeEffects.entries()) {
      // Check expiration
      if (now > effect.expiresAt) {
        expiredEffects.push(effectId);
        continue;
      }

      // Update physics-following effects
      if (effect.followPhysicsBody !== undefined) {
        const body = this.physicsWorld.getBody(effect.followPhysicsBody);
        if (body) {
          effect.position.x = body.position.x;
          effect.position.y = body.position.y;
        }
      }

      // Update effect-specific properties
      this.updateEffectProperties(effect, deltaTime);
    }

    // Clean up expired effects
    for (const effectId of expiredEffects) {
      this.removeEffect(effectId);
    }
  }

  /**
   * Update effect-specific properties
   */
  private updateEffectProperties(effect: VisualEffect, _deltaTime: number): void {
    const elapsed = Date.now() - (effect.expiresAt - effect.duration);
    const progress = Math.min(1, elapsed / effect.duration);

    switch (effect.type) {
      case "aura":
        if (effect.properties.pulsing) {
          effect.properties.currentIntensity =
            effect.properties.intensity * (0.7 + 0.3 * Math.sin(elapsed * 0.005));
        }
        if (effect.properties.expanding) {
          effect.properties.currentRadius = effect.properties.radius * (0.5 + 0.5 * progress);
        }
        break;

      case "particle_system":
        // Particle systems naturally handle their own lifecycle
        break;

      case "beam":
        if (effect.properties.flicker) {
          effect.properties.currentIntensity =
            effect.properties.intensity * (0.8 + 0.2 * Math.random());
        }
        break;

      case "force_wave":
        if (effect.properties.expanding) {
          effect.properties.currentRadius = effect.properties.radius * progress;
          effect.properties.currentOpacity = 1.0 - progress;
        }
        break;
    }
  }

  /**
   * Remove visual effect
   */
  removeEffect(effectId: string): void {
    const effect = this.activeEffects.get(effectId);
    if (!effect) return;

    // Clean up physics body tracking
    if (effect.followPhysicsBody !== undefined) {
      this.physicsBodyToEffect.delete(effect.followPhysicsBody);
    }

    // Remove from collections
    this.activeEffects.delete(effectId);
    this.projectileEffects.delete(effectId);

    this.emit("effectRemoved", effectId, effect);
  }

  /**
   * Setup physics integration event handlers
   */
  private setupPhysicsIntegration(): void {
    // Listen for projectile hits
    this.physicsSpellBridge.on("projectileHit", (_projectileId: string, _targetId: string) => {
      const effectId = this.physicsBodyToEffect.get(parseInt(projectileId));
      if (effectId) {
        const effect = this.projectileEffects.get(effectId);
        if (effect) {
          // Create impact effect
          this.createImpactEffect(effect.position, effect.impact);
          // Remove projectile effect
          this.removeEffect(effectId);
        }
      }
    });

    // Listen for physics body removal
    this.physicsWorld.on("bodyRemoved", (body: RigidBody) => {
      const effectId = this.physicsBodyToEffect.get(body.id);
      if (effectId) {
        this.removeEffect(effectId);
      }
    });

    // Listen for barrier expiration
    this.physicsSpellBridge.on("barrierExpired", (_barrierId: string) => {
      const effectId = `barrier_${barrierId}`;
      this.removeEffect(effectId);
    });

    // Listen for constraint removal
    this.physicsSpellBridge.on("constraintRemoved", (_targetId: string, constraint: any) => {
      const effectId = `constraint_${constraint.id}`;
      this.removeEffect(effectId);
    });
  }

  /**
   * Create impact effect when projectile hits
   */
  private createImpactEffect(position: Vector2, impactConfig: any): void {
    switch (impactConfig.effect) {
      case "explosion":
        this.createExplosionEffect(position, impactConfig.radius, impactConfig.duration);
        break;
      case "splash":
        this.createSplashEffect(position, impactConfig.radius, impactConfig.duration);
        break;
      case "spark":
        this.createSparkEffect(position, impactConfig.duration);
        break;
    }
  }

  /**
   * Create explosion effect
   */
  private createExplosionEffect(position: Vector2, radius: number, duration: number): void {
    const explosion: ExplosionVisualEffect = {
      id: `explosion_${Date.now()}`,
      type: "explosion",
      position,
      duration,
      radius,
      shockwave: true,
      particles: {
        count: 30,
        spread: 360,
        speed: 80,
        life: duration * 0.8,
      },
      properties: {
        color: "#FF4500",
        intensity: 1.0,
      },
      expiresAt: Date.now() + duration,
    };

    this.activeEffects.set(explosion.id, explosion);
    this.emit("explosionEffectCreated", explosion);
  }

  /**
   * Create splash effect
   */
  private createSplashEffect(position: Vector2, radius: number, duration: number): void {
    this.createParticleEffect(`splash_${Date.now()}`, position, {
      particles: 15,
      spread: 180,
      speed: 40,
      life: duration,
      color: "#4169E1",
      gravity: true,
    });
  }

  /**
   * Create spark effect
   */
  private createSparkEffect(position: Vector2, duration: number): void {
    this.createParticleEffect(`spark_${Date.now()}`, position, {
      particles: 8,
      spread: 360,
      speed: 60,
      life: duration * 0.6,
      color: "#FFFF00",
      sparkling: true,
    });
  }

  /**
   * Get school color for visual effects
   */
  private getSchoolColor(school: string): string {
    switch (school) {
      case "evocation":
        return "#FF4444";
      case "conjuration":
        return "#8A2BE2";
      case "enchantment":
        return "#FF69B4";
      case "necromancy":
        return "#2F1B2B";
      case "transmutation":
        return "#FFD700";
      case "divination":
        return "#87CEEB";
      case "illusion":
        return "#FF1493";
      case "abjuration":
        return "#4169E1";
      default:
        return "#FFFFFF";
    }
  }

  /**
   * Get all active effects
   */
  getActiveEffects(): VisualEffect[] {
    return Array.from(this.activeEffects.values());
  }

  /**
   * Get effect by ID
   */
  getEffect(effectId: string): VisualEffect | undefined {
    return this.activeEffects.get(effectId);
  }

  /**
   * Clear all effects
   */
  clearAllEffects(): void {
    const effectIds = Array.from(this.activeEffects.keys());
    for (const effectId of effectIds) {
      this.removeEffect(effectId);
    }
  }

  /**
   * Get statistics
   */
  getStats(): {
    activeEffects: number;
    projectileEffects: number;
    physicsTrackedEffects: number;
  } {
    return {
      activeEffects: this.activeEffects.size,
      projectileEffects: this.projectileEffects.size,
      physicsTrackedEffects: this.physicsBodyToEffect.size,
    };
  }
}

// Export singleton creator
export const _createPhysicsVisualBridge = (
  physicsWorld: PhysicsWorld,
  physicsSpellBridge: PhysicsSpellBridge,
): PhysicsVisualBridge => {
  return new PhysicsVisualBridge(physicsWorld, physicsSpellBridge);
};
