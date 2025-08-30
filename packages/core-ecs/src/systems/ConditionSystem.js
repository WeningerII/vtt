/**
 * Condition system for managing status effects and their interactions
 */
export class ConditionSystem {
  constructor(conditionsStore, statsStore) {
    this.eventHandlers = new Map();
    this.conditionsStore = conditionsStore;
    this.statsStore = statsStore;
  }
  update(deltaTime) {
    // Process condition durations at end of each turn
    this.processConditionDurations();
    // Handle saving throws for conditions
    this.processSavingThrows();
  }
  processConditionDurations() {
    this.conditionsStore.updateDurations();
  }
  processSavingThrows() {
    this.conditionsStore.forEach((entity, conditions) => {
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
  getAttackModifiers(entity) {
    const conditions = this.conditionsStore.get(entity);
    let advantage = false;
    let disadvantage = false;
    let modifier = 0;
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
  getSavingThrowModifiers(entity, ability) {
    const conditions = this.conditionsStore.get(entity);
    let advantage = false;
    let disadvantage = false;
    let modifier = 0;
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
  getSpeedModifier(entity) {
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
          const exhaustionLevel = this.conditionsStore.getExhaustionLevel(entity);
          if (exhaustionLevel >= 2) speedMultiplier *= 0.5;
          if (exhaustionLevel >= 5) speedMultiplier = 0;
          break;
      }
    }
    return speedMultiplier;
  }
  getDamageResistances(entity) {
    const conditions = this.conditionsStore.get(entity);
    const resistances = [];
    for (const condition of conditions) {
      // Add condition-based resistances
      if (condition.type === "blessed") {
        resistances.push("necrotic");
      }
    }
    return resistances;
  }
  getDamageImmunities(entity) {
    const conditions = this.conditionsStore.get(entity);
    const immunities = [];
    for (const condition of conditions) {
      // Add condition-based immunities
      if (condition.type === "petrified") {
        immunities.push("poison", "disease");
      }
    }
    return immunities;
  }
  // Check if entity can perform specific actions
  canTakeActions(entity) {
    return this.conditionsStore.canAct(entity);
  }
  canMove(entity) {
    return this.conditionsStore.canMove(entity);
  }
  canSee(entity) {
    return this.conditionsStore.canSee(entity);
  }
  canHear(entity) {
    return this.conditionsStore.canHear(entity);
  }
  canConcentrate(entity) {
    return (
      !this.conditionsStore.isIncapacitated(entity) &&
      !this.conditionsStore.has(entity, "unconscious")
    );
  }
  // Concentration checks
  makeConcentrationCheck(entity, damage) {
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
  rollD20() {
    return Math.floor(Math.random() * 20) + 1;
  }
  // Event system
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }
  off(event, handler) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }
  emit(event, data) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(data));
    }
  }
}
//# sourceMappingURL=ConditionSystem.js.map
