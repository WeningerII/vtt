import { World, EntityId } from "../World";
import { logger } from "@vtt/logging";
import { CombatStore, _CombatData } from "../components/Combat";
import { SpellcastingSystem, SpellEffect } from "./SpellcastingSystem";

export interface CombatAction {
  actorId: EntityId;
  entityId: EntityId;
  type: "attack" | "spell" | "movement" | "dash" | "dodge" | "help" | "hide" | "ready" | "search";
  targetId?: EntityId;
  targets?: EntityId[];
  data?: any;
  spellId?: string;
  casterLevel?: number;
  spellSlotLevel?: number;
  spellEffects?: SpellEffect[];
  requiresConcentration?: boolean;
  duration?: number;
}

export interface CombatEvent {
  type:
    | "combat_start"
    | "combat_end"
    | "turn_start"
    | "turn_end"
    | "initiative_rolled"
    | "action_taken";
  entityId: EntityId;
  data?: any;
  timestamp: number;
}

export class CombatSystem {
  private world: World;
  private combat: CombatStore;
  private spellcastingSystem?: SpellcastingSystem;
  private isActive: boolean = false;
  private currentTurn: number = 0;
  private turnOrder: EntityId[] = [];
  private round: number = 1;
  private eventHandlers: Map<string, Function[]> = new Map();

  constructor(world: World, combat: CombatStore, spellcastingSystem?: SpellcastingSystem) {
    this.world = world;
    this.combat = combat;
    this.spellcastingSystem = spellcastingSystem;
  }

  startCombat(participants: EntityId[]): void {
    if (this.isActive) {
      this.endCombat();
    }

    this.isActive = true;
    this.round = 1;
    this.currentTurn = 0;

    // Roll initiative for all participants
    for (const entityId of participants) {
      const initiative = this.rollInitiative(entityId);
      this.combat.add(entityId, { initiative, isActive: true });
      this.emitEvent("initiative_rolled", entityId, { initiative });
    }

    // Set turn order
    this.turnOrder = this.combat.getInitiativeOrder();

    // Set turn order numbers
    this.turnOrder.forEach((_entityId, __index) => {
      this.combat.setTurnOrder(entityId, index);
    });

    if (this.turnOrder.length > 0) {
      const firstEntity = this.turnOrder[0];
      if (firstEntity !== undefined) {
        this.emitEvent("combat_start", firstEntity);
      }
    }
    this.startTurn();
  }

  endCombat(): void {
    if (!this.isActive) {return;}

    const allCombatants = this.combat.getAllInCombat();

    // Clean up combat state
    for (const entityId of allCombatants) {
      this.combat.remove(entityId);
    }

    this.isActive = false;
    this.currentTurn = 0;
    this.turnOrder = [];
    this.round = 1;

    this.emitEvent("combat_end", 0, { participants: allCombatants });
  }

  nextTurn(): void {
    if (!this.isActive) {return;}

    // End current turn
    if (this.turnOrder.length > 0) {
      const currentEntity = this.turnOrder[this.currentTurn];
      if (currentEntity !== undefined) {
        this.combat.endTurn(currentEntity);
      }
      if (currentEntity !== undefined) {
        this.emitEvent("turn_end", currentEntity, { round: this.round });
      }
    }

    // Advance to next turn
    this.currentTurn++;

    // Check if we've completed a round
    if (this.currentTurn >= this.turnOrder.length) {
      this.currentTurn = 0;
      this.round++;
    }

    this.startTurn();
  }

  private startTurn(): void {
    if (!this.isActive || this.turnOrder.length === 0) {return;}

    const currentEntity = this.turnOrder[this.currentTurn];
    if (currentEntity !== undefined) {
      this.combat.startTurn(currentEntity);
      this.emitEvent("turn_start", currentEntity, {
        round: this.round,
        turnInRound: this.currentTurn + 1,
      });
    }
  }

  getCurrentActor(): EntityId | null {
    if (!this.isActive || this.turnOrder.length === 0) {return null;}
    const actor = this.turnOrder[this.currentTurn];
    return actor !== undefined ? actor : null;
  }

  canTakeAction(entityId: EntityId, actionCost: number = 1): boolean {
    if (!this.isActive) {return false;}

    const currentActor = this.getCurrentActor();
    if (currentActor !== entityId) {return false;}

    const combatData = this.combat.get(entityId);
    return combatData ? combatData.actionPoints >= actionCost : false;
  }

  takeAction(action: CombatAction): boolean {
    if (!this.canTakeAction(action.actorId)) {return false;}

    const actionCost = this.getActionCost(action.type);
    if (!this.combat.useAction(action.actorId, actionCost)) {return false;}

    // Process the action
    this.processAction(action);

    this.emitEvent("action_taken", action.actorId, action);
    return true;
  }

  canTakeReaction(entityId: EntityId): boolean {
    if (!this.isActive) {return false;}

    const combatData = this.combat.get(entityId);
    return combatData ? !combatData.reactionUsed : false;
  }

  takeReaction(entityId: EntityId, reactionData: any): boolean {
    if (!this.canTakeReaction(entityId)) {return false;}

    this.combat.useReaction(entityId);
    this.emitEvent("action_taken", entityId, {
      type: "reaction",
      data: reactionData,
    });
    return true;
  }

  private rollInitiative(entityId: EntityId): number {
    // Basic initiative roll: d20 + dex modifier
    const baseRoll = Math.floor(Math.random() * 20) + 1;
    const dexModifier = this.getDexterityModifier(entityId);
    const tiebreaker = Math.random(); // For consistent tie-breaking

    return baseRoll + dexModifier + tiebreaker;
  }

  private getDexterityModifier(_entityId: EntityId): number {
    // This would integrate with the Stats component
    // For now, return a random modifier between -2 and +5
    return Math.floor(Math.random() * 8) - 2;
  }

  private getActionCost(actionType: string): number {
    switch (actionType) {
      case "attack":
      case "spell":
      case "dodge":
      case "help":
      case "hide":
      case "ready":
      case "search":
        return 1; // Full action
      case "dash":
        return 1; // Full action
      case "movement":
        return 0; // Movement is free on your turn
      default:
        return 1;
    }
  }

  private processAction(action: CombatAction): void {
    switch (action.type) {
      case "movement":
        this.processMovement(action);
        break;
      case "attack":
        this.processAttack(action);
        break;
      case "spell":
        this.processSpell(action);
        break;
      case "dash":
        this.processDash(action);
        break;
      case "dodge":
        this.processDodge(action);
        break;
      // Add more action types as needed
    }
  }

  private processMovement(action: CombatAction): void {
    const combatData = this.combat.get(action.actorId);
    if (combatData) {
      combatData.hasMovedThisTurn = true;
    }
  }

  private processAttack(action: CombatAction): void {
    if (!action.targetId) {return;}

    const attackerStats = this.world.getComponent("stats", action.entityId);
    const targetHealth = this.world.getComponent("health", action.targetId);

    if (!attackerStats || !targetHealth) {return;}

    // Simple attack resolution
    const attackRoll = Math.floor(Math.random() * 20) + 1;
    const attackModifier = attackerStats.abilityModifiers?.strength || 0;
    const proficiencyBonus = attackerStats.proficiencyBonus || 2;

    const totalAttack = attackRoll + attackModifier + proficiencyBonus;
    const targetAC = this.world.getComponent("stats", action.targetId)?.armorClass || 10;

    if (totalAttack >= targetAC) {
      // Hit - roll damage
      const damage = Math.floor(Math.random() * 8) + 1 + attackModifier; // 1d8 + modifier
      this.world.getStore("health").takeDamage(action.targetId, damage);

      // Check for concentration break
      if (this.spellcastingSystem && this.combatStore.get(action.targetId)?.concentrating) {
        this.spellcastingSystem.concentrationCheck(action.targetId, damage);
      }

      this.emitEvent("attack_hit", action.entityId, {
        targetId: action.targetId,
        damage,
        attackRoll,
        totalAttack,
      });
    } else {
      this.emitEvent("attack_miss", action.entityId, {
        targetId: action.targetId,
        attackRoll,
        totalAttack,
        targetAC,
      });
    }
  }

  private processSpell(action: CombatAction): void {
    if (!this.spellcastingSystem) {
      logger.warn("SpellcastingSystem not available");
      return;
    }

    // Extract spell data from action
    const spellInstance = {
      spellId: action.spellId || "",
      casterLevel: action.casterLevel || 1,
      spellSlotLevel: action.spellSlotLevel || 1,
      casterId: action.entityId,
      targets: action.targets || [],
      effects: action.spellEffects || [],
      concentration: action.requiresConcentration || false,
      duration: action.duration,
    };

    const success = this.spellcastingSystem.castSpell(spellInstance);

    this.emit("spell_cast", {
      entityId: action.entityId,
      spellId: spellInstance.spellId,
      targets: spellInstance.targets,
      success,
    });
  }

  private processDash(_action: CombatAction): void {
    // Double movement speed for the turn
  }

  private processDodge(_action: CombatAction): void {
    // Add dodge bonus until start of next turn
  }

  // Event system
  on(_eventType: string, _handler: (...args: any[]) => any): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
  }

  off(_eventType: string, _handler: (...args: any[]) => any): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private emitEvent(type: string, entityId: EntityId, data?: any): void {
    const event: CombatEvent = {
      type: type as any,
      entityId,
      data,
      timestamp: Date.now(),
    };

    const handlers = this.eventHandlers.get(type);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(event);
        } catch (error) {
          logger.error("Combat event handler error:", error);
        }
      });
    }
  }

  // Public accessors
  isInCombat(): boolean {
    return this.isActive;
  }

  getCurrentRound(): number {
    return this.round;
  }

  getTurnOrder(): EntityId[] {
    return [...this.turnOrder];
  }

  getCombatants(): EntityId[] {
    return this.combat.getAllInCombat();
  }

  update(_deltaTime: number): void {
    if (!this.isActive) {return;}

    // Update combat-related logic
    // Handle ongoing effects, concentration checks, etc.
  }
}
