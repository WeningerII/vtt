/**
 * ECS Bridge Service - Connects CharacterService and MonsterService to ECS components
 */

import { World, EntityId } from "../World";
import { HealthStore } from "../components/Health";
import { StatsStore } from "../components/Stats";
import { ConditionsStore, Condition, ConditionType } from "../components/Conditions";
import { CombatStore } from "../components/Combat";

export interface CharacterData {
  id: string;
  name: string;
  hitPoints: { current: number; max: number; temporary: number };
  abilities: Record<string, { value: number; modifier: number }>;
  armorClass?: number;
  level?: number;
  proficiencyBonus?: number;
  speed?: number;
  hitDie?: string;
  initiative?: number;
  [key: string]: unknown;
}

// Type guard function
function hasStatblock(
  monster: MonsterData,
): monster is MonsterData & { statblock: MonsterStatblock } {
  return "statblock" in monster && monster.statblock !== undefined;
}

export interface MonsterData {
  id: string;
  name: string;
  hitPoints: number | { value: number; formula?: string };
  abilities: Record<string, number>;
  armorClass: number | { value: number; type?: string };
  speed?: { walk?: number; [key: string]: number | undefined };
  statblock?: MonsterStatblock;
  [key: string]: unknown;
}

export interface CharacterUpdates {
  hitPoints?: { current?: number; max?: number; temporary?: number };
  abilities?: Record<string, { value?: number; modifier?: number }>;
  [key: string]: unknown;
}

// Service interfaces for dependency injection
export interface ICharacterService {
  getCharacter(id: string): Promise<CharacterData>;
  updateCharacter(id: string, userId: string, updates: CharacterUpdates): Promise<CharacterData>;
}

export interface IMonsterService {
  getMonster(id: string): Promise<MonsterData>;
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

  // Store references
  private healthStore: HealthStore;
  private statsStore: StatsStore;
  private conditionsStore: ConditionsStore;
  private combatStore: CombatStore;

  constructor(
    private world: World,
    healthStore: HealthStore,
    statsStore: StatsStore,
    conditionsStore: ConditionsStore,
    combatStore: CombatStore,
    private characterService?: ICharacterService,
    private monsterService?: IMonsterService,
  ) {
    this.healthStore = healthStore;
    this.statsStore = statsStore;
    this.conditionsStore = conditionsStore;
    this.combatStore = combatStore;
  }

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

    // Set stats - convert character abilities format to ECS format (supports { value, modifier })
    const abilities = {
      strength: character.abilities.strength?.value ?? 10,
      dexterity: character.abilities.dexterity?.value ?? 10,
      constitution: character.abilities.constitution?.value ?? 10,
      intelligence: character.abilities.intelligence?.value ?? 10,
      wisdom: character.abilities.wisdom?.value ?? 10,
      charisma: character.abilities.charisma?.value ?? 10,
    };
    const abilityModifiers = {
      strength: Math.floor((abilities.strength - 10) / 2),
      dexterity: Math.floor((abilities.dexterity - 10) / 2),
      constitution: Math.floor((abilities.constitution - 10) / 2),
      intelligence: Math.floor((abilities.intelligence - 10) / 2),
      wisdom: Math.floor((abilities.wisdom - 10) / 2),
      charisma: Math.floor((abilities.charisma - 10) / 2),
    };

    this.world.stats.add(entityId, {
      abilities,
      abilityModifiers,
      proficiencyBonus: character.proficiencyBonus || 2,
      armorClass: character.armorClass || 10,
      speed: character.speed || 30,
      level: character.level || 1,
      hitDie: character.hitDie || "d8",
      // D&D 5e format for backward compatibility
      STR: { value: abilities.strength, modifier: abilityModifiers.strength },
      DEX: { value: abilities.dexterity, modifier: abilityModifiers.dexterity },
      CON: { value: abilities.constitution, modifier: abilityModifiers.constitution },
      INT: { value: abilities.intelligence, modifier: abilityModifiers.intelligence },
      WIS: { value: abilities.wisdom, modifier: abilityModifiers.wisdom },
      CHA: { value: abilities.charisma, modifier: abilityModifiers.charisma },
    });
    // Stats are already added above via this.world.stats.add()

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
    const statblock = hasStatblock(monster) ? monster.statblock : undefined;
    const hpSource = statblock ? statblock.hitPoints : monster.hitPoints;
    const maxHP = this.calculateHPFromString(hpSource);

    // Create health component
    this.healthStore.add(entityId, {
      current: maxHP,
      max: maxHP,
      temporary: 0,
    });

    // Set stats from statblock - convert to ECS format
    const monsterAbilities = statblock
      ? {
          strength: statblock.abilities.STR,
          dexterity: statblock.abilities.DEX,
          constitution: statblock.abilities.CON,
          intelligence: statblock.abilities.INT,
          wisdom: statblock.abilities.WIS,
          charisma: statblock.abilities.CHA,
        }
      : {
          strength: monster.abilities.strength ?? monster.abilities.STR ?? 10,
          dexterity: monster.abilities.dexterity ?? monster.abilities.DEX ?? 10,
          constitution: monster.abilities.constitution ?? monster.abilities.CON ?? 10,
          intelligence: monster.abilities.intelligence ?? monster.abilities.INT ?? 10,
          wisdom: monster.abilities.wisdom ?? monster.abilities.WIS ?? 10,
          charisma: monster.abilities.charisma ?? monster.abilities.CHA ?? 10,
        };
    const monsterAbilityModifiers = {
      strength: Math.floor((monsterAbilities.strength - 10) / 2),
      dexterity: Math.floor((monsterAbilities.dexterity - 10) / 2),
      constitution: Math.floor((monsterAbilities.constitution - 10) / 2),
      intelligence: Math.floor((monsterAbilities.intelligence - 10) / 2),
      wisdom: Math.floor((monsterAbilities.wisdom - 10) / 2),
      charisma: Math.floor((monsterAbilities.charisma - 10) / 2),
    };

    this.world.stats.add(entityId, {
      abilities: monsterAbilities,
      abilityModifiers: monsterAbilityModifiers,
      proficiencyBonus: 2,
      armorClass: statblock
        ? typeof statblock.armorClass === "number"
          ? statblock.armorClass
          : (statblock.armorClass as { value: number })?.value || 10
        : typeof monster.armorClass === "number"
          ? monster.armorClass
          : typeof monster.armorClass === "object" &&
              monster.armorClass !== null &&
              "value" in monster.armorClass
            ? (monster.armorClass as { value: number }).value
            : 10,
      speed: monster.speed?.walk || 30,
      level: 1,
      hitDie: "d8",
      // D&D 5e format for backward compatibility
      STR: { value: monsterAbilities.strength, modifier: monsterAbilityModifiers.strength },
      DEX: { value: monsterAbilities.dexterity, modifier: monsterAbilityModifiers.dexterity },
      CON: { value: monsterAbilities.constitution, modifier: monsterAbilityModifiers.constitution },
      INT: { value: monsterAbilities.intelligence, modifier: monsterAbilityModifiers.intelligence },
      WIS: { value: monsterAbilities.wisdom, modifier: monsterAbilityModifiers.wisdom },
      CHA: { value: monsterAbilities.charisma, modifier: monsterAbilityModifiers.charisma },
    });

    // Initialize combat component with monster initiative bonus
    const _dexModifier = Math.floor((monsterAbilities.dexterity - 10) / 2);
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
    if (!this.characterService) {
      return;
    }

    const externalId = this.reverseEntityMap.get(entityId);
    if (!externalId || !externalId.startsWith("char")) {
      return;
    }

    const characterId = externalId.substring(5);
    const stats = this.statsStore.get(entityId);
    if (!stats) {
      return;
    }

    // Convert ECS stats format back to character format
    const characterUpdates = {
      abilities: {
        STR: stats.STR
          ? { value: stats.STR.value, modifier: stats.STR.modifier }
          : { value: 10, modifier: 0 },
        DEX: stats.DEX
          ? { value: stats.DEX.value, modifier: stats.DEX.modifier }
          : { value: 10, modifier: 0 },
        CON: stats.CON
          ? { value: stats.CON.value, modifier: stats.CON.modifier }
          : { value: 10, modifier: 0 },
        INT: stats.INT
          ? { value: stats.INT.value, modifier: stats.INT.modifier }
          : { value: 10, modifier: 0 },
        WIS: stats.WIS
          ? { value: stats.WIS.value, modifier: stats.WIS.modifier }
          : { value: 10, modifier: 0 },
        CHA: stats.CHA
          ? { value: stats.CHA.value, modifier: stats.CHA.modifier }
          : { value: 10, modifier: 0 },
      },
    };

    await this.characterService.updateCharacter(characterId, "system", characterUpdates);
  }

  /**
   * Sync character changes back to CharacterService
   */
  async syncCharacterToService(characterId: string): Promise<void> {
    if (!this.characterService) {
      return;
    }

    const entityId = this.entityMap.get(characterId);
    if (!entityId) {
      return;
    }

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
    if (!entityId) {
      return false;
    }

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
    if (!entityId) {
      return false;
    }

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
    if (!entityId) {
      return false;
    }

    this.conditionsStore.add(entityId, condition);
    return true;
  }

  /**
   * Remove condition from entity
   */
  removeCondition(externalId: string, conditionType: string): boolean {
    const entityId = this.entityMap.get(externalId);
    if (!entityId) {
      return false;
    }

    this.conditionsStore.remove(entityId, conditionType as ConditionType);
    return true;
  }

  /**
   * Get entity data for external use
   */
  getEntityData(externalId: string): EntityData | null {
    const entityId = this.entityMap.get(externalId);
    if (!entityId) {
      return null;
    }

    const health = this.healthStore.get(entityId);
    const stats = this.statsStore.get(entityId);
    const conditions = this.conditionsStore.get(entityId);
    const combat = this.combatStore.get(entityId);

    if (!health || !stats) {
      return null;
    }

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
      abilities: {
        STR: stats.STR ?? {
          value: stats.abilities.strength,
          modifier: stats.abilityModifiers.strength,
        },
        DEX: stats.DEX ?? {
          value: stats.abilities.dexterity,
          modifier: stats.abilityModifiers.dexterity,
        },
        CON: stats.CON ?? {
          value: stats.abilities.constitution,
          modifier: stats.abilityModifiers.constitution,
        },
        INT: stats.INT ?? {
          value: stats.abilities.intelligence,
          modifier: stats.abilityModifiers.intelligence,
        },
        WIS: stats.WIS ?? {
          value: stats.abilities.wisdom,
          modifier: stats.abilityModifiers.wisdom,
        },
        CHA: stats.CHA ?? {
          value: stats.abilities.charisma,
          modifier: stats.abilityModifiers.charisma,
        },
      },
      conditions,
      initiative: combat?.initiative || 0,
    };
  }

  /**
   * Remove entity from ECS
   */
  removeEntity(externalId: string): boolean {
    const entityId = this.entityMap.get(externalId);
    if (!entityId) {
      return false;
    }

    // Remove from all component stores
    this.healthStore.remove(entityId);
    this.statsStore.remove(entityId);
    this.conditionsStore.remove(entityId);
    this.combatStore.remove(entityId);

    // Clean up mappings
    this.entityMap.delete(externalId);
    this.reverseEntityMap.delete(entityId);

    // Destroy entity in world
    // TODO: Implement proper entity destruction
    // this.world.destroyEntity(entityId);

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
  private calculateHPFromString(hp: string | number | { value: number; formula?: string }): number {
    if (typeof hp === "number") {
      return hp;
    }
    if (typeof hp === "string") {
      // Simple parsing for formats like "4d8+4" or "58 (9d8 + 18)"
      const match = hp.toString().match(/(\d+)(?:\s*\([^)]+\))?/);
      return match && match[1] ? parseInt(match[1]) : 10;
    }
    // Object form
    if (typeof hp.value === "number") {
      return hp.value;
    }
    if (hp.formula) {
      const match = hp.formula.match(/(\d+)/);
      return match && match[1] ? parseInt(match[1]) : 10;
    }
    return 10;
  }

  /**
   * Batch sync all entities back to services
   */
  async syncAllToServices(): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const [externalId, _entityId] of this.entityMap) {
      if (!externalId.includes("monster")) {
        // Only sync characters, not monster instances
        promises.push(this.syncCharacterToService(externalId));
      }
    }

    await Promise.all(promises);
  }
}
