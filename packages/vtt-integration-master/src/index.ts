/**
 * VTT Integration Master Service
 * Coordinates all physics, spell casting, visual effects, and persistence systems
 */

import { EventEmitter } from "events";
import { logger } from "@vtt/logging";
import type { PhysicsWorld } from "../../../packages/physics/src";
import type { SpellEngine } from "../../../packages/spell-engine/src";
import { PhysicsSpellBridge } from "../../../packages/physics-spell-bridge/src";
import { SpellVisualEffectsManager } from "../../../packages/spell-visual-effects/src";
import {
  ConcentrationManager,
  PhysicsConcentrationIntegration,
} from "../../../packages/concentration-manager/src";
import { WebSocketManager } from "../../../apps/server/src/websocket/WebSocketManager";
import { PrismaClient } from "@prisma/client";

export interface VTTIntegrationConfig {
  physics: {
    gravity: { x: number; y: number };
    cellSize: number;
    maxVelocity: number;
  };
  spells: {
    autoVisualEffects: boolean;
    autoConcentrationChecks: boolean;
    persistEffects: boolean;
  };
  networking: {
    broadcastPhysicsUpdates: boolean;
    broadcastSpellEffects: boolean;
    updateInterval: number;
  };
  persistence: {
    savePhysicsState: boolean;
    saveSpellEffects: boolean;
    cleanupInterval: number;
  };
}

export interface GameEntity {
  id: string;
  type: "token" | "projectile" | "barrier" | "effect";
  position: { x: number; y: number; z?: number };
  size: { x: number; y: number; z?: number };
  properties: Record<string, any>;
}

export interface SpellCastingContext {
  casterId: string;
  sessionId: string;
  spell: any;
  targets: string[];
  position?: { x: number; y: number; z?: number };
  upcastLevel?: number;
}

export class VTTIntegrationMaster extends EventEmitter {
  private config: VTTIntegrationConfig;
  private physicsWorld: PhysicsWorld;
  private spellEngine: SpellEngine;
  private physicsSpellBridge: PhysicsSpellBridge;
  private visualEffectsManager: SpellVisualEffectsManager;
  private concentrationManager: ConcentrationManager;
  private physicsConcentrationIntegration: PhysicsConcentrationIntegration;
  private wsManager: WebSocketManager;
  private prisma: PrismaClient;

  private entities: Map<string, GameEntity> = new Map();
  private activeSpells: Map<string, any> = new Map();
  private updateInterval: NodeJS.Timeout;
  private cleanupInterval: NodeJS.Timeout;

  constructor(
    physicsWorld: PhysicsWorld,
    spellEngine: SpellEngine,
    wsManager: WebSocketManager,
    prisma: PrismaClient,
    config: Partial<VTTIntegrationConfig> = {},
  ) {
    super();

    this.config = {
      physics: {
        gravity: { x: 0, y: 0 },
        cellSize: 100,
        maxVelocity: 1000,
        ...config.physics,
      },
      spells: {
        autoVisualEffects: true,
        autoConcentrationChecks: true,
        persistEffects: true,
        ...config.spells,
      },
      networking: {
        broadcastPhysicsUpdates: true,
        broadcastSpellEffects: true,
        updateInterval: 100,
        ...config.networking,
      },
      persistence: {
        savePhysicsState: true,
        saveSpellEffects: true,
        cleanupInterval: 60000,
        ...config.persistence,
      },
    };

    this.physicsWorld = physicsWorld;
    this.spellEngine = spellEngine;
    this.wsManager = wsManager;
    this.prisma = prisma;

    // Initialize subsystems
    this.physicsSpellBridge = new PhysicsSpellBridge(physicsWorld, spellEngine);
    this.visualEffectsManager = new SpellVisualEffectsManager();
    this.concentrationManager = new ConcentrationManager();
    this.physicsConcentrationIntegration = new PhysicsConcentrationIntegration(
      this.concentrationManager,
    );

    this.setupIntegrations();
    this.startUpdateLoops();
  }

  /**
   * Setup cross-system integrations
   */
  private setupIntegrations(): void {
    // Physics-Spell Bridge Events
    this.physicsSpellBridge.on("forceApplied", (tokenId, _force, _magnitude) => {
      this.handleForceApplication(tokenId, { magnitude, direction: force });
      if (this.config.networking.broadcastPhysicsUpdates) {
        this.broadcastPhysicsEvent("force_applied", { tokenId, force, magnitude });
      }
    });

    this.physicsSpellBridge.on("tokenTeleported", (tokenId, _fromPos, _toPos) => {
      this.handleTeleportEvent(tokenId, fromPos, toPos);
      if (this.config.networking.broadcastSpellEffects) {
        this.broadcastSpellEvent("teleport_effect", { tokenId, fromPos, toPos });
      }
    });

    this.physicsSpellBridge.on("constraintApplied", (tokenId, _constraint) => {
      this.handleConstraintApplication(tokenId, constraint);
      if (this.config.networking.broadcastSpellEffects) {
        this.broadcastSpellEvent("constraint_applied", { tokenId, constraint });
      }
    });

    this.physicsSpellBridge.on("projectileCreated", (projectileId, spell) => {
      this.handleProjectileCreation(projectileId, spell);
      if (this.config.networking.broadcastSpellEffects) {
        this.broadcastSpellEvent("projectile_launch", { projectileId, spell });
      }
    });

    this.physicsSpellBridge.on("barrierCreated", (barrierId, _barrier) => {
      this.handleBarrierCreation(barrierId, barrier);
      if (this.config.networking.broadcastSpellEffects) {
        this.broadcastSpellEvent("barrier_created", { barrierId, barrier });
      }
    });

    this.physicsSpellBridge.on("projectileHit", (projectileId, _targetId) => {
      this.handleProjectileImpact(projectileId, targetId);
    });

    // Concentration Manager Events
    this.concentrationManager.on("concentrationStarted", (concentration) => {
      this.handleConcentrationStart(concentration);
    });

    this.concentrationManager.on("concentrationBroken", (check) => {
      this.handleConcentrationBroken(check);
    });

    // Physics Events
    this.physicsWorld.on("collision", (collision) => {
      this.physicsConcentrationIntegration.handleCollision(collision);
      this.handlePhysicsCollision(collision);
    });

    // WebSocket Events
    this.wsManager.on("gameEvent", (message) => {
      this.handleWebSocketGameEvent(message);
    });

    // Visual Effects Events
    this.visualEffectsManager.on("effectCreated", (effect) => {
      if (this.config.networking.broadcastSpellEffects) {
        this.broadcastSpellEvent("spell_effect", {
          type: "visual_effect_created",
          effect,
        });
      }
    });
  }

  /**
   * Cast spell with full integration
   */
  async castSpell(context: SpellCastingContext): Promise<any> {
    const { casterId, _sessionId, spell, targets, position, upcastLevel } = context;

    try {
      // 1. Cast spell with physics integration
      const result = await this.physicsSpellBridge.castSpellWithPhysics(
        spell,
        { id: casterId },
        targets,
        upcastLevel,
        position,
      );

      if (!result.success) {
        this.broadcastSpellEvent("spell_cast", {
          casterId,
          spell: spell.id,
          success: false,
          error: result.error,
        });
        return result;
      }

      // 2. Handle concentration
      if (spell.concentration && this.config.spells.autoConcentrationChecks) {
        const caster = await this.getCasterData(casterId);
        this.concentrationManager.startConcentration(
          casterId,
          spell.id,
          spell.name,
          caster.constitutionMod,
          caster.proficiencyBonus,
        );
      }

      // 3. Trigger visual effects
      if (this.config.spells.autoVisualEffects) {
        // Casting effects
        this.visualEffectsManager.triggerSpellCasting(
          spell.id,
          casterId,
          position || { x: 0, y: 0 },
        );

        // Impact effects
        if (targets.length > 0) {
          for (const targetId of targets) {
            const targetPos = await this.getEntityPosition(targetId);
            if (targetPos) {
              this.visualEffectsManager.triggerSpellImpact(spell.id, targetPos, [targetId]);
            }
          }
        }

        // Audio effects
        this.visualEffectsManager.playSpellAudio(spell.id, position);
      }

      // 4. Persist spell effects
      if (this.config.persistence.saveSpellEffects) {
        await this.persistSpellEffect(context, result);
      }

      // 5. Broadcast to clients
      this.broadcastSpellEvent("spell_cast", {
        casterId,
        spell: spell.id,
        success: true,
        targets,
        position,
        effects: result.effects,
        physicsEffects: result.physicsEffects,
      });

      this.emit("spellCast", { context, result });
      return result;
    } catch (error) {
      logger.error("Spell casting error:", error);
      this.broadcastSpellEvent("spell_cast", {
        casterId,
        spell: spell.id,
        success: false,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Register game entity with physics
   */
  async registerEntity(entity: GameEntity): Promise<void> {
    this.entities.set(entity.id, entity);

    // Register with physics-spell bridge if it's a token
    if (entity.type === "token") {
      this.physicsSpellBridge.registerToken(
        entity.id,
        { x: entity.position.x, y: entity.position.y },
        { x: entity.size.x, y: entity.size.y },
      );
    }

    // Persist to database
    if (this.config.persistence.savePhysicsState) {
      await this.persistPhysicsBody(entity);
    }

    this.emit("entityRegistered", entity);
  }

  /**
   * Update entity position
   */
  async updateEntityPosition(
    entityId: string,
    position: { x: number; y: number; z?: number },
  ): Promise<void> {
    const entity = this.entities.get(entityId);
    if (!entity) {return;}

    entity.position = position;

    // Update visual effects that follow this entity
    this.visualEffectsManager.updateEffectPosition(entityId, position);

    // Broadcast position update
    if (this.config.networking.broadcastPhysicsUpdates) {
      this.broadcastPhysicsEvent("token_move", {
        tokenId: entityId,
        x: position.x,
        y: position.y,
        z: position.z,
      });
    }

    // Update database
    if (this.config.persistence.savePhysicsState) {
      await this.updatePhysicsBodyPosition(entityId, position);
    }

    this.emit("entityPositionUpdated", { entityId, position });
  }

  /**
   * Handle damage to entity (triggers concentration checks)
   */
  async handleEntityDamage(entityId: string, damage: number, sourceSpell?: string): Promise<void> {
    // Check for concentration
    if (this.concentrationManager.isConcentrating(entityId)) {
      const concentration = this.concentrationManager.getConcentrationState(entityId)!;
      const check = this.concentrationManager.makeConcentrationCheck(concentration, damage);

      this.broadcastSpellEvent("concentration_check", {
        entityId,
        damage,
        check,
        sourceSpell,
      });
    }

    this.emit("entityDamaged", { entityId, damage, sourceSpell });
  }

  /**
   * Get targets in spell area using physics collision detection
   */
  getTargetsInSpellArea(
    center: { x: number; y: number },
    radius: number,
    height?: number,
  ): string[] {
    return this.physicsSpellBridge.getTargetsInArea(center, radius, height);
  }

  /**
   * Clean up expired effects and spells
   */
  async cleanupExpiredEffects(): Promise<void> {
    const now = Date.now();

    // Clean up database records
    if (this.config.persistence.saveSpellEffects) {
      await Promise.all([
        this.prisma.activeSpellEffect.deleteMany({
          where: {
            isActive: true,
            expiresAt: { lt: new Date(now) },
          },
        }),
        this.prisma.physicsConstraintState.deleteMany({
          where: {
            isActive: true,
            expiresAt: { lt: new Date(now) },
          },
        }),
        this.prisma.spellBarrier.deleteMany({
          where: {
            isActive: true,
            expiresAt: { lt: new Date(now) },
          },
        }),
      ]);
    }

    // Clean up visual effects
    this.visualEffectsManager.update(now);

    this.emit("effectsCleanedUp", { timestamp: now });
  }

  /**
   * Get system statistics
   */
  getSystemStats(): any {
    return {
      entities: {
        total: this.entities.size,
        byType: this.getEntityCountsByType(),
      },
      physics: this.physicsWorld.getStats?.() || {},
      concentration: this.concentrationManager.getStatistics(),
      visualEffects: {
        active: this.visualEffectsManager.getActiveEffects().length,
      },
      activeSpells: this.activeSpells.size,
      uptime: process.uptime(),
    };
  }

  /**
   * Private helper methods
   */
  private startUpdateLoops(): void {
    // Main update loop
    this.updateInterval = setInterval(() => {
      this.update();
    }, this.config.networking.updateInterval);

    // Cleanup loop
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEffects();
    }, this.config.persistence.cleanupInterval);
  }

  private update(): void {
    // Update physics-spell bridge
    this.physicsSpellBridge.update(this.config.networking.updateInterval / 1000);

    // Update visual effects
    this.visualEffectsManager.update(Date.now());

    this.emit("systemUpdated");
  }

  private async getCasterData(_casterId: string): Promise<any> {
    // This would typically fetch from database or cache
    return {
      constitutionMod: 2,
      proficiencyBonus: 3,
    };
  }

  private async getEntityPosition(
    entityId: string,
  ): Promise<{ x: number; y: number; z?: number } | null> {
    const entity = this.entities.get(entityId);
    return entity?.position || null;
  }

  private getEntityCountsByType(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const entity of this.entities.values()) {
      counts[entity.type] = (counts[entity.type] || 0) + 1;
    }
    return counts;
  }

  private async persistSpellEffect(context: SpellCastingContext, result: any): Promise<void> {
    if (!this.config.persistence.saveSpellEffects) {return;}

    const expiresAt =
      context.spell.duration > 0 ? new Date(Date.now() + context.spell.duration * 1000) : null;

    await this.prisma.activeSpellEffect.create({
      data: {
        spellId: context.spell.id,
        spellName: context.spell.name,
        casterId: context.casterId,
        casterName: "Unknown", // Would fetch from database
        effectType: "mixed",
        effectData: result,
        targetType: context.targets.length > 1 ? "multiple" : "single",
        targetIds: context.targets,
        centerX: context.position?.x,
        centerY: context.position?.y,
        duration: context.spell.duration * 1000,
        expiresAt,
        concentration: context.spell.concentration || false,
        hasPhysicsEffects: result.physicsEffects?.length > 0 || false,
        physicsData: result.physicsEffects,
      },
    });
  }

  private async persistPhysicsBody(entity: GameEntity): Promise<void> {
    if (!this.config.persistence.savePhysicsState) {return;}

    await this.prisma.physicsBody.upsert({
      where: { entityId: entity.id },
      update: {
        positionX: entity.position.x,
        positionY: entity.position.y,
        width: entity.size.x,
        height: entity.size.y,
      },
      create: {
        entityId: entity.id,
        entityType: entity.type,
        positionX: entity.position.x,
        positionY: entity.position.y,
        width: entity.size.x,
        height: entity.size.y,
      },
    });
  }

  private async updatePhysicsBodyPosition(
    entityId: string,
    position: { x: number; y: number; z?: number },
  ): Promise<void> {
    await this.prisma.physicsBody.updateMany({
      where: { entityId, isActive: true },
      data: {
        positionX: position.x,
        positionY: position.y,
      },
    });
  }

  // Event handlers
  private handleForceApplication(entityId: string, force: any): void {
    this.physicsConcentrationIntegration.handleForceApplication(entityId, force);
  }

  private handleTeleportEvent(entityId: string, fromPos: any, toPos: any): void {
    this.updateEntityPosition(entityId, toPos);
  }

  private handleConstraintApplication(_entityId: string, _constraint: any): void {
    // Handle constraint effects
  }

  private handleProjectileCreation(projectileId: string, spell: any): void {
    // Register projectile as entity
    this.registerEntity({
      id: projectileId,
      type: "projectile",
      position: { x: 0, y: 0 }, // Will be updated by physics
      size: { x: 0.5, y: 0.5 },
      properties: { spellId: spell.id },
    });
  }

  private handleBarrierCreation(_barrierId: string, _barrier: any): void {
    // Register barrier as entity
  }

  private handleProjectileImpact(projectileId: string, _targetId: string): void {
    // Clean up projectile entity
    this.entities.delete(projectileId);
  }

  private handleConcentrationStart(concentration: any): void {
    this.broadcastSpellEvent("concentration_check", {
      type: "started",
      concentration,
    });
  }

  private handleConcentrationBroken(check: any): void {
    this.broadcastSpellEvent("concentration_check", {
      type: "broken",
      check,
    });
  }

  private handlePhysicsCollision(collision: any): void {
    if (this.config.networking.broadcastPhysicsUpdates) {
      this.broadcastPhysicsEvent("physics_collision", { collision });
    }
  }

  private handleWebSocketGameEvent(message: any): void {
    // Handle incoming WebSocket game events
    switch (message.type) {
      case "spell_cast":
        if (message.payload.spellContext) {
          this.castSpell(message.payload.spellContext);
        }
        break;
      // Add more handlers as needed
    }
  }

  private broadcastPhysicsEvent(type: string, payload: any): void {
    // Broadcast to all sessions - this would need session context
    this.emit("physicsEvent", { type, payload });
  }

  private broadcastSpellEvent(type: string, payload: any): void {
    // Broadcast to all sessions - this would need session context
    this.emit("spellEvent", { type, payload });
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.updateInterval) {clearInterval(this.updateInterval);}
    if (this.cleanupInterval) {clearInterval(this.cleanupInterval);}
    this.physicsConcentrationIntegration.destroy();
  }
}

export const _createVTTIntegrationMaster = (
  physicsWorld: PhysicsWorld,
  spellEngine: SpellEngine,
  wsManager: WebSocketManager,
  prisma: PrismaClient,
  config?: Partial<VTTIntegrationConfig>,
): VTTIntegrationMaster => {
  return new VTTIntegrationMaster(physicsWorld, spellEngine, wsManager, prisma, config);
};
