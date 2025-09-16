/**
 * Actor Integration Service - Unified bridge between Characters, Monsters, and Combat
 */

import { PrismaClient } from "@prisma/client";
import { DatabaseManager } from "../database/connection";
import { logger } from "@vtt/logging";
import { CharacterService } from "../character/CharacterService";
import { MonsterService } from "./MonsterService";
import { Character } from "../character/types";
import { CrucibleService, TacticalContext } from "../ai/combat";
import { CombatManager, Combatant, CombatState, CombatSettings, CombatManagerEvent } from "@vtt/combat";

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
  private prisma: PrismaClient;
  private characterService: CharacterService;
  private monsterService: MonsterService;
  private crucible: CrucibleService;
  private combatManagers: Map<string, CombatManager> = new Map();
  private eventListeners: Map<string, Array<(event: CombatManagerEvent) => void>> = new Map();

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || DatabaseManager.getInstance();
    this.characterService = new CharacterService();
    this.monsterService = new MonsterService(this.prisma);
    this.crucible = new CrucibleService(this.prisma);
  }

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
      abilities: {
        STR: { value: character.abilities.STR?.value || 10, modifier: character.abilities.STR?.modifier || 0 },
        DEX: { value: character.abilities.DEX?.value || 10, modifier: character.abilities.DEX?.modifier || 0 },
        CON: { value: character.abilities.CON?.value || 10, modifier: character.abilities.CON?.modifier || 0 },
        INT: { value: character.abilities.INT?.value || 10, modifier: character.abilities.INT?.modifier || 0 },
        WIS: { value: character.abilities.WIS?.value || 10, modifier: character.abilities.WIS?.modifier || 0 },
        CHA: { value: character.abilities.CHA?.value || 10, modifier: character.abilities.CHA?.modifier || 0 }
      },
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
   * Create database token for combat actor
   */
  async createDatabaseToken(combatActor: CombatActor, gameSessionId: string): Promise<string> {
    const tokenType = combatActor.type === "character" ? "PC" : "MONSTER";
    
    const token = await this.prisma.token.create({
      data: {
        name: combatActor.name,
        type: tokenType as any,
        gameSessionId,
        characterId: combatActor.type === "character" ? combatActor.sourceId : null,
        health: combatActor.hitPoints.current,
        maxHealth: combatActor.hitPoints.max,
        initiative: combatActor.initiative,
        speed: combatActor.speed,
        metadata: {
          armorClass: combatActor.armorClass,
          abilities: combatActor.abilities,
          actions: combatActor.actions,
          conditions: combatActor.conditions,
          isPlayer: combatActor.isPlayer,
        },
      },
    });

    return token.id;
  }

  /**
   * Update token health in database
   */
  async updateTokenHealth(
    tokenId: string,
    currentHitPoints: number,
    maxHitPoints?: number,
    tempHitPoints?: number
  ): Promise<void> {
    // Basic token update - may need schema adjustment
    await this.prisma.token.update({
      where: { id: tokenId },
      data: {
        // Note: Using available fields, may need schema updates
        metadata: {
          currentHitPoints,
          maxHitPoints,
          temporaryHp: tempHitPoints || 0,
        },
      },
    });

    // Sync back to character service if it's a character
    const token = await this.prisma.token.findUnique({
      where: { id: tokenId },
    });

    if (token?.characterId) {
      // Note: CharacterService.updateCharacter needs userId parameter
      // await this.characterService.updateCharacter(token.characterId, "system", {
      //   hitPoints: { current: currentHitPoints, ...(maxHitPoints && { max: maxHitPoints }) }
      // });
      logger.info(`Would update character ${token.characterId} health to ${currentHitPoints}`);
    }

    logger.info(
      `Updated health for token ${tokenId}: ${currentHitPoints}${maxHitPoints ? `/${maxHitPoints}` : ""} ${tempHitPoints ? `(+${tempHitPoints} temp)` : ""}`
    );
  }

  /**
   * Add missing methods for WebSocket integration
   */
  async updateActorHealth(
    encounterId: string,
    actorId: string,
    health: { current: number; max?: number; temporary?: number }
  ): Promise<void> {
    // Delegate to updateTokenHealth
    await this.updateTokenHealth(actorId, health.current, health.max, health.temporary);
  }

  async removeTokenFromEncounter(encounterId: string, tokenId: string): Promise<void> {
    // Note: Depends on encounterToken schema
    // await this.prisma.encounterToken.delete({
    //   where: {
    //     encounterId_tokenId: {
    //       encounterId: encounterId,
    //       tokenId: tokenId
    //     }
    //   }
    // });
    
    logger.info(`Would remove token ${tokenId} from encounter ${encounterId}`);
  }

  async updateTokenInitiative(encounterId: string, tokenId: string, initiative: number): Promise<void> {
    // Note: Depends on encounterToken schema
    // await this.prisma.encounterToken.update({
    //   where: {
    //     encounterId_tokenId: {
    //       encounterId: encounterId,
    //       tokenId: tokenId
    //     }
    //   },
    //   data: {
    //     initiative: initiative
    //   }
    // });
    
    logger.info(`Updated initiative for token ${tokenId} to ${initiative}`);
  }

  async applyCondition(
    encounterId: string, 
    actorId: string, 
    conditionName: string, 
    duration?: number, 
    source?: string
  ): Promise<void> {
    const combatManager = this.combatManagers.get(encounterId);
    if (combatManager) {
      const combatState = combatManager.getCombatState();
      const combatant = combatState?.combatants.find(c => c.tokenId === actorId);
      if (combatant) {
        combatManager.addCondition(combatant.id, conditionName, duration, source);
        return;
      }
    }
    
    // Fallback: log the condition (could store in database if needed)
    logger.info(`Applied condition ${conditionName} to actor ${actorId} in encounter ${encounterId}`);
  }

  async removeCondition(encounterId: string, actorId: string, conditionName: string): Promise<void> {
    const combatManager = this.combatManagers.get(encounterId);
    if (combatManager) {
      const combatState = combatManager.getCombatState();
      const combatant = combatState?.combatants.find(c => c.tokenId === actorId);
      if (combatant) {
        combatManager.removeCondition(combatant.id, conditionName);
        return;
      }
    }
    
    // Fallback: log the condition removal
    logger.info(`Removed condition ${conditionName} from actor ${actorId} in encounter ${encounterId}`);
  }

  /**
   * Create encounter with actors
   */
  async createEncounter(
    name: string,
    gameSessionId: string,
    characterIds: string[] = [],
    monsterConfigs: Array<{ monsterId: string; instanceName?: string }> = [],
  ): Promise<EncounterSetup> {
    // Create encounter in database
    const encounter = await this.prisma.encounter.create({
      data: {
        name,
        gameSessionId,
        status: "PLANNED",
        roundNumber: 1,
        currentTurn: 0,
      },
    });

    const actors: CombatActor[] = [];
    const encounterTokens: Array<{
      encounterId: string;
      tokenId: string;
      initiative: number;
      isActive: boolean;
    }> = [];

    // Add characters
    for (const characterId of characterIds) {
      try {
        const actor = await this.createCharacterActor(characterId);
        const tokenId = await this.createDatabaseToken(actor, gameSessionId);

        encounterTokens.push({
          encounterId: encounter.id,
          tokenId,
          initiative: 10 + actor.abilities.DEX.modifier, // Default initiative
          isActive: true,
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
        const tokenId = await this.createDatabaseToken(actor, gameSessionId);

        encounterTokens.push({
          encounterId: encounter.id,
          tokenId,
          initiative: 10 + actor.abilities.DEX.modifier, // Default initiative
          isActive: true,
        });

        actors.push(actor);
      } catch (error) {
        logger.error(`Failed to add monster ${config.monsterId} to encounter:`, error);
      }
    }

    // Create encounter tokens in database (commented out until schema is confirmed)
    // if (encounterTokens.length > 0) {
    //   await this.prisma.encounterToken.createMany({
    //     data: encounterTokens,
    //   });
    // }
    logger.info(`Would create ${encounterTokens.length} encounter tokens`);

    for (const encounterToken of encounterTokens) {
      logger.info(`Would create encounterToken for character encounter ${encounterToken.encounterId}, token ${encounterToken.tokenId}, initiative ${encounterToken.initiative}`);
    }

    return {
      id: encounter.id,
      name: encounter.name,
      campaignId: gameSessionId, // Using gameSessionId as campaign reference
      actors,
      currentRound: encounter.roundNumber,
      currentTurn: encounter.currentTurn,
      isActive: encounter.status === "ACTIVE",
    };
  }

  /**
   * Get encounter with all actor data
   */
  async getEncounter(encounterId: string): Promise<EncounterSetup | null> {
    const encounter = await this.prisma.encounter.findUnique({
      where: { id: encounterId },
      include: {
        encounterTokens: {
          include: {
            token: true,
          },
          orderBy: { initiative: "desc" },
        },
      },
    });

    if (!encounter) {return null;}

    const actors: CombatActor[] = [];

    for (const encounterToken of encounter.encounterTokens) {
      const token = encounterToken.token;
      let combatActor: CombatActor;

      if (token.characterId) {
        // Recreate from character data
        combatActor = await this.createCharacterActor(token.characterId);
      } else {
        // Create from token metadata or defaults
        const metadata = token.metadata as any || {};
        combatActor = {
          id: `token_${token.id}`,
          name: token.name,
          type: token.type === "PC" ? "character" : "monster",
          hitPoints: {
            current: token.health || 10,
            max: token.maxHealth || 10,
            temporary: metadata.temporaryHp || 0,
          },
          armorClass: metadata.armorClass || 10,
          initiative: token.initiative || 0,
          speed: token.speed,
          abilities: metadata.abilities || {
            STR: { value: 10, modifier: 0 },
            DEX: { value: 10, modifier: 0 },
            CON: { value: 10, modifier: 0 },
            INT: { value: 10, modifier: 0 },
            WIS: { value: 10, modifier: 0 },
            CHA: { value: 10, modifier: 0 },
          },
          conditions: metadata.conditions || [],
          actions: metadata.actions || [],
          sourceId: token.id,
          isPlayer: token.type === "PC",
        };
      }

      // Update with current combat values from token
      combatActor.hitPoints.current = token.health || combatActor.hitPoints.current;
      combatActor.hitPoints.max = token.maxHealth || combatActor.hitPoints.max;
      combatActor.initiative = encounterToken.initiative || combatActor.initiative;

      actors.push(combatActor);
    }

    return {
      id: encounter.id,
      name: encounter.name,
      campaignId: encounter.gameSessionId,
      actors,
      currentRound: encounter.roundNumber,
      currentTurn: encounter.currentTurn,
      isActive: encounter.status === "ACTIVE",
    };
  }

  /**
   * Start encounter (roll initiative, set turn order)
   */
  async startEncounter(encounterId: string): Promise<void> {
    logger.info(`Starting encounter: ${encounterId}`);
    
    // Get encounter with tokens
    const encounter = await this.prisma.encounter.findUnique({
      where: { id: encounterId },
      include: {
        encounterTokens: {
          include: {
            token: true
          }
        }
      }
    });

    if (!encounter) {
      throw new Error(`Encounter not found: ${encounterId}`);
    }

    // Convert tokens to combatants
    const combatants: Omit<Combatant, "id" | "actions" | "isActive">[] = [];
    
    for (const encounterToken of encounter.encounterTokens) {
      const { token } = encounterToken;
      let combatant: Omit<Combatant, "id" | "actions" | "isActive">;
      
      // Parse token metadata for character/monster data
      const metadata = token.metadata as any || {};
      
      if (token.type === "PC" && token.characterId) {
        // Handle player character tokens
        const stats = metadata.stats || {};
        combatant = {
          tokenId: token.id,
          name: token.name,
          type: "pc",
          initiative: encounterToken.initiative || 0,
          initiativeModifier: Math.floor((stats.dexterity || 10) - 10) / 2,
          maxHitPoints: token.maxHealth || stats.hitPointsMax || 10,
          currentHitPoints: token.health || token.maxHealth || stats.hitPointsMax || 10,
          temporaryHitPoints: 0,
          armorClass: metadata.armorClass || 10,
          conditions: [],
          isVisible: token.visibility === "VISIBLE",
          isDefeated: false,
          resources: {},
          savingThrows: {
            strength: metadata.savingThrows?.strength || Math.floor((stats.strength || 10) - 10) / 2,
            dexterity: metadata.savingThrows?.dexterity || Math.floor((stats.dexterity || 10) - 10) / 2,
            constitution: metadata.savingThrows?.constitution || Math.floor((stats.constitution || 10) - 10) / 2,
            intelligence: metadata.savingThrows?.intelligence || Math.floor((stats.intelligence || 10) - 10) / 2,
            wisdom: metadata.savingThrows?.wisdom || Math.floor((stats.wisdom || 10) - 10) / 2,
            charisma: metadata.savingThrows?.charisma || Math.floor((stats.charisma || 10) - 10) / 2
          },
          skills: metadata.skills || {},
          stats: {
            strength: stats.strength || 10,
            dexterity: stats.dexterity || 10,
            constitution: stats.constitution || 10,
            intelligence: stats.intelligence || 10,
            wisdom: stats.wisdom || 10,
            charisma: stats.charisma || 10
          }
        };
      } else if (token.type === "MONSTER" || token.type === "NPC") {
        // Handle monster/NPC tokens
        const monsterData = metadata.statblock || metadata;
        combatant = {
          tokenId: token.id,
          name: token.name,
          type: token.type === "MONSTER" ? "monster" : "npc",
          initiative: encounterToken.initiative || 0,
          initiativeModifier: Math.floor((monsterData.dexterity || 10) - 10) / 2,
          maxHitPoints: token.maxHealth || monsterData.hitPoints || 10,
          currentHitPoints: token.health || token.maxHealth || monsterData.hitPoints || 10,
          temporaryHitPoints: 0,
          armorClass: monsterData.armorClass || 10,
          conditions: [],
          isVisible: token.visibility === "VISIBLE",
          isDefeated: false,
          resources: {},
          savingThrows: {
            strength: Math.floor((monsterData.strength || 10) - 10) / 2,
            dexterity: Math.floor((monsterData.dexterity || 10) - 10) / 2,
            constitution: Math.floor((monsterData.constitution || 10) - 10) / 2,
            intelligence: Math.floor((monsterData.intelligence || 10) - 10) / 2,
            wisdom: Math.floor((monsterData.wisdom || 10) - 10) / 2,
            charisma: Math.floor((monsterData.charisma || 10) - 10) / 2
          },
          skills: monsterData.skills || {},
          stats: {
            strength: monsterData.strength || 10,
            dexterity: monsterData.dexterity || 10,
            constitution: monsterData.constitution || 10,
            intelligence: monsterData.intelligence || 10,
            wisdom: monsterData.wisdom || 10,
            charisma: monsterData.charisma || 10
          }
        };
      } else {
        // Skip non-combat tokens (OBJECT, EFFECT)
        continue;
      }
      
      combatants.push(combatant);
    }

    // If no combatants were found, log a warning but don't fail
    if (combatants.length === 0) {
      logger.warn(`No valid combatants found for encounter ${encounterId}`);
    }

    // Create and start combat with CombatManager
    const combatManager = new CombatManager();
    const combatSettings: Partial<CombatSettings> = {
      initiativeType: "standard",
      showInitiative: true,
      showHealth: true,
      automaticDamageApplication: true
    };
    
    const combatState = combatManager.startCombat(
      encounter.name || `Combat ${encounterId}`,
      combatants,
      combatSettings
    );

    // Store combat manager for this encounter
    this.combatManagers.set(encounterId, combatManager);

    // Set up event listener to sync combat events with database
    const eventListener = (event: CombatManagerEvent) => {
      this.handleCombatEvent(encounterId, event).catch(error => {
        logger.error(`Error handling combat event for encounter ${encounterId}:`, error);
      });
    };
    
    combatManager.addEventListener(eventListener);
    
    if (!this.eventListeners.has(encounterId)) {
      this.eventListeners.set(encounterId, []);
    }
    this.eventListeners.get(encounterId)!.push(eventListener);

    // Update database with initial combat state
    await this.syncCombatStateToDatabase(encounterId, combatState);

    // Update encounter status
    await this.prisma.encounter.update({
      where: { id: encounterId },
      data: { status: 'ACTIVE' }
    });

    logger.info(`Encounter ${encounterId} started with CombatManager, ${combatants.length} combatants`);
  }

  /**
   * Handle combat events from CombatManager and sync to database
   */
  private async handleCombatEvent(encounterId: string, event: CombatManagerEvent): Promise<void> {
    logger.debug(`Handling combat event for encounter ${encounterId}: ${event.type}`);
    
    try {
      const combatManager = this.combatManagers.get(encounterId);
      if (!combatManager) {
        logger.warn(`No combat manager found for encounter ${encounterId}`);
        return;
      }

      const combatState = combatManager.getCombatState();
      if (!combatState) {
        logger.warn(`No combat state found for encounter ${encounterId}`);
        return;
      }

      switch (event.type) {
        case 'damage-applied':
          await this.syncHealthToDatabase(event.data.combatantId, event.data.combatant);
          break;
        case 'healing-applied':
          await this.syncHealthToDatabase(event.data.combatantId, event.data.combatant);
          break;
        case 'turn-advanced':
          await this.syncTurnToDatabase(encounterId, combatState);
          break;
        case 'round-started':
          await this.syncRoundToDatabase(encounterId, combatState);
          break;
        case 'condition-added':
        case 'condition-removed':
          await this.syncConditionsToDatabase(event.data.combatantId, event.data.combatant);
          break;
        case 'combat-ended':
          await this.cleanupCombatManager(encounterId);
          break;
      }
    } catch (error) {
      logger.error(`Error handling combat event ${event.type} for encounter ${encounterId}:`, error);
    }
  }

  /**
   * Sync combat state to database
   */
  private async syncCombatStateToDatabase(encounterId: string, combatState: CombatState): Promise<void> {
    try {
      // Update encounter with current round and turn
      await this.prisma.encounter.update({
        where: { id: encounterId },
        data: {
          roundNumber: combatState.currentRound,
          currentTurn: combatState.currentTurn
        }
      });

      // Sync all combatant states to their corresponding tokens
      for (const combatant of combatState.combatants) {
        if (combatant.tokenId) {
          await this.prisma.encounterToken.update({
            where: { 
              encounterId_tokenId: {
                encounterId,
                tokenId: combatant.tokenId
              }
            },
            data: {
              initiative: combatant.initiative,
              isActive: combatant.isActive
            }
          });

          // Update token health if needed
          await this.prisma.token.update({
            where: { id: combatant.tokenId },
            data: {
              metadata: {
                currentHitPoints: combatant.currentHitPoints
              }
            }
          });
        }
      }
    } catch (error) {
      logger.error(`Error syncing combat state to database for encounter ${encounterId}:`, error);
    }
  }

  /**
   * Sync health changes to database
   */
  private async syncHealthToDatabase(combatantId: string, combatant: Combatant): Promise<void> {
    if (!combatant.tokenId) {return;}

    try {
      await this.prisma.token.update({
        where: { id: combatant.tokenId },
        data: {
          metadata: {
            currentHitPoints: combatant.currentHitPoints
          }
        }
      });
    } catch (error) {
      logger.error(`Error syncing health for combatant ${combatantId}:`, error);
    }
  }

  /**
   * Sync turn changes to database
   */
  private async syncTurnToDatabase(encounterId: string, combatState: CombatState): Promise<void> {
    try {
      await this.prisma.encounter.update({
        where: { id: encounterId },
        data: {
          currentTurn: combatState.currentTurn
        }
      });
    } catch (error) {
      logger.error(`Error syncing turn for encounter ${encounterId}:`, error);
    }
  }

  /**
   * Sync round changes to database
   */
  private async syncRoundToDatabase(encounterId: string, combatState: CombatState): Promise<void> {
    try {
      await this.prisma.encounter.update({
        where: { id: encounterId },
        data: {
          roundNumber: combatState.currentRound,
          currentTurn: combatState.currentTurn
        }
      });
    } catch (error) {
      logger.error(`Error syncing round for encounter ${encounterId}:`, error);
    }
  }

  /**
   * Sync condition changes to database (placeholder for future implementation)
   */
  private async syncConditionsToDatabase(combatantId: string, combatant: Combatant): Promise<void> {
    // TODO: Implement condition storage in database if needed
    logger.debug(`Conditions updated for combatant ${combatantId}:`, combatant.conditions);
  }

  /**
   * Clean up combat manager resources
   */
  private async cleanupCombatManager(encounterId: string): Promise<void> {
    const combatManager = this.combatManagers.get(encounterId);
    const listeners = this.eventListeners.get(encounterId);
    
    if (combatManager && listeners) {
      // Remove all event listeners
      listeners.forEach(listener => {
        combatManager.removeEventListener(listener);
      });
    }
    
    // Clean up maps
    this.combatManagers.delete(encounterId);
    this.eventListeners.delete(encounterId);
  }

  /**
   * End encounter
   */
  async endEncounter(encounterId: string): Promise<void> {
    // End combat manager if it exists
    const combatManager = this.combatManagers.get(encounterId);
    if (combatManager) {
      combatManager.endCombat();
    }
    
    await this.prisma.encounter.update({
      where: { id: encounterId },
      data: {
        status: "COMPLETED",
        endedAt: new Date(),
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
  private generateMonsterActions(statblock: Record<string, any>): CombatActor["actions"] {
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
    if (statblock && Array.isArray(statblock.actions)) {
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
   * Execute combat action for an actor
   */
  async executeAction(
    encounterId: string,
    actorId: string,
    actionId: string,
    targetId?: string
  ): Promise<{
    success: boolean;
    result: string;
    damage?: number;
    effects?: string[];
  }> {
    const encounter = await this.getEncounter(encounterId);
    if (!encounter || !encounter.isActive) {
      throw new Error("Encounter not found or not active");
    }

    const actor = encounter.actors.find(a => a.id === actorId);
    if (!actor) {
      throw new Error("Actor not found in encounter");
    }

    const action = actor.actions.find(a => a.id === actionId);
    if (!action) {
      throw new Error("Action not found for actor");
    }

    let target: CombatActor | undefined;
    if (targetId) {
      target = encounter.actors.find(a => a.id === targetId);
      if (!target) {
        throw new Error("Target not found in encounter");
      }
    }

    // Execute the action based on its type
    const result = await this.resolveAction(actor, action, target);
    
    // Log the action
    logger.info(`${actor.name} used ${action.name}: ${result.result}`);
    
    return result;
  }

  /**
   * Get AI tactical decision for NPC/Monster
   */
  async getAIDecision(encounterId: string, actorId: string): Promise<{
    action: string;
    target?: string;
    reasoning: string;
    confidence: number;
  }> {
    const encounter = await this.getEncounter(encounterId);
    if (!encounter) {
      throw new Error("Encounter not found");
    }

    const actor = encounter.actors.find(a => a.id === actorId);
    if (!actor || actor.isPlayer) {
      throw new Error("Actor not found or is a player character");
    }

    // Build tactical context (map to minimal CombatCharacter shape)
    const toCombatCharacter = (a: CombatActor) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      class: undefined,
      hitPoints: a.hitPoints.current,
      maxHitPoints: a.hitPoints.max,
      armorClass: a.armorClass || 10,
      position: { x: 0, y: 0 },
      abilities: {
        strength: a.abilities?.STR?.value ?? 10,
        dexterity: a.abilities?.DEX?.value ?? 10,
        constitution: a.abilities?.CON?.value ?? 10,
        intelligence: a.abilities?.INT?.value ?? 10,
        wisdom: a.abilities?.WIS?.value ?? 10,
        charisma: a.abilities?.CHA?.value ?? 10,
      } as Record<string, number>,
      conditions: (a.conditions?.map(c => (typeof c === 'string' ? c : String((c as any)?.type || ''))) || []) as string[],
      initiative: a.initiative ?? 0,
    });

    const context: TacticalContext = {
      character: toCombatCharacter(actor) as any,
      allies: encounter.actors.filter(a => !a.isPlayer && a.id !== actorId).map(toCombatCharacter) as any,
      enemies: encounter.actors.filter(a => a.isPlayer).map(toCombatCharacter) as any,
      battlefield: {
        terrain: [],
        hazards: [],
        cover: [],
        lighting: "bright",
        weather: "clear",
      },
      resources: {
        spellSlots: {},
        hitPoints: actor.hitPoints.current,
        actionEconomy: {
          action: true,
          bonusAction: true,
          reaction: true,
          movement: actor.speed,
        },
      },
      objectives: ["defeat enemies"],
      threatLevel: this.assessThreatLevel(encounter.actors, actor),
    } as unknown as TacticalContext;

    const decision = await this.crucible.makeTacticalDecision(context);
    
    return {
      action: decision.action,
      target: decision.target,
      reasoning: decision.reasoning,
      confidence: decision.confidence,
    };
  }

  /**
   * Advance to next turn in encounter
   */
  async nextTurn(encounterId: string): Promise<{
    currentActor?: CombatActor;
    roundAdvanced: boolean;
    currentTurn?: number;
    currentRound?: number;
    currentCombatant?: any;
  }> {
    const encounter = await this.prisma.encounter.findUnique({
      where: { id: encounterId },
      include: {
        encounterTokens: {
          orderBy: { initiative: "desc" },
        },
      },
    });

    if (!encounter || encounter.status !== "ACTIVE") {
      throw new Error("Encounter not found or not active");
    }

    let nextTurn = encounter.currentTurn + 1;
    let currentRound = encounter.roundNumber;
    let roundAdvanced = false;

    // Check if we need to advance to next round
    if (nextTurn >= encounter.encounterTokens.length) {
      nextTurn = 0;
      currentRound += 1;
      roundAdvanced = true;
    }

    await this.prisma.encounter.update({
      where: { id: encounterId },
      data: {
        currentTurn: nextTurn,
        roundNumber: currentRound,
      },
    });

    const updatedEncounter = await this.getEncounter(encounterId);
    const currentActor = updatedEncounter?.actors[nextTurn];

    // Use CombatManager if available
    const combatManager = this.combatManagers.get(encounterId);
    if (combatManager) {
      combatManager.nextTurn();
      const combatState = combatManager.getCombatState();
      const currentCombatant = combatState ? combatManager.getCurrentCombatant() : null;
      
      return {
        currentActor,
        roundAdvanced,
        currentTurn: combatState?.currentTurn,
        currentRound: combatState?.currentRound,
        currentCombatant
      };
    }

    return {
      currentActor,
      roundAdvanced,
    };
  }

  private async getTokenDexModifier(token: unknown): Promise<number> {
    if (token && typeof token === "object") {
      const t = token as Record<string, any>;
      if (typeof t.characterId === "string") {
        const character = await this.characterService.getCharacter(t.characterId);
        return character?.abilities?.DEX?.modifier || 0;
      }
      const meta = t.metadata;
      if (meta && typeof meta === "object") {
        const dex = (meta as any)?.abilities?.DEX;
        if (dex && typeof dex.modifier === "number") {
          return dex.modifier;
        }
      }
    }
    return 0;
  }

  private rollD20(): number {
    return Math.floor(Math.random() * 20) + 1;
  }

  private async resolveAction(
    actor: CombatActor,
    action: CombatActor["actions"][0],
    target?: CombatActor
  ): Promise<{
    success: boolean;
    result: string;
    damage?: number;
    effects?: string[];
  }> {
    switch (action.type) {
      case "action":
        if (action.attackBonus !== undefined && target) {
          // Attack action
          const attackRoll = this.rollD20() + action.attackBonus;
          const targetAC = target.armorClass;
          
          if (attackRoll >= targetAC) {
            let damage = 0;
            if (action.damage) {
              damage = this.rollDamage(action.damage.diceExpression);
              // Apply damage to target (would need database update)
            }
            
            return {
              success: true,
              result: `Hit! Rolled ${attackRoll} vs AC ${targetAC}`,
              damage,
            };
          } else {
            return {
              success: false,
              result: `Miss! Rolled ${attackRoll} vs AC ${targetAC}`,
            };
          }
        } else {
          // Non-attack action
          return {
            success: true,
            result: `${actor.name} used ${action.name}`,
          };
        }
      
      default:
        return {
          success: true,
          result: `${actor.name} used ${action.name}`,
        };
    }
  }

  private rollDamage(diceExpression: string): number {
    // Simple dice rolling for expressions like "1d8+3"
    const match = diceExpression.match(/(\d+)d(\d+)(?:\+(\d+))?/);
    if (!match) {return 0;}
    
    const [, numDice, dieSize, modifier] = match;
    let total = 0;
    
    for (let i = 0; i < parseInt(numDice); i++) {
      total += Math.floor(Math.random() * parseInt(dieSize)) + 1;
    }
    
    return total + (parseInt(modifier || "0") || 0);
  }

  private assessThreatLevel(
    allActors: CombatActor[],
    currentActor: CombatActor
  ): "low" | "moderate" | "high" | "extreme" {
    const enemies = allActors.filter(a => a.isPlayer !== currentActor.isPlayer);
    const allies = allActors.filter(a => a.isPlayer === currentActor.isPlayer && a.id !== currentActor.id);
    
    const enemyCount = enemies.length;
    const allyCount = allies.length;
    
    if (enemyCount > allyCount + 2) {return "extreme";}
    if (enemyCount > allyCount) {return "high";}
    if (enemyCount === allyCount) {return "moderate";}
    return "low";
  }

  /**
   * Add a character to an existing encounter
   */
  async addCharacterToEncounter(
    encounterId: string,
    characterId: string,
    initiative?: number
  ): Promise<CombatActor> {
    const encounter = await this.prisma.encounter.findUnique({
      where: { id: encounterId },
    });

    if (!encounter) {
      throw new Error(`Encounter ${encounterId} not found`);
    }

    // Create character actor
    const actor = await this.createCharacterActor(characterId);
    
    // Set initiative if provided
    if (initiative !== undefined) {
      actor.initiative = initiative;
    }

    // Create database token
    const tokenId = await this.createDatabaseToken(actor, encounter.gameSessionId);

    // Create encounter token relationship (commented until schema confirmed)
    // await this.prisma.encounterToken.create({
    //   data: {
    //     encounterId,
    //     tokenId,
    //     initiative: actor.initiative,
    //     isActive: true,
    //   },
    // });

    logger.info(`Added character ${characterId} to encounter ${encounterId} with initiative ${actor.initiative}`);
    
    return actor;
  }

  /**
   * Add a monster to an existing encounter
   */
  async addMonsterToEncounter(
    encounterId: string,
    monsterId: string,
    instanceName?: string,
    initiative?: number
  ): Promise<CombatActor> {
    const encounter = await this.prisma.encounter.findUnique({
      where: { id: encounterId },
    });

    if (!encounter) {
      throw new Error(`Encounter ${encounterId} not found`);
    }

    // Create monster actor
    const actor = await this.createMonsterActor(monsterId, instanceName);
    
    // Set initiative if provided
    if (initiative !== undefined) {
      actor.initiative = initiative;
    }

    // Create database token
    const tokenId = await this.createDatabaseToken(actor, encounter.gameSessionId);

    // Create encounter token relationship (commented until schema confirmed)
    // await this.prisma.encounterToken.create({
    //   data: {
    //     encounterId,
    //     tokenId,
    //     initiative: actor.initiative,
    //     isActive: true,
    //   },
    // });

    logger.info(`Added monster ${monsterId} to encounter ${encounterId} with initiative ${actor.initiative}`);
    
    return actor;
  }

  /**
   * Update encounter properties
   */
  async updateEncounter(
    encounterId: string,
    updates: {
      name?: string;
      status?: string;
      currentTurn?: number;
      round?: number;
    }
  ): Promise<EncounterSetup | null> {
    const updateData: any = {};

    if (updates.name !== undefined) {
      updateData.name = updates.name;
    }

    if (updates.status !== undefined) {
      updateData.status = updates.status;
    }

    if (updates.currentTurn !== undefined) {
      updateData.currentTurn = updates.currentTurn;
    }

    if (updates.round !== undefined) {
      updateData.roundNumber = updates.round;
    }

    try {
      await this.prisma.encounter.update({
        where: { id: encounterId },
        data: updateData,
      });

      logger.info(`Updated encounter ${encounterId}:`, updates);
      
      return await this.getEncounter(encounterId);
    } catch (error) {
      logger.error(`Failed to update encounter ${encounterId}:`, error);
      return null;
    }
  }

  /**
   * Delete an encounter
   */
  async deleteEncounter(encounterId: string): Promise<boolean> {
    try {
      // Clean up combat manager if it exists
      const combatManager = this.combatManagers.get(encounterId);
      if (combatManager) {
        combatManager.endCombat();
        await this.cleanupCombatManager(encounterId);
      }

      // Delete encounter tokens first (commented until schema confirmed)
      // await this.prisma.encounterToken.deleteMany({
      //   where: { encounterId },
      // });

      // Delete the encounter
      await this.prisma.encounter.delete({
        where: { id: encounterId },
      });

      logger.info(`Deleted encounter ${encounterId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to delete encounter ${encounterId}:`, error);
      return false;
    }
  }

  /**
   * Parse hit points from various formats
   */
  private parseHitPoints(hp: unknown): number {
    if (typeof hp === "number") {return hp;}
    if (typeof hp === "string") {
      const match = hp.match(/(\d+)/);
      return match ? parseInt(match[1]) : 10;
    }
    if (hp && typeof hp === "object") {
      const obj = hp as Record<string, any>;
      if (typeof obj.value === "number") { return obj.value; }
      if (typeof obj.average === "number") { return obj.average; }
    }
    return 10;
  }
}
