/**
 * Condition system for managing status effects and their interactions
 */

import { ConditionsStore } from "../components/Conditions";
import { StatsStore } from "../components/Stats";

export interface ConditionEffect {
  entity: number;
  conditionType: string;
  effect: "advantage" | "disadvantage" | "modifier" | "immunity" | "resistance";
  target: "attack" | "save" | "skill" | "damage" | "speed";
  value?: number;
}

export class ConditionSystem {
  private conditionsStore: ConditionsStore;
  private statsStore: StatsStore;
  private eventHandlers: Map<string, Function[]> = new Map();

  constructor(conditionsStore: ConditionsStore, statsStore: StatsStore) {
    this.conditionsStore = conditionsStore;
    this.statsStore = statsStore;
  }

  update(_deltaTime: number): void {
    // Process condition durations at end of each turn
    this.processConditionDurations();

    // Handle saving throws for conditions
    this.processSavingThrows();
  }

  private processConditionDurations(): void {
    this.conditionsStore.updateDurations();
  }

  private processSavingThrows(): void {
    this.conditionsStore.forEach((_entity, __conditions) => {
      for (const condition of conditions) {
        if (condition.saveEndOfTurn) {
          const { ability, dc } = condition.saveEndOfTurn;
          const modifier = this.statsStore.getSavingThrowModifier(entity, ability, false);
          const roll = this.rollD20() + modifier;

          if (roll >= dc) {
            this.conditionsStore.remove(entity, condition.type);
            this.emit("conditionSaved", {
              entity,
              condition: condition.type,
              roll,
              dc,
            });
          }
        }
      }
    });
  }

  // Apply condition effects to rolls and calculations
  getAttackModifiers(entity: number): {
    advantage: boolean;
    disadvantage: boolean;
    modifier: number;
  } {
    const conditions = this.conditionsStore.get(entity);
    let advantage = false;
    let disadvantage = false;
    const modifier = 0;

    for (const condition of conditions) {
      switch (condition.type) {
        case "blessed":
          advantage = true;
          break;
        case "blinded":
        case "frightened":
        case "poisoned":
        case "prone":
          disadvantage = true;
          break;
        case "invisible":
          advantage = true;
          break;
        case "paralyzed":
        case "stunned":
        case "unconscious":
          // These prevent attacks entirely
          return { advantage: false, disadvantage: true, modifier: -Infinity };
      }
    }

    return { advantage, disadvantage, modifier };
  }

  getSavingThrowModifiers(
    entity: number,
    ability: string,
  ): { advantage: boolean; disadvantage: boolean; modifier: number } {
    const conditions = this.conditionsStore.get(entity);
    let advantage = false;
    let disadvantage = false;
    const modifier = 0;

    for (const condition of conditions) {
      switch (condition.type) {
        case "blessed":
          if (["wisdom", "charisma"].includes(ability)) {
            advantage = true;
          }
          break;
        case "frightened":
          if (["wisdom"].includes(ability)) {
            disadvantage = true;
          }
          break;
        case "poisoned":
          if (["constitution"].includes(ability)) {
            disadvantage = true;
          }
          break;
        case "paralyzed":
        case "stunned":
        case "unconscious":
          if (["strength", "dexterity"].includes(ability)) {
            return { advantage: false, disadvantage: true, modifier: -Infinity };
          }
          break;
      }
    }

    return { advantage, disadvantage, modifier };
  }

  getSpeedModifier(entity: number): number {
    const conditions = this.conditionsStore.get(entity);
    let speedMultiplier = 1;

    for (const condition of conditions) {
      switch (condition.type) {
        case "hasted":
          speedMultiplier *= 2;
          break;
        case "slowed":
          speedMultiplier *= 0.5;
          break;
        case "grappled":
        case "restrained":
          speedMultiplier = 0;
          break;
        case "prone":
          speedMultiplier *= 0.5;
          break;
        case "exhaustion":
          {
            const exhaustionLevel = this.conditionsStore.getExhaustionLevel(entity);
            if (exhaustionLevel >= 2) speedMultiplier *= 0.5;
            if (exhaustionLevel >= 5) speedMultiplier = 0;
          }
          break;
      }
    }

    return speedMultiplier;
  }

  getDamageResistances(entity: number): string[] {
    const conditions = this.conditionsStore.get(entity);
    const resistances: string[] = [];

    for (const condition of conditions) {
      // Add condition-based resistances
      if (condition.type === "blessed") {
        resistances.push("necrotic");
      }
    }

    return resistances;
  }

  getDamageImmunities(entity: number): string[] {
    const conditions = this.conditionsStore.get(entity);
    const immunities: string[] = [];

    for (const condition of conditions) {
      // Add condition-based immunities
      if (condition.type === "petrified") {
        immunities.push("poison", "disease");
      }
    }

    return immunities;
  }

  // Check if entity can perform specific actions
  canTakeActions(entity: number): boolean {
    return this.conditionsStore.canAct(entity);
  }

  canMove(entity: number): boolean {
    return this.conditionsStore.canMove(entity);
  }

  canSee(entity: number): boolean {
    return this.conditionsStore.canSee(entity);
  }

  canHear(entity: number): boolean {
    return this.conditionsStore.canHear(entity);
  }

  canConcentrate(entity: number): boolean {
    return (
      !this.conditionsStore.isIncapacitated(entity) &&
      !this.conditionsStore.has(entity, "unconscious")
    );
  }

  // Concentration checks
  makeConcentrationCheck(entity: number, damage: number): boolean {
    if (!this.conditionsStore.has(entity, "concentration")) {
      return true; // Not concentrating
    }

    const dc = Math.max(10, Math.floor(damage / 2));
    const modifier = this.statsStore.getSavingThrowModifier(entity, "constitution", false);
    const roll = this.rollD20() + modifier;

    const success = roll >= dc;
    if (!success) {
      this.conditionsStore.remove(entity, "concentration");
      this.emit("concentrationBroken", { entity, roll, dc, damage });
    }

    return success;
  }

  // Utility methods
  private rollD20(): number {
    return Math.floor(Math.random() * 20) + 1;
  }

  // Event system
  on(_event: string, _handler: (...args: any[]) => any): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  off(_event: string, _handler: (...args: any[]) => any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(data));
    }
  }
}
