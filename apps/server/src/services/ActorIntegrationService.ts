/**
 * Actor Integration Service - Unified bridge between Characters, Monsters, and Combat
 */

import { PrismaClient } from "@prisma/client";
import { logger } from "@vtt/logging";
import { CharacterService } from "../character/CharacterService";
import { MonsterService } from "./MonsterService";
import { Character } from "../character/types";

export interface CombatActor {
  id: string;
  name: string;
  type: "character" | "monster";

  // Combat stats
  hitPoints: {
    current: number;
    max: number;
    temporary: number;
  };
  armorClass: number;
  initiative: number;
  speed: number;

  // Abilities for modifiers
  abilities: {
    STR: { value: number; modifier: number };
    DEX: { value: number; modifier: number };
    CON: { value: number; modifier: number };
    INT: { value: number; modifier: number };
    WIS: { value: number; modifier: number };
    CHA: { value: number; modifier: number };
  };

  // Combat state
  conditions: Array<{
    type: string;
    duration: number;
    source?: string;
  }>;

  // Actions available
  actions: Array<{
    id: string;
    name: string;
    type: "action" | "bonus_action" | "reaction";
    description: string;
    attackBonus?: number;
    damage?: {
      diceExpression: string;
      damageType: string;
    };
    saveDC?: number;
    saveAbility?: string;
  }>;

  // Source references
  sourceId: string; // character or monster ID
  isPlayer: boolean;
}

export interface EncounterSetup {
  id: string;
  name: string;
  campaignId: string;
  actors: CombatActor[];
  currentRound: number;
  currentTurn: number;
  isActive: boolean;
}

export class ActorIntegrationService {
  constructor(
    private prisma: PrismaClient,
    private characterService: CharacterService,
    private monsterService: MonsterService,
  ) {}

  /**
   * Create combat actor from character
   */
  async createCharacterActor(characterId: string): Promise<CombatActor> {
    const character = await this.characterService.getCharacter(characterId);
    if (!character) {
      throw new Error(`Character ${characterId} not found`);
    }

    return {
      id: `char_${character.id}`,
      name: character.name,
      type: "character",
      hitPoints: {
        current: character.hitPoints.current,
        max: character.hitPoints.max,
        temporary: character.hitPoints.temporary || 0,
      },
      armorClass: character.armorClass,
      initiative: character.initiative || 0,
      speed: character.speed,
      abilities: character.abilities,
      conditions: [],
      actions: this.generateCharacterActions(character),
      sourceId: character.id,
      isPlayer: true,
    };
  }

  /**
   * Create combat actor from monster
   */
  async createMonsterActor(monsterId: string, instanceName?: string): Promise<CombatActor> {
    const monster = await this.monsterService.getMonster(monsterId);
    if (!monster) {
      throw new Error(`Monster ${monsterId} not found`);
    }

    const statblock = monster.statblock as any;
    const name = instanceName || monster.name;
    const maxHP =
      typeof statblock.hitPoints === "number"
        ? statblock.hitPoints
        : this.parseHitPoints(statblock.hitPoints);

    return {
      id: `monster_${monster.id}_${Date.now()}`,
      name,
      type: "monster",
      hitPoints: {
        current: maxHP,
        max: maxHP,
        temporary: 0,
      },
      armorClass:
        typeof statblock.armorClass === "number"
          ? statblock.armorClass
          : statblock.armorClass?.value || 10,
      initiative: 0,
      speed: statblock.speed?.walk || 30,
      abilities: {
        STR: {
          value: statblock.abilities?.STR || 10,
          modifier: Math.floor(((statblock.abilities?.STR || 10) - 10) / 2),
        },
        DEX: {
          value: statblock.abilities?.DEX || 10,
          modifier: Math.floor(((statblock.abilities?.DEX || 10) - 10) / 2),
        },
        CON: {
          value: statblock.abilities?.CON || 10,
          modifier: Math.floor(((statblock.abilities?.CON || 10) - 10) / 2),
        },
        INT: {
          value: statblock.abilities?.INT || 10,
          modifier: Math.floor(((statblock.abilities?.INT || 10) - 10) / 2),
        },
        WIS: {
          value: statblock.abilities?.WIS || 10,
          modifier: Math.floor(((statblock.abilities?.WIS || 10) - 10) / 2),
        },
        CHA: {
          value: statblock.abilities?.CHA || 10,
          modifier: Math.floor(((statblock.abilities?.CHA || 10) - 10) / 2),
        },
      },
      conditions: [],
      actions: this.generateMonsterActions(statblock),
      sourceId: monster.id,
      isPlayer: false,
    };
  }

  /**
   * Create or update database actor
   */
  async createDatabaseActor(combatActor: CombatActor, campaignId: string): Promise<string> {
    const actor = await this.prisma.actor.create({
      data: {
        name: combatActor.name,
        kind:
          combatActor.type === "character"
            ? "PC"
            : combatActor.type === "monster"
              ? "MONSTER"
              : "NPC",
        userId: "system", // Would need proper user context
        campaignId,
        characterId: combatActor.type === "character" ? combatActor.sourceId : null,
        monsterId: combatActor.type === "monster" ? combatActor.sourceId : null,
        currentHp: combatActor.hitPoints.current,
        maxHp: combatActor.hitPoints.max,
        tempHp: combatActor.hitPoints.temporary,
        ac: combatActor.armorClass,
        initiative: combatActor.initiative,
      },
    });

    return actor.id;
  }

  /**
   * Update actor health in database
   */
  async updateActorHealth(
    actorId: string,
    hitPoints: { current: number; max: number; temporary: number },
  ): Promise<void> {
    await this.prisma.actor.update({
      where: { id: actorId },
      data: {
        currentHp: hitPoints.current,
        maxHp: hitPoints.max,
        tempHp: hitPoints.temporary,
      },
    });

    // Sync back to character service if it's a character
    const actor = await this.prisma.actor.findUnique({
      where: { id: actorId },
      include: { character: true },
    });

    if (actor?.character && actor.characterId) {
      await this.characterService.updateCharacter(actor.characterId, "system", {
        hitPoints: {
          current: hitPoints.current,
          max: hitPoints.max,
          temporary: hitPoints.temporary,
        },
      });
    }
  }

  /**
   * Create encounter with actors
   */
  async createEncounter(
    name: string,
    campaignId: string,
    characterIds: string[] = [],
    monsterConfigs: Array<{ monsterId: string; instanceName?: string }> = [],
  ): Promise<EncounterSetup> {
    // Create encounter in database
    const encounter = await this.prisma.encounter.create({
      data: {
        name,
        campaignId,
        currentRound: 1,
        currentTurn: 0,
        isActive: false,
      },
    });

    const actors: CombatActor[] = [];
    const participants = [];

    // Add characters
    for (const characterId of characterIds) {
      try {
        const actor = await this.createCharacterActor(characterId);
        const dbActorId = await this.createDatabaseActor(actor, campaignId);

        participants.push({
          encounterId: encounter.id,
          actorId: dbActorId,
          initiative: 10 + actor.abilities.DEX.modifier, // Default initiative
          isActive: true,
          hasActed: false,
        });

        actors.push(actor);
      } catch (error) {
        logger.error(`Failed to add character ${characterId} to encounter:`, error);
      }
    }

    // Add monsters
    for (const config of monsterConfigs) {
      try {
        const actor = await this.createMonsterActor(config.monsterId, config.instanceName);
        const dbActorId = await this.createDatabaseActor(actor, campaignId);

        participants.push({
          encounterId: encounter.id,
          actorId: dbActorId,
          initiative: 10 + actor.abilities.DEX.modifier, // Default initiative
          isActive: true,
          hasActed: false,
        });

        actors.push(actor);
      } catch (error) {
        logger.error(`Failed to add monster ${config.monsterId} to encounter:`, error);
      }
    }

    // Create participants in database
    if (participants.length > 0) {
      await this.prisma.encounterParticipant.createMany({
        data: participants,
      });
    }

    return {
      id: encounter.id,
      name: encounter.name,
      campaignId: encounter.campaignId,
      actors,
      currentRound: encounter.currentRound,
      currentTurn: encounter.currentTurn,
      isActive: encounter.isActive,
    };
  }

  /**
   * Get encounter with all actor data
   */
  async getEncounter(encounterId: string): Promise<EncounterSetup | null> {
    const encounter = await this.prisma.encounter.findUnique({
      where: { id: encounterId },
      include: {
        participants: {
          include: {
            actor: {
              include: {
                character: true,
                monster: true,
              },
            },
          },
          orderBy: { initiative: "desc" },
        },
      },
    });

    if (!encounter) return null;

    const actors: CombatActor[] = [];

    for (const participant of encounter.participants) {
      const actor = participant.actor;
      let combatActor: CombatActor;

      if (actor.character) {
        // Recreate from character data
        combatActor = await this.createCharacterActor(actor.characterId!);
      } else if (actor.monster) {
        // Recreate from monster data
        combatActor = await this.createMonsterActor(actor.monsterId!);
      } else {
        // Generic NPC actor
        combatActor = {
          id: `actor_${actor.id}`,
          name: actor.name,
          type: "monster", // Default for NPCs
          hitPoints: {
            current: actor.currentHp,
            max: actor.maxHp,
            temporary: actor.tempHp,
          },
          armorClass: actor.ac,
          initiative: actor.initiative,
          speed: 30,
          abilities: {
            STR: { value: 10, modifier: 0 },
            DEX: { value: 10, modifier: 0 },
            CON: { value: 10, modifier: 0 },
            INT: { value: 10, modifier: 0 },
            WIS: { value: 10, modifier: 0 },
            CHA: { value: 10, modifier: 0 },
          },
          conditions: [],
          actions: [],
          sourceId: actor.id,
          isPlayer: actor.kind === "PC",
        };
      }

      // Update with current combat values
      combatActor.hitPoints.current = actor.currentHp;
      combatActor.hitPoints.max = actor.maxHp;
      combatActor.hitPoints.temporary = actor.tempHp;
      combatActor.initiative = participant.initiative;

      actors.push(combatActor);
    }

    return {
      id: encounter.id,
      name: encounter.name,
      campaignId: encounter.campaignId,
      actors,
      currentRound: encounter.currentRound,
      currentTurn: encounter.currentTurn,
      isActive: encounter.isActive,
    };
  }

  /**
   * Start encounter (roll initiative, set turn order)
   */
  async startEncounter(encounterId: string): Promise<void> {
    await this.prisma.encounter.update({
      where: { id: encounterId },
      data: {
        isActive: true,
        currentRound: 1,
        currentTurn: 0,
      },
    });
  }

  /**
   * End encounter
   */
  async endEncounter(encounterId: string): Promise<void> {
    await this.prisma.encounter.update({
      where: { id: encounterId },
      data: {
        isActive: false,
      },
    });
  }

  /**
   * Generate character actions from character data
   */
  private generateCharacterActions(character: Character): CombatActor["actions"] {
    const actions: CombatActor["actions"] = [
      {
        id: "attack",
        name: "Attack",
        type: "action",
        description: "Make a weapon or spell attack",
      },
      {
        id: "dodge",
        name: "Dodge",
        type: "action",
        description: "Focus entirely on avoiding attacks",
      },
      {
        id: "dash",
        name: "Dash",
        type: "action",
        description: "Double your movement speed",
      },
      {
        id: "help",
        name: "Help",
        type: "action",
        description: "Help an ally with their next task",
      },
    ];

    // Add equipment-based actions
    for (const item of character.equipment || []) {
      if (item.type === "weapon" && item.equipped) {
        actions.push({
          id: `weapon_${item.id}`,
          name: `Attack with ${item.name}`,
          type: "action",
          description: item.description || `Attack with ${item.name}`,
          attackBonus:
            (item.properties as any)?.attackBonus ||
            character.proficiencyBonus + character.abilities.STR?.modifier ||
            0,
        });
      }
    }

    // Add class features
    for (const feature of character.features || []) {
      if (feature.uses && feature.uses.current > 0) {
        actions.push({
          id: `feature_${feature.id}`,
          name: feature.name,
          type: "action",
          description: feature.description,
        });
      }
    }

    return actions;
  }

  /**
   * Generate monster actions from statblock
   */
  private generateMonsterActions(statblock: any): CombatActor["actions"] {
    const actions: CombatActor["actions"] = [];

    // Add default actions
    actions.push(
      {
        id: "attack",
        name: "Attack",
        type: "action",
        description: "Make a basic attack",
      },
      {
        id: "dodge",
        name: "Dodge",
        type: "action",
        description: "Focus entirely on avoiding attacks",
      },
    );

    // Add specific actions from statblock
    if (statblock.actions) {
      for (const action of statblock.actions) {
        actions.push({
          id: `action_${action.name.toLowerCase().replace(/\s+/g, "")}`,
          name: action.name,
          type: "action",
          description: action.description || action.desc || "",
          attackBonus: action.attackBonus || action.attack_bonus,
          damage:
            action.damage ||
            (action.damage_dice
              ? {
                  diceExpression: action.damage_dice,
                  damageType: action.damage_type || "bludgeoning",
                }
              : undefined),
          saveDC: action.saveDC || action.save?.dc,
          saveAbility: action.saveAbility || action.save?.ability_type,
        });
      }
    }

    return actions;
  }

  /**
   * Parse hit points from various formats
   */
  private parseHitPoints(hp: any): number {
    if (typeof hp === "number") return hp;
    if (typeof hp === "string") {
      const match = hp.match(/(\d+)/);
      return match ? parseInt(match[1]) : 10;
    }
    if (hp?.value) return hp.value;
    if (hp?.average) return hp.average;
    return 10;
  }
}
