/**
 * Condition Synchronization Service - Keeps ECS conditions in sync with database applied conditions
 */

import { EntityId } from "../World";
import { logger } from "@vtt/logging";
import { Condition, ConditionType } from "../components/Conditions";

export interface DatabaseCondition {
  id: string;
  actorId: string;
  conditionId: string;
  duration: number;
  remainingDuration: number;
  source?: string;
  metadata?: Record<string, any>;
  appliedAt: Date;
  expiresAt?: Date;
  condition: {
    id: string;
    name: string;
    description: string;
    category: string;
    effects: Record<string, any>;
  };
}

export interface IConditionDatabase {
  getAppliedConditions(actorId: string): Promise<DatabaseCondition[]>;
  applyCondition(
    actorId: string,
    conditionId: string,
    duration: number,
    source?: string,
  ): Promise<string>;
  updateConditionDuration(appliedConditionId: string, remainingDuration: number): Promise<void>;
  removeCondition(appliedConditionId: string): Promise<void>;
}

export class ConditionSyncService {
  private entityToActorMap = new Map<EntityId, string>(); // ECS Entity -> Database Actor ID
  private actorToEntityMap = new Map<string, EntityId>(); // Database Actor ID -> ECS Entity
  private appliedConditionMap = new Map<string, string>(); // ECS Condition ID -> Database Applied Condition ID

  constructor(
    private conditionsStore: any, // ECS Conditions Store
    private database?: IConditionDatabase,
  ) {}

  /**
   * Register entity-actor mapping for condition sync
   */
  registerEntityActor(entityId: EntityId, actorId: string): void {
    this.entityToActorMap.set(entityId, actorId);
    this.actorToEntityMap.set(actorId, entityId);
  }

  /**
   * Unregister entity-actor mapping
   */
  unregisterEntity(entityId: EntityId): void {
    const actorId = this.entityToActorMap.get(entityId);
    if (actorId) {
      this.actorToEntityMap.delete(actorId);
      this.entityToActorMap.delete(entityId);
    }
  }

  /**
   * Sync conditions from database to ECS for a specific entity
   */
  async syncFromDatabase(entityId: EntityId): Promise<void> {
    if (!this.database) {return;}

    const actorId = this.entityToActorMap.get(entityId);
    if (!actorId) {return;}

    try {
      const dbConditions = await this.database.getAppliedConditions(actorId);

      // Clear existing ECS conditions for this entity
      this.conditionsStore.remove(entityId);

      // Apply database conditions to ECS
      for (const dbCondition of dbConditions) {
        const ecsCondition: Condition = {
          id: `db_${dbCondition.id}`,
          type: this.mapDbConditionToECSType(dbCondition.condition.name),
          duration: dbCondition.remainingDuration,
          source: dbCondition.source || "database",
          appliedAt: dbCondition.appliedAt.getTime(),
          metadata: {
            dbId: dbCondition.id,
            dbConditionId: dbCondition.conditionId,
            ...dbCondition.metadata,
          },
        };

        this.conditionsStore.add(entityId, ecsCondition);
        if (ecsCondition.id) {
          this.appliedConditionMap.set(ecsCondition.id, dbCondition.id);
        }
      }
    } catch (error) {
      logger.error(`Failed to sync conditions from database for entity ${entityId}:`, error);
    }
  }

  /**
   * Sync conditions from ECS to database for a specific entity
   */
  async syncToDatabase(entityId: EntityId): Promise<void> {
    if (!this.database) {return;}

    const actorId = this.entityToActorMap.get(entityId);
    if (!actorId) {return;}

    try {
      const ecsConditions = this.conditionsStore.getAll(entityId) || [];
      const dbConditions = await this.database.getAppliedConditions(actorId);

      // Create maps for efficient lookup
      const _ecsConditionMap = new Map(ecsConditions.map((c: Condition) => [c.id, c]));
      const dbConditionMap = new Map(dbConditions.map((c) => [c.id, c]));

      // Update existing conditions in database
      for (const condition of ecsConditions) {
        const dbId = this.appliedConditionMap.get(condition.id);

        if (dbId && dbConditionMap.has(dbId)) {
          // Update duration in database
          const dbCondition = dbConditionMap.get(dbId)!;
          if (dbCondition.remainingDuration !== condition.duration) {
            await this.database.updateConditionDuration(dbId, condition.duration);
          }
        } else if (!condition.metadata?.dbId) {
          // New ECS condition that needs to be added to database
          const conditionName = this.mapECSTypeToDbCondition(condition.type);
          if (conditionName) {
            const newDbId = await this.database.applyCondition(
              actorId,
              conditionName,
              condition.duration,
              condition.source,
            );
            this.appliedConditionMap.set(condition.id, newDbId);
          }
        }
      }

      // Remove conditions from database that no longer exist in ECS
      for (const dbCondition of dbConditions) {
        const correspondingECSCondition = ecsConditions.find(
          (c: Condition) => c.id && this.appliedConditionMap.get(c.id) === dbCondition.id,
        );

        if (!correspondingECSCondition) {
          if (dbCondition.conditionId) {
            this.database.removeCondition(dbCondition.conditionId);
          }
          // Remove from our mapping
          const ecsId = [...this.appliedConditionMap.entries()].find(
            ([, dbId]) => dbId === dbCondition.id,
          )?.[0];
          if (ecsId) {
            this.appliedConditionMap.delete(ecsId);
          }
        }
      }
    } catch (error) {
      logger.error(`Failed to sync conditions to database for entity ${entityId}:`, error);
    }
  }

  /**
   * Apply a condition to ECS and sync to database
   */
  async applyCondition(
    entityId: EntityId,
    conditionType: ConditionType,
    duration: number,
    source?: string,
  ): Promise<void> {
    // Apply to ECS first
    const condition: Condition = {
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: conditionType,
      duration,
      source: source || "system",
      appliedAt: Date.now(),
      metadata: {} as Record<string, any>,
    };

    this.conditionsStore.add(entityId, condition);

    // Sync to database
    if (this.database) {
      const actorId = this.entityToActorMap.get(entityId);
      if (actorId) {
        try {
          const conditionName = this.mapECSTypeToDbCondition(conditionType);
          if (conditionName) {
            const dbId = await this.database.applyCondition(
              actorId,
              conditionName,
              duration,
              source,
            );
            if (condition.id) {
              this.appliedConditionMap.set(condition.id, dbId);
            }

            // Update condition metadata
            if (!condition.metadata) {
              condition.metadata = {};
            }
            condition.metadata.dbId = dbId;
          }
        } catch (error) {
          logger.error(`Failed to sync new condition to database:`, error);
        }
      }
    }
  }

  /**
   * Remove a condition from ECS and sync to database
   */
  async removeCondition(entityId: EntityId, conditionId: string): Promise<void> {
    // Remove from ECS
    this.conditionsStore.remove(entityId, conditionId);

    // Sync to database
    const dbId = this.appliedConditionMap.get(conditionId);
    if (dbId && this.database) {
      try {
        await this.database.removeCondition(dbId);
        this.appliedConditionMap.delete(conditionId);
      } catch (error) {
        logger.error(`Failed to remove condition from database:`, error);
      }
    }
  }

  /**
   * Update condition duration in ECS and sync to database
   */
  async updateConditionDuration(
    entityId: EntityId,
    conditionId: string,
    newDuration: number,
  ): Promise<void> {
    // Update in ECS
    const conditions = this.conditionsStore.getAll(entityId) || [];
    const condition = conditions.find((c: Condition) => c.id === conditionId);

    if (condition) {
      condition.duration = newDuration;

      // Sync to database
      const dbId = this.appliedConditionMap.get(conditionId);
      if (dbId && this.database) {
        try {
          await this.database.updateConditionDuration(dbId, newDuration);
        } catch (error) {
          logger.error(`Failed to update condition duration in database:`, error);
        }
      }
    }
  }

  /**
   * Periodic sync - should be called regularly to keep ECS and database in sync
   */
  async periodicSync(): Promise<void> {
    for (const entityId of this.entityToActorMap.keys()) {
      await this.syncFromDatabase(entityId);
      await this.syncToDatabase(entityId);
    }
  }

  /**
   * Map database condition name to ECS condition type
   */
  private mapDbConditionToECSType(conditionName: string): ConditionType {
    // Common D&D 5e conditions
    const mapping: Record<string, ConditionType> = {
      blinded: "blinded",
      charmed: "charmed",
      deafened: "deafened",
      frightened: "frightened",
      grappled: "grappled",
      incapacitated: "incapacitated",
      invisible: "invisible",
      paralyzed: "paralyzed",
      petrified: "petrified",
      poisoned: "poisoned",
      prone: "prone",
      restrained: "restrained",
      stunned: "stunned",
      unconscious: "unconscious",
      exhaustion: "exhaustion",
    };

    return mapping[conditionName.toLowerCase()] || "custom";
  }

  /**
   * Map ECS condition type to database condition name
   */
  private mapECSTypeToDbCondition(conditionType: ConditionType): string | null {
    // Reverse mapping
    const mapping: Partial<Record<ConditionType, string>> = {
      blinded: "blinded",
      charmed: "charmed",
      deafened: "deafened",
      frightened: "frightened",
      grappled: "grappled",
      incapacitated: "incapacitated",
      invisible: "invisible",
      paralyzed: "paralyzed",
      petrified: "petrified",
      poisoned: "poisoned",
      prone: "prone",
      restrained: "restrained",
      stunned: "stunned",
      unconscious: "unconscious",
      exhaustion: "exhaustion",
      concentration: "concentration",
      blessed: "blessed",
      cursed: "cursed",
      hasted: "hasted",
      slowed: "slowed",
    };

    return mapping[conditionType] || null;
  }

  /**
   * Get sync statistics
   */
  getSyncStats(): {
    entitiesTracked: number;
    conditionsMapped: number;
  } {
    return {
      entitiesTracked: this.entityToActorMap.size,
      conditionsMapped: this.appliedConditionMap.size,
    };
  }
}
