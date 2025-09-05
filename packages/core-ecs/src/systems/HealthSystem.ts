/**
 * Health system for managing damage, healing, and death
 */

import { HealthStore } from "../components/Health";
import { ConditionsStore } from "../components/Conditions";

export interface DamageEvent {
  entity: number;
  damage: number;
  damageType: string;
  source?: number;
}

export interface HealingEvent {
  entity: number;
  healing: number;
  source?: number;
}

export class HealthSystem {
  private healthStore: HealthStore;
  private conditionsStore: ConditionsStore;
  private eventHandlers: Map<string, Function[]> = new Map();

  constructor(healthStore: HealthStore, conditionsStore: ConditionsStore) {
    this.healthStore = healthStore;
    this.conditionsStore = conditionsStore;
  }

  update(deltaTime: number): void {
    // Process regeneration and damage over time
    this.healthStore.forEach((_entity, __health) => {
      this.processRegeneration(entity, deltaTime);
      this.processDamageOverTime(entity, deltaTime);
    });
  }

  applyDamage(event: DamageEvent): void {
    const { entity, damage, damageType, source } = event;

    if (!this.healthStore.has(entity)) {return;}

    const health = this.healthStore.get(entity);
    if (!health) {return;}

    const originalHP = health.current;
    const success = this.healthStore.takeDamage(entity, damage);

    if (success) {
      const newHealth = this.healthStore.get(entity);
      const actualDamage = originalHP - (newHealth?.current || 0);

      this.emit("damageApplied", {
        entity,
        damage: actualDamage,
        damageType,
        source,
        newHealth: newHealth?.current || 0,
      });

      // Check for death or unconsciousness
      if (this.healthStore.isDead(entity)) {
        this.handleDeath(entity);
      }
    }
  }

  applyHealing(event: HealingEvent): void {
    const { entity, healing, source } = event;

    if (!this.healthStore.has(entity)) {return;}

    const health = this.healthStore.get(entity);
    if (!health) {return;}

    const originalHP = health.current;
    const success = this.healthStore.heal(entity, healing);

    if (success) {
      const newHealth = this.healthStore.get(entity);
      const actualHealing = (newHealth?.current || 0) - originalHP;

      this.emit("healingApplied", {
        entity,
        healing: actualHealing,
        source,
        newHealth: newHealth?.current || 0,
      });

      // Remove unconscious condition if healed above 0
      if (originalHP <= 0 && (newHealth?.current || 0) > 0) {
        this.conditionsStore.remove(entity, "unconscious");
        this.emit("entityRevived", { entity });
      }
    }
  }

  setTemporaryHitPoints(entity: number, tempHP: number): void {
    if (!this.healthStore.has(entity)) {return;}

    const health = this.healthStore.get(entity);
    if (!health) {return;}

    // Temporary hit points don't stack, take the higher value
    const newTempHP = Math.max(health.temporary, tempHP);
    this.healthStore.set(entity, { temporary: newTempHP });

    this.emit("temporaryHitPointsChanged", {
      entity,
      tempHP: newTempHP,
    });
  }

  private handleDeath(entity: number): void {
    // Add unconscious condition
    this.conditionsStore.add(entity, {
      type: "unconscious",
      duration: -1, // Permanent until healed
      source: "death",
    });

    this.emit("entityDied", { entity });
  }

  private processRegeneration(entity: number, deltaTime: number): void {
    // Check for regeneration conditions or abilities
    const conditions = this.conditionsStore.get(entity);
    const regenCondition = conditions.find((c) => c.type === "blessed"); // Example

    if (regenCondition) {
      // Apply small amount of healing over time
      const regenAmount = Math.floor(deltaTime * 0.1); // 0.1 HP per second
      if (regenAmount > 0) {
        this.applyHealing({ entity, healing: regenAmount });
      }
    }
  }

  private processDamageOverTime(entity: number, deltaTime: number): void {
    const conditions = this.conditionsStore.get(entity);

    for (const condition of conditions) {
      if (condition.type === "poisoned") {
        // Apply poison damage over time
        const poisonDamage = Math.floor(deltaTime * 0.2); // 0.2 damage per second
        if (poisonDamage > 0) {
          this.applyDamage({
            entity,
            damage: poisonDamage,
            damageType: "poison",
          });
        }
      }
    }
  }

  // Utility methods
  isAlive(entity: number): boolean {
    return this.healthStore.has(entity) && !this.healthStore.isDead(entity);
  }

  isUnconscious(entity: number): boolean {
    return this.conditionsStore.has(entity, "unconscious");
  }

  getHealthPercentage(entity: number): number {
    return this.healthStore.getHealthPercentage(entity);
  }

  getHealthStatus(
    entity: number,
  ): "healthy" | "injured" | "bloodied" | "critical" | "unconscious" | "dead" {
    if (!this.healthStore.has(entity)) {return "dead";}

    if (this.isUnconscious(entity)) {return "unconscious";}
    if (this.healthStore.isDead(entity)) {return "dead";}

    const percentage = this.getHealthPercentage(entity);
    if (percentage >= 0.75) {return "healthy";}
    if (percentage >= 0.5) {return "injured";}
    if (percentage >= 0.25) {return "bloodied";}
    return "critical";
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
