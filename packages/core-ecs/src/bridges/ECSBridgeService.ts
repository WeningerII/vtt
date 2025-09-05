/**
 * ECS Bridge Service - Connects CharacterService and MonsterService to ECS components
 */

import { World, EntityId } from "../World";
import { _HealthStore } from "../components/Health";
import { _StatsStore } from "../components/Stats";
import { _ConditionsStore, Condition } from "../components/Conditions";
import { _CombatStore } from "../components/Combat";
// Service interfaces for dependency injection
export interface ICharacterService {
  getCharacter(id: string): Promise<any>;
  updateCharacter(id: string, userId: string, updates: any): Promise<any>;
}

export interface IMonsterService {
  getMonster(id: string): Promise<any>;
}

export interface EntityData {
  id: string;
  name: string;
  type: "character" | "monster";
  hitPoints: {
    current: number;
    max: number;
    temporary: number;
  };
  armorClass: number;
  abilities: Record<string, { value: number; modifier: number }>;
  conditions?: Condition[];
  initiative?: number;
}

export interface MonsterStatblock {
  name: string;
  hitPoints: number;
  armorClass: number;
  abilities: {
    STR: number;
    DEX: number;
    CON: number;
    INT: number;
    WIS: number;
    CHA: number;
  };
  skills?: Record<string, number>;
  savingThrows?: Record<string, number>;
  conditionImmunities?: string[];
  damageResistances?: string[];
  damageImmunities?: string[];
}

export class ECSBridgeService {
  // Entity mapping
  private entityMap = new Map<string, EntityId>(); // External ID -> ECS EntityId
  private reverseEntityMap = new Map<EntityId, string>(); // ECS EntityId -> External ID

  constructor(
    private world: World,
    private characterService?: ICharacterService,
    private monsterService?: IMonsterService,
  ) {}

  /**
   * Initialize with service dependencies
   */
  initialize(characterService?: ICharacterService, monsterService?: IMonsterService): void {
    this.characterService = characterService;
    this.monsterService = monsterService;
  }

  /**
   * Create ECS entity from character data
   */
  async createCharacterEntity(characterId: string): Promise<EntityId> {
    if (!this.characterService) {
      throw new Error("CharacterService not initialized");
    }

    const character = await this.characterService.getCharacter(characterId);
    if (!character) {
      throw new Error(`Character ${characterId} not found`);
    }

    const entityId = this.world.createEntity();

    // Map the entity
    this.entityMap.set(characterId, entityId);
    this.reverseEntityMap.set(entityId, characterId);

    // Create health component
    this.healthStore.add(entityId, {
      current: character.hitPoints.current,
      max: character.hitPoints.max,
      temporary: character.hitPoints.temporary || 0,
    });

    // Set stats - convert character abilities format to ECS format
    this.world.stats.add(entityId, {
      abilities: {
        strength: character.abilities.STR?.value || 10,
        dexterity: character.abilities.DEX?.value || 10,
        constitution: character.abilities.CON?.value || 10,
        intelligence: character.abilities.INT?.value || 10,
        wisdom: character.abilities.WIS?.value || 10,
        charisma: character.abilities.CHA?.value || 10,
      },
      proficiencyBonus: character.proficiencyBonus || 2,
      armorClass: character.armorClass || 10,
      speed: character.speed || 30,
      level: character.level || 1,
      hitDie: character.hitDie || "d8",
    });
    this.statsStore.add(entityId, {
      STR: {
        value: character.abilities.STR?.value || 10,
        modifier: character.abilities.STR?.modifier || 0,
      },
      DEX: {
        value: character.abilities.DEX?.value || 10,
        modifier: character.abilities.DEX?.modifier || 0,
      },
      CON: {
        value: character.abilities.CON?.value || 10,
        modifier: character.abilities.CON?.modifier || 0,
      },
      INT: {
        value: character.abilities.INT?.value || 10,
        modifier: character.abilities.INT?.modifier || 0,
      },
      WIS: {
        value: character.abilities.WIS?.value || 10,
        modifier: character.abilities.WIS?.modifier || 0,
      },
      CHA: {
        value: character.abilities.CHA?.value || 10,
        modifier: character.abilities.CHA?.modifier || 0,
      },
    });

    // Initialize combat component
    this.world.combat.add(entityId, {
      initiative: character.initiative || 0,
      isActive: false,
      hasActed: false,
      hasMovedThisTurn: false,
      actionPoints: 1,
      maxActionPoints: 1,
      reactionUsed: false,
      concentrating: false,
    });
    this.combatStore.add(entityId, {
      initiative: character.initiative || 0,
      isActive: false,
      actionPoints: 1,
      bonusActionUsed: false,
      reactionUsed: false,
      hasMovedThisTurn: false,
      turnOrder: -1,
    });

    return entityId;
  }

  /**
   * Create ECS entity from monster data
   */
  async createMonsterEntity(monsterId: string, instanceName?: string): Promise<EntityId> {
    if (!this.monsterService) {
      throw new Error("MonsterService not initialized");
    }

    const monster = await this.monsterService.getMonster(monsterId);
    if (!monster) {
      throw new Error(`Monster ${monsterId} not found`);
    }

    const entityId = this.world.createEntity();
    const instanceId = instanceName ? `${monsterId}_${instanceName}` : monsterId;

    // Map the entity
    this.entityMap.set(instanceId, entityId);
    this.reverseEntityMap.set(entityId, instanceId);

    // Extract statblock data
    const statblock = monster.statblock as MonsterStatblock;
    const maxHP =
      typeof statblock.hitPoints === "number"
        ? statblock.hitPoints
        : this.calculateHPFromString(statblock.hitPoints as any);

    // Create health component
    this.healthStore.add(entityId, {
      current: maxHP,
      max: maxHP,
      temporary: 0,
    });

    // Set stats from statblock - convert to ECS format
    this.world.stats.add(entityId, {
      abilities: {
        strength: statblock.abilities.STR || 10,
        dexterity: statblock.abilities.DEX || 10,
        constitution: statblock.abilities.CON || 10,
        intelligence: statblock.abilities.INT || 10,
        wisdom: statblock.abilities.WIS || 10,
        charisma: statblock.abilities.CHA || 10,
      },
      proficiencyBonus: Math.max(2, Math.floor((statblock.hitPoints + 7) / 4)), // CR-based proficiency
      armorClass: statblock.armorClass,
      speed: statblock.speed || 30,
      level: Math.max(1, Math.floor(statblock.hitPoints / 2)) || 1,
      hitDie: "d8", // Default for monsters
    });
    this.statsStore.add(entityId, {
      STR: {
        value: statblock.abilities.STR,
        modifier: Math.floor((statblock.abilities.STR - 10) / 2),
      },
      DEX: {
        value: statblock.abilities.DEX,
        modifier: Math.floor((statblock.abilities.DEX - 10) / 2),
      },
      CON: {
        value: statblock.abilities.CON,
        modifier: Math.floor((statblock.abilities.CON - 10) / 2),
      },
      INT: {
        value: statblock.abilities.INT,
        modifier: Math.floor((statblock.abilities.INT - 10) / 2),
      },
      WIS: {
        value: statblock.abilities.WIS,
        modifier: Math.floor((statblock.abilities.WIS - 10) / 2),
      },
      CHA: {
        value: statblock.abilities.CHA,
        modifier: Math.floor((statblock.abilities.CHA - 10) / 2),
      },
    });

    // Initialize combat component with monster initiative bonus
    const _dexModifier = Math.floor((statblock.abilities.DEX - 10) / 2);
    this.world.combat.add(entityId, {
      initiative: 0,
      isActive: false,
      hasActed: false,
      hasMovedThisTurn: false,
      actionPoints: 1,
      maxActionPoints: 1,
      reactionUsed: false,
      concentrating: false,
    });
    this.combatStore.add(entityId, {
      initiative: 0,
      isActive: false,
      actionPoints: 1,
      bonusActionUsed: false,
      reactionUsed: false,
      hasMovedThisTurn: false,
      turnOrder: -1,
    });

    return entityId;
  }

  /**
   * Sync ECS stats back to character service
   */
  async syncStatsToCharacter(entityId: number): Promise<void> {
    if (!this.characterService) {return;}

    const externalId = this.reverseEntityMap.get(entityId);
    if (!externalId || !externalId.startsWith("char")) {return;}

    const characterId = externalId.substring(5);
    const stats = this.statsStore.get(entityId);
    if (!stats) {return;}

    // Convert ECS stats format back to character format
    const characterUpdates = {
      abilities: {
        STR: { value: stats.STR.value, modifier: stats.STR.modifier },
        DEX: { value: stats.DEX.value, modifier: stats.DEX.modifier },
        CON: { value: stats.CON.value, modifier: stats.CON.modifier },
        INT: { value: stats.INT.value, modifier: stats.INT.modifier },
        WIS: { value: stats.WIS.value, modifier: stats.WIS.modifier },
        CHA: { value: stats.CHA.value, modifier: stats.CHA.modifier },
      },
    };

    await this.characterService.updateCharacter(characterId, "system", characterUpdates);
  }

  /**
   * Sync character changes back to CharacterService
   */
  async syncCharacterToService(characterId: string): Promise<void> {
    if (!this.characterService) {return;}

    const entityId = this.entityMap.get(characterId);
    if (!entityId) {return;}

    const health = this.healthStore.get(entityId);
    const _conditions = this.conditionsStore.get(entityId);

    if (health) {
      await this.characterService.updateCharacter(characterId, "system", {
        hitPoints: {
          current: health.current,
          max: health.max,
          temporary: health.temporary,
        },
      });
    }

    // Sync conditions if needed
    // This would require extending the character service to handle conditions
  }

  /**
   * Apply damage to entity and sync back to services
   */
  async applyDamage(
    externalId: string,
    damage: number,
    _damageType: string = "untyped",
  ): Promise<boolean> {
    const entityId = this.entityMap.get(externalId);
    if (!entityId) {return false;}

    const success = this.healthStore.takeDamage(entityId, damage);

    if (success) {
      // Sync back to appropriate service
      if (externalId.includes("")) {
        // Monster instance - no sync needed typically
      } else {
        await this.syncCharacterToService(externalId);
      }
    }

    return success;
  }

  /**
   * Apply healing to entity and sync back to services
   */
  async applyHealing(externalId: string, healing: number): Promise<boolean> {
    const entityId = this.entityMap.get(externalId);
    if (!entityId) {return false;}

    const success = this.healthStore.heal(entityId, healing);

    if (success) {
      if (!externalId.includes("")) {
        await this.syncCharacterToService(externalId);
      }
    }

    return success;
  }

  /**
   * Apply condition to entity
   */
  applyCondition(externalId: string, condition: Condition): boolean {
    const entityId = this.entityMap.get(externalId);
    if (!entityId) {return false;}

    this.conditionsStore.add(entityId, condition);
    return true;
  }

  /**
   * Remove condition from entity
   */
  removeCondition(externalId: string, conditionType: string): boolean {
    const entityId = this.entityMap.get(externalId);
    if (!entityId) {return false;}

    this.conditionsStore.remove(entityId, conditionType as any);
    return true;
  }

  /**
   * Get entity data for external use
   */
  getEntityData(externalId: string): EntityData | null {
    const entityId = this.entityMap.get(externalId);
    if (!entityId) {return null;}

    const health = this.healthStore.get(entityId);
    const stats = this.statsStore.get(entityId);
    const conditions = this.conditionsStore.get(entityId);
    const combat = this.combatStore.get(entityId);

    if (!health || !stats) {return null;}

    return {
      id: externalId,
      name: externalId, // Would need to store name separately
      type: externalId.includes("") ? "monster" : "character",
      hitPoints: {
        current: health.current,
        max: health.max,
        temporary: health.temporary,
      },
      armorClass: 10, // Would need to calculate from stats and equipment
      abilities: stats,
      conditions,
      initiative: combat?.initiative,
    };
  }

  /**
   * Remove entity from ECS
   */
  removeEntity(externalId: string): boolean {
    const entityId = this.entityMap.get(externalId);
    if (!entityId) {return false;}

    // Remove from all component stores
    this.healthStore.remove(entityId);
    this.statsStore.remove(entityId);
    this.conditionsStore.remove(entityId);
    this.combatStore.remove(entityId);

    // Clean up mappings
    this.entityMap.delete(externalId);
    this.reverseEntityMap.delete(entityId);

    // Destroy entity in world
    this.world.destroyEntity(entityId);

    return true;
  }

  /**
   * Get all managed entities
   */
  getAllEntities(): string[] {
    return Array.from(this.entityMap.keys());
  }

  /**
   * Get ECS EntityId from external ID
   */
  getECSEntityId(externalId: string): EntityId | undefined {
    return this.entityMap.get(externalId);
  }

  /**
   * Get external ID from ECS EntityId
   */
  getExternalId(entityId: EntityId): string | undefined {
    return this.reverseEntityMap.get(entityId);
  }

  /**
   * Calculate HP from D&D hit dice string (e.g., "4d8+4")
   */
  private calculateHPFromString(hpString: string | number): number {
    if (typeof hpString === "number") {return hpString;}

    // Simple parsing for formats like "4d8+4" or "58 (9d8 + 18)"
    const match = hpString.toString().match(/(\d+)(?:\s*\([^)]+\))?/);
    return match ? parseInt(match[1]) : 10;
  }

  /**
   * Batch sync all entities back to services
   */
  async syncAllToServices(): Promise<void> {
    const promises = [];

    for (const [externalId, _entityId] of this.entityMap) {
      if (!externalId.includes("")) {
        // Only sync characters, not monster instances
        promises.push(this.syncCharacterToService(externalId));
      }
    }

    await Promise.all(promises);
  }
}
