/**
 * Physics-Spell Bridge System
 * Integrates spell effects with physics simulation for realistic magical interactions
 */

import type { PhysicsWorld, _RigidBody, Vector2 } from "../../../packages/physics/src";
import type { SpellEngine, SpellEffect, CastingResult } from "../../../packages/spell-engine/src";
import { EventEmitter } from "events";

export interface PhysicsSpellEffect extends Omit<SpellEffect, "type" | "target"> {
  id?: string;
  name?: string;
  level?: number;
  school?: string;
  castingTime?: string;
  range?: string;
  components?: string[];
  duration?: string;
  description?: string;
  effects?: any[];
  concentration?: boolean;
  scaling?: any;
  ritual?: boolean;
  type?:
    | "damage"
    | "healing"
    | "condition"
    | "teleport"
    | "summon"
    | "buff"
    | "debuff"
    | "utility"
    | "custom"
    | string;
  target?: "area" | "self" | "single" | "multiple" | "line" | "cone" | "sphere" | string;
  physics?: {
    type:
      | "force"
      | "teleport"
      | "constraint"
      | "projectile"
      | "area_barrier"
      | "movement_modifier"
      | "area_effect"
      | "persistent_effect"
      | "melee_effect"
      | "mental_effect";
    force?: {
      magnitude: number;
      direction?: Vector2;
      duration?: number;
    };
    teleport?: {
      range: number;
      requiresLineOfSight: boolean;
    };
    constraint?: {
      type: "immobilize" | "slow" | "entangle";
      strength: number;
      duration: number;
    };
    projectile?: {
      speed: number;
      gravity: boolean;
      piercing: boolean;
      maxBounces?: number;
      splash?: boolean;
      ethereal?: boolean;
      freezing?: boolean;
      onThrow?: boolean;
    };
    barrier?: {
      thickness: number;
      height: number;
      duration: number;
      passable: boolean;
    };
    movementModifier?: {
      type?: string;
      speedMultiplier: number;
      jumpMultiplier?: number;
      duration: number;
      magnitude?: number;
    };
    area?: {
      type: "circle" | "cone" | "cylinder";
      radius: number;
      height?: string | number;
      angle?: number;
      origin?: string;
      affectsMultiple?: boolean;
      ignoresCover?: boolean;
      originatesFromAbove?: boolean;
    };
    particles?: {
      type: string;
      density: string;
      dispersal: string;
    };
    persistent?: {
      followsCaster: boolean;
      duration: number;
      light?: {
        bright: number;
        dim: number;
      };
    };
    melee?: {
      range: number;
      electrical?: boolean;
      advantageAgainstMetal?: boolean;
    };
    electrical?: {
      arcing?: boolean;
      conductivity?: boolean;
      disruptive?: boolean;
    };
    mental?: {
      requiresHearing?: boolean;
      psychic?: boolean;
      debuff?: string;
    };
    sound?: {
      audible?: boolean;
      range?: number;
      requiresLineOfSight?: boolean;
    };
    radiant?: {
      intensity?: string;
      piercesCover?: boolean;
    };
  };
}

export interface PhysicsAwareToken {
  id: string;
  physicsBodyId: number;
  position: Vector2;
  size: Vector2;
  canMove: boolean;
  movementSpeed: number;
  constraints: PhysicsConstraint[];
}

export interface PhysicsConstraint {
  id: string;
  type: "immobilize" | "slow" | "entangle" | "web";
  strength: number;
  duration: number;
  sourceSpell?: string;
  expiresAt: number;
}

export interface SpellProjectile {
  id: string;
  spellId: string;
  casterId: string;
  physicsBodyId: number;
  targetIds: string[];
  onHit: (_targetId: string) => void;
  onExpire: () => void;
}

export class PhysicsSpellBridge extends EventEmitter {
  private physicsWorld: PhysicsWorld;
  private spellEngine: SpellEngine;
  private tokens: Map<string, PhysicsAwareToken> = new Map();
  private projectiles: Map<string, SpellProjectile> = new Map();
  private barriers: Map<string, { bodyIds: number[]; expiresAt: number }> = new Map();
  private activeConstraints: Map<string, PhysicsConstraint[]> = new Map();

  constructor(physicsWorld: PhysicsWorld, spellEngine: SpellEngine) {
    super();
    this.physicsWorld = physicsWorld;
    this.spellEngine = spellEngine;
    this.setupPhysicsIntegration();
  }

  /**
   * Register a token with physics awareness
   */
  registerToken(tokenId: string, position: Vector2, size: Vector2): void {
    const body = this.physicsWorld.createBody({
      position,
      type: "dynamic",
    });

    const token: PhysicsAwareToken = {
      id: tokenId,
      physicsBodyId: body.id,
      position,
      size,
      canMove: true,
      movementSpeed: 30, // feet per round
      constraints: [],
    };

    this.tokens.set(tokenId, token);
    this.emit("tokenRegistered", tokenId);
  }

  /**
   * Cast spell with physics integration
   */
  async castSpellWithPhysics(
    spell: PhysicsSpellEffect,
    caster: any,
    targets: string[],
    spellLevel?: number,
    position?: Vector2,
  ): Promise<CastingResult & { physicsEffects: any[] }> {
    // Cast spell normally first
    const spellId = spell.id || "unknown_spell";
    const spellForEngine = { 
      ...spell, 
      id: spellId, 
      name: spell.name || "Unknown Spell",
      level: spell.level || 1,
      school: (spell.school as any) || "evocation",
      castingTime: spell.castingTime || "1 action",
      range: spell.range || "30 feet",
      components: {
        verbal: true,
        somatic: true,
        ...(Array.isArray(spell.components) && spell.components.length > 0 ? {
          material: spell.components.join(", ")
        } : {}),
        consumed: false,
        cost: 0
      },
      duration: spell.duration || "Instantaneous",
      concentration: spell.concentration || false,
      description: spell.description || "Physics-enhanced spell",
      effects: spell.effects || [],
      ritual: spell.ritual || false 
    };
    const result = this.spellEngine.castSpell(
      spellForEngine,
      caster,
      targets,
      spellLevel,
      position,
    );

    if (!result.success) {
      return { ...result, physicsEffects: [] };
    }

    const physicsEffects: any[] = [];

    // Apply physics effects
    if (spell.physics) {
      switch (spell.physics.type) {
        case "force":
          physicsEffects.push(...this.applyForceEffect(spell.physics.force!, targets));
          break;
        case "teleport":
          physicsEffects.push(
            ...this.applyTeleportEffect(spell.physics.teleport!, targets, position!),
          );
          break;
        case "constraint":
          physicsEffects.push(...this.applyConstraintEffect(spell.physics.constraint!, targets));
          break;
        case "projectile":
          physicsEffects.push(this.createProjectile(spell, caster, targets, position!));
          break;
        case "area_barrier":
          physicsEffects.push(this.createAreaBarrier(spell.physics.barrier!, position!));
          break;
        case "movement_modifier":
          physicsEffects.push(
            ...this.applyMovementModifier(spell.physics.movementModifier!, targets),
          );
          break;
      }
    }

    return { ...result, physicsEffects };
  }

  /**
   * Apply force to targets (e.g., Thunderwave, Eldritch Blast)
   */
  private applyForceEffect(force: any, targets: string[]): any[] {
    const effects: any[] = [];

    for (const targetId of targets) {
      const token = this.tokens.get(targetId);
      if (!token) {continue;}

      const body = this.physicsWorld.getBody(token.physicsBodyId);
      if (!body) {continue;}

      // Calculate force direction and magnitude
      const forceVector = force.direction || { x: 0, y: -1 }; // Default up
      const magnitude = force.magnitude || 100;

      // Apply impulse
      body.velocity.x += forceVector.x * magnitude;
      body.velocity.y += forceVector.y * magnitude;

      effects.push({
        type: "force_applied",
        targetId,
        force: { x: forceVector.x * magnitude, y: forceVector.y * magnitude },
      });

      this.emit("forceApplied", targetId, forceVector, magnitude);
    }

    return effects;
  }

  /**
   * Apply teleport effect (e.g., Misty Step, Dimension Door)
   */
  private applyTeleportEffect(teleport: any, targets: string[], position: Vector2): any[] {
    const effects: any[] = [];

    for (const targetId of targets) {
      const token = this.tokens.get(targetId);
      if (!token) {continue;}

      const body = this.physicsWorld.getBody(token.physicsBodyId);
      if (!body) {continue;}

      // Check line of sight if required
      if (teleport.requiresLineOfSight) {
        const raycast = this.physicsWorld.raycast(
          token.position,
          { x: position.x - token.position.x, y: position.y - token.position.y },
          teleport.range,
        );

        if (raycast.hit && raycast.body) {
          continue; // Blocked by obstacle
        }
      }

      // Teleport
      body.position.x = position.x;
      body.position.y = position.y;
      token.position = position;

      effects.push({
        type: "teleported",
        targetId,
        fromPosition: token.position,
        toPosition: position,
      });

      this.emit("tokenTeleported", targetId, token.position, position);
    }

    return effects;
  }

  /**
   * Apply movement constraints (e.g., Web, Entangle, Hold Person)
   */
  private applyConstraintEffect(constraint: any, targets: string[]): any[] {
    const effects: any[] = [];

    for (const targetId of targets) {
      const token = this.tokens.get(targetId);
      if (!token) {continue;}

      const physicsConstraint: PhysicsConstraint = {
        id: `${Date.now()}_${Math.random()}`,
        type: constraint.type,
        strength: constraint.strength,
        duration: constraint.duration,
        expiresAt: Date.now() + constraint.duration * 1000,
      };

      // Add constraint to token
      token.constraints.push(physicsConstraint);

      // Store in active constraints
      if (!this.activeConstraints.has(targetId)) {
        this.activeConstraints.set(targetId, []);
      }
      this.activeConstraints.get(targetId)!.push(physicsConstraint);

      // Modify physics body based on constraint type
      const body = this.physicsWorld.getBody(token.physicsBodyId);
      if (body) {
        switch (constraint.type) {
          case "immobilize":
            body.velocity.x = 0;
            body.velocity.y = 0;
            token.canMove = false;
            break;
          case "slow":
            token.movementSpeed *= 1 - constraint.strength;
            break;
          case "entangle":
            body.config.friction = Math.min(1.0, body.config.friction + constraint.strength);
            break;
        }
      }

      effects.push({
        type: "constraint_applied",
        targetId,
        constraint: physicsConstraint,
      });

      this.emit("constraintApplied", targetId, physicsConstraint);
    }

    return effects;
  }

  /**
   * Create spell projectile (e.g., Magic Missile, Firebolt)
   */
  private createProjectile(
    spell: PhysicsSpellEffect,
    caster: any,
    targets: string[],
    position: Vector2,
  ): any {
    const projectileId = `proj_${Date.now()}_${Math.random()}`;
    const physics = spell.physics!.projectile!;

    // Create physics body for projectile
    const projectileBody = this.physicsWorld.createBody({
      position,
      type: "dynamic",
      size: { x: 0.5, y: 0.5 },
      mass: 0.1,
      restitution: physics.maxBounces ? 0.8 : 0.0,
      friction: 0.1,
      isTrigger: true,
    });

    // Calculate initial velocity towards first target
    const firstTarget = targets[0];
    const targetToken = this.tokens.get(firstTarget || "");

    if (targetToken) {
      const direction = {
        x: targetToken.position.x - position.x,
        y: targetToken.position.y - position.y,
      };
      const length = Math.sqrt(direction.x * direction.x + direction.y * direction.y);

      if (length > 0) {
        projectileBody.velocity.x = (direction.x / length) * physics.speed;
        projectileBody.velocity.y = (direction.y / length) * physics.speed;
      }
    }

    const projectile: SpellProjectile = {
      id: projectileId,
      spellId: spell.id || `spell_${Date.now()}`,
      casterId: caster.id,
      physicsBodyId: projectileBody.id,
      targetIds: targets,
      onHit: (_targetId: string) => {
        this.handleProjectileHit(projectileId, _targetId, spell);
      },
      onExpire: () => {
        this.cleanupProjectile(projectileId);
      },
    };

    this.projectiles.set(projectileId, projectile);

    // Set up collision detection
    this.physicsWorld.on("collision", (collision: any) => {
      if (collision.bodyA.id === projectileBody.id || collision.bodyB.id === projectileBody.id) {
        const otherBodyId =
          collision.bodyA.id === projectileBody.id ? collision.bodyB.id : collision.bodyA.id;

        // Find token by physics body
        for (const [tokenId, token] of this.tokens.entries()) {
          if (token.physicsBodyId === otherBodyId && targets.includes(tokenId)) {
            projectile.onHit(tokenId);
            break;
          }
        }
      }
    });

    this.emit("projectileCreated", projectileId, spell);

    return {
      type: "projectile_created",
      projectileId,
      spellId: spell.id,
    };
  }

  /**
   * Create area barrier (e.g., Wall of Force, Wall of Fire)
   */
  private createAreaBarrier(barrier: any, position: Vector2): any {
    const barrierId = `barrier_${Date.now()}_${Math.random()}`;
    const bodyIds: number[] = [];

    // Create multiple physics bodies to form a wall
    const segments = Math.ceil(barrier.thickness / 2); // 2 foot segments

    for (let i = 0; i < segments; i++) {
      const segmentBody = this.physicsWorld.createBody({
        position: {
          x: position.x + i * 2,
          y: position.y,
        },
        type: "static",
        size: { x: 2, y: barrier.height },
        mass: Infinity,
        isTrigger: !barrier.passable,
      });

      bodyIds.push(segmentBody.id);
    }

    this.barriers.set(barrierId, {
      bodyIds,
      expiresAt: Date.now() + barrier.duration * 1000,
    });

    this.emit("barrierCreated", barrierId, barrier);

    return {
      type: "barrier_created",
      barrierId,
      bodyIds,
    };
  }

  /**
   * Apply movement speed modifiers (e.g., Haste, Slow)
   */
  private applyMovementModifier(modifier: any, targets: string[]): any[] {
    const effects: any[] = [];

    for (const targetId of targets) {
      const token = this.tokens.get(targetId);
      if (!token) {continue;}

      const originalSpeed = token.movementSpeed;
      token.movementSpeed *= modifier.speedMultiplier;

      effects.push({
        type: "movement_modified",
        targetId,
        originalSpeed,
        newSpeed: token.movementSpeed,
        duration: modifier.duration,
      });

      // Schedule restoration
      setTimeout(() => {
        if (this.tokens.has(targetId)) {
          token.movementSpeed = originalSpeed;
          this.emit("movementModifierExpired", targetId);
        }
      }, modifier.duration * 1000);

      this.emit("movementModified", targetId, modifier);
    }

    return effects;
  }

  /**
   * Handle projectile collision
   */
  private handleProjectileHit(
    projectileId: string,
    targetId: string,
    spell: PhysicsSpellEffect,
  ): void {
    const projectile = this.projectiles.get(projectileId);
    if (!projectile) {return;}

    // Apply spell effects to target
    const spellWithId = { 
      ...spell, 
      id: spell.id || "projectile_spell",
      name: spell.name || "Projectile Spell",
      level: spell.level || 1,
      school: "evocation" as const,
      castingTime: spell.castingTime || "1 action",
      range: spell.range || "120 feet",
      components: {
        verbal: true,
        somatic: true,
        ...(Array.isArray(spell.components) && spell.components.length > 0 ? {
          material: spell.components.join(", ")
        } : {}),
        consumed: false,
        cost: 0
      },
      duration: spell.duration || "Instantaneous",
      concentration: spell.concentration || false,
      description: spell.description || "Physics-enhanced spell effect",
      effects: spell.effects || [],
      ritual: spell.ritual || false
    };
    this.spellEngine.castSpell(spellWithId, { id: projectile.casterId }, [targetId]);

    this.emit("projectileHit", projectileId, targetId);
    this.cleanupProjectile(projectileId);
  }

  /**
   * Clean up projectile
   */
  private cleanupProjectile(projectileId: string): void {
    const projectile = this.projectiles.get(projectileId);
    if (projectile) {
      this.physicsWorld.removeBody(projectile.physicsBodyId);
      this.projectiles.delete(projectileId);
      this.emit("projectileDestroyed", projectileId);
    }
  }

  /**
   * Update physics-spell integration (called each frame)
   */
  update(_deltaTime: number): void {
    const now = Date.now();

    // Update token positions from physics
    for (const [tokenId, token] of this.tokens.entries()) {
      const body = this.physicsWorld.getBody(token.physicsBodyId);
      if (body) {
        token.position.x = body.position.x;
        token.position.y = body.position.y;
      }

      // Clean up expired constraints
      token.constraints = token.constraints.filter((constraint) => {
        if (now > constraint.expiresAt) {
          this.removeConstraint(tokenId, constraint);
          return false;
        }
        return true;
      });
    }

    // Clean up expired barriers
    for (const [barrierId, barrier] of this.barriers.entries()) {
      if (now > barrier.expiresAt) {
        for (const bodyId of barrier.bodyIds) {
          this.physicsWorld.removeBody(bodyId);
        }
        this.barriers.delete(barrierId);
        this.emit("barrierExpired", barrierId);
      }
    }
  }

  /**
   * Remove constraint from token
   */
  private removeConstraint(tokenId: string, constraint: PhysicsConstraint): void {
    const token = this.tokens.get(tokenId);
    if (!token) {return;}

    const body = this.physicsWorld.getBody(token.physicsBodyId);
    if (!body) {return;}

    // Restore original properties based on constraint type
    switch (constraint.type) {
      case "immobilize":
        token.canMove = true;
        break;
      case "slow":
        // This would need more sophisticated tracking to restore properly
        break;
      case "entangle":
        body.config.friction = Math.max(0, body.config.friction - constraint.strength);
        break;
    }

    this.emit("constraintRemoved", tokenId, constraint);
  }

  /**
   * Setup physics world integration
   */
  private setupPhysicsIntegration(): void {
    // Listen for physics collisions
    this.physicsWorld.on("collision", (collision: any) => {
      this.handlePhysicsCollision(collision);
    });
  }

  /**
   * Handle physics collision for spell interactions
   */
  private handlePhysicsCollision(collision: any): void {
    // Find tokens involved in collision
    const tokenA = this.findTokenByBodyId(collision.bodyA.id);
    const tokenB = this.findTokenByBodyId(collision.bodyB.id);

    if (tokenA && tokenB) {
      this.emit("tokenCollision", tokenA.id, tokenB.id, collision);
    }
  }

  /**
   * Find token by physics body ID
   */
  private findTokenByBodyId(bodyId: number): PhysicsAwareToken | undefined {
    for (const token of this.tokens.values()) {
      if (token.physicsBodyId === bodyId) {
        return token;
      }
    }
    return undefined;
  }

  /**
   * Get token physics state
   */
  getTokenState(tokenId: string): PhysicsAwareToken | undefined {
    return this.tokens.get(tokenId);
  }

  /**
   * Check if area spell affects targets using physics collision
   */
  getTargetsInArea(center: Vector2, radius: number, height?: number): string[] {
    const targets: string[] = [];

    for (const [tokenId, token] of this.tokens.entries()) {
      const distance = Math.sqrt(
        Math.pow(token.position.x - center.x, 2) + Math.pow(token.position.y - center.y, 2),
      );

      if (distance <= radius) {
        // Check line of sight using physics raycast
        const raycast = this.physicsWorld.raycast(
          center,
          {
            x: token.position.x - center.x,
            y: token.position.y - center.y,
          },
          distance,
        );

        // If raycast hits the token or nothing, target is valid
        if (!raycast.hit || this.findTokenByBodyId(raycast.body?.id || -1)?.id === tokenId) {
          targets.push(tokenId);
        }
      }
    }

    return targets;
  }
}

export const _createPhysicsSpellBridge = (
  physicsWorld: PhysicsWorld,
  spellEngine: SpellEngine,
): PhysicsSpellBridge => {
  return new PhysicsSpellBridge(physicsWorld, spellEngine);
};
