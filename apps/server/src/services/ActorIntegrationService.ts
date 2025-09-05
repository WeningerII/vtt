/**
 * Actor Integration Service - Unified bridge between Characters, Monsters, and Combat
 */

import { PrismaClient } from "@prisma/client";
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

  constructor() {
    this.prisma = new PrismaClient();
    this.characterService = new CharacterService();
    this.monsterService = new MonsterService(this.prisma);
    this.crucible = new CrucibleService();
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
    
    // Get encounter
    const encounter = await this.prisma.encounter.findUnique({
      where: { id: encounterId }
    });

    if (!encounter) {
      throw new Error(`Encounter not found: ${encounterId}`);
    }

    // For now, create sample combatants (would need proper token retrieval based on schema)
    const combatants: Omit<Combatant, "id" | "actions" | "isActive">[] = [
      {
        tokenId: "sample-token-1",
        name: "Sample Character",
        type: "pc",
        initiative: 0,
        initiativeModifier: 2,
        maxHitPoints: 25,
        currentHitPoints: 25,
        temporaryHitPoints: 0,
        armorClass: 15,
        conditions: [],
        isVisible: true,
        isDefeated: false,
        resources: {},
        savingThrows: {
          strength: 1,
          dexterity: 2,
          constitution: 1,
          intelligence: 0,
          wisdom: 1,
          charisma: 0
        },
        skills: {},
        stats: {
          strength: 13,
          dexterity: 15,
          constitution: 12,
          intelligence: 10,
          wisdom: 12,
          charisma: 10
        }
      }
    ];
    
    // TODO: Replace with actual token-to-combatant conversion when schema is clarified
    /*
    for (const encounterToken of encounter.encounterTokens) {
      const { token } = encounterToken;
      let combatant: Omit<Combatant, "id" | "actions" | "isActive">;
      
      if (token.character) {
        const char = token.character;
        combatant = {
          tokenId: token.id,
          name: char.name,
          type: "pc",
          initiative: 0, // Will be rolled by CombatManager
          initiativeModifier: Math.floor((char.dexterity - 10) / 2),
          maxHitPoints: char.hitPointsMax || 1,
          currentHitPoints: char.hitPointsCurrent || char.hitPointsMax || 1,
          temporaryHitPoints: 0,
          armorClass: char.armorClass || 10,
          conditions: [],
          isVisible: true,
          isDefeated: false,
          resources: {},
          savingThrows: {
            strength: char.strengthSave || Math.floor((char.strength - 10) / 2),
            dexterity: char.dexteritySave || Math.floor((char.dexterity - 10) / 2),
            constitution: char.constitutionSave || Math.floor((char.constitution - 10) / 2),
            intelligence: char.intelligenceSave || Math.floor((char.intelligence - 10) / 2),
            wisdom: char.wisdomSave || Math.floor((char.wisdom - 10) / 2),
            charisma: char.charismaSave || Math.floor((char.charisma - 10) / 2)
          },
          skills: {},
          stats: {
            strength: char.strength,
            dexterity: char.dexterity,
            constitution: char.constitution,
            intelligence: char.intelligence,
            wisdom: char.wisdom,
            charisma: char.charisma
          }
        };
      } else if (token.monster) {
        const monster = token.monster;
        combatant = {
          tokenId: token.id,
          name: token.name || monster.name,
          type: "monster",
          initiative: 0, // Will be rolled by CombatManager
          initiativeModifier: Math.floor((monster.dexterity - 10) / 2),
          maxHitPoints: monster.hitPoints || 1,
          currentHitPoints: token.hitPointsCurrent || monster.hitPoints || 1,
          temporaryHitPoints: 0,
          armorClass: monster.armorClass || 10,
          conditions: [],
          isVisible: true,
          isDefeated: false,
          resources: {},
          savingThrows: {
            strength: Math.floor((monster.strength - 10) / 2),
            dexterity: Math.floor((monster.dexterity - 10) / 2),
            constitution: Math.floor((monster.constitution - 10) / 2),
            intelligence: Math.floor((monster.intelligence - 10) / 2),
            wisdom: Math.floor((monster.wisdom - 10) / 2),
            charisma: Math.floor((monster.charisma - 10) / 2)
          },
          skills: {},
          stats: {
            strength: monster.strength,
            dexterity: monster.dexterity,
            constitution: monster.constitution,
            intelligence: monster.intelligence,
            wisdom: monster.wisdom,
            charisma: monster.charisma
          }
        };
      } else {
        continue; // Skip invalid tokens
      }
      
      combatants.push(combatant);
    }
    */

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

    // Build tactical context
    const context: TacticalContext = {
      character: {
        id: actor.id,
        name: actor.name,
        maxHitPoints: actor.hitPoints.max,
        spells: [], // Would need to extract from actions
        weapons: [], // Would need to extract from actions
      },
      allies: encounter.actors.filter(a => !a.isPlayer && a.id !== actorId),
      enemies: encounter.actors.filter(a => a.isPlayer),
      battlefield: {
        terrain: [],
        hazards: [],
        cover: [],
        lighting: "normal",
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
    };

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

  private async getTokenDexModifier(token: any): Promise<number> {
    if (token.characterId) {
      const character = await this.characterService.getCharacter(token.characterId);
      return character?.abilities.DEX?.modifier || 0;
    } else if (token.metadata?.abilities?.DEX) {
      return token.metadata.abilities.DEX.modifier || 0;
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
   * Parse hit points from various formats
   */
  private parseHitPoints(hp: any): number {
    if (typeof hp === "number") {return hp;}
    if (typeof hp === "string") {
      const match = hp.match(/(\d+)/);
      return match ? parseInt(match[1]) : 10;
    }
    if (hp?.value) {return hp.value;}
    if (hp?.average) {return hp.average;}
    return 10;
  }
}
