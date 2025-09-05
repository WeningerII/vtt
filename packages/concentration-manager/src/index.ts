/**
 * Concentration Management System
 * Handles D&D 5e concentration checks for spells during physics events
 */

import { EventEmitter } from "events";

export interface ConcentrationState {
  id: string;
  casterId: string;
  spellId: string;
  spellName: string;
  constitutionMod: number;
  proficiencyBonus: number;
  startedAt: number;
  lastDamage?: number;
  lastDamageTime?: number;
}

export interface ConcentrationCheck {
  casterId: string;
  damage: number;
  dc: number;
  constitutionSave: number;
  proficiencyBonus: number;
  totalModifier: number;
  rollResult: number;
  success: boolean;
  timestamp: number;
}

export interface PhysicsEvent {
  type: "collision" | "force" | "damage";
  entityId: string;
  damage?: number;
  force?: { magnitude: number; direction: { x: number; y: number } };
  timestamp: number;
}

export class ConcentrationManager extends EventEmitter {
  private activeConcentration: Map<string, ConcentrationState> = new Map();
  private concentrationHistory: ConcentrationCheck[] = [];

  constructor() {
    super();
  }

  /**
   * Start concentration for a spell
   */
  startConcentration(
    casterId: string,
    spellId: string,
    spellName: string,
    constitutionMod: number = 0,
    proficiencyBonus: number = 0,
  ): void {
    // End any existing concentration
    this.endConcentration(casterId);

    const concentration: ConcentrationState = {
      id: `conc_${casterId}_${Date.now()}`,
      casterId,
      spellId,
      spellName,
      constitutionMod,
      proficiencyBonus,
      startedAt: Date.now(),
    };

    this.activeConcentration.set(casterId, concentration);
    this.emit("concentrationStarted", concentration);
  }

  /**
   * End concentration for a caster
   */
  endConcentration(casterId: string): boolean {
    const concentration = this.activeConcentration.get(casterId);
    if (!concentration) {return false;}

    this.activeConcentration.delete(casterId);
    this.emit("concentrationEnded", concentration);
    return true;
  }

  /**
   * Handle physics event that might break concentration
   */
  handlePhysicsEvent(event: PhysicsEvent): ConcentrationCheck | null {
    const concentration = this.activeConcentration.get(event.entityId);
    if (!concentration) {return null;}

    // Only damage events trigger concentration checks
    if (event.type !== "damage" || !event.damage) {return null;}

    return this.makeConcentrationCheck(concentration, event.damage);
  }

  /**
   * Make a concentration check
   */
  makeConcentrationCheck(concentration: ConcentrationState, damage: number): ConcentrationCheck {
    // Calculate DC: 10 or half damage, whichever is higher
    const dc = Math.max(10, Math.floor(damage / 2));

    // Roll d20
    const rollResult = this.rollD20();

    // Calculate total modifier
    const totalModifier = concentration.constitutionMod + concentration.proficiencyBonus;

    // Check success
    const success = rollResult + totalModifier >= dc;

    const check: ConcentrationCheck = {
      casterId: concentration.casterId,
      damage,
      dc,
      constitutionSave: concentration.constitutionMod,
      proficiencyBonus: concentration.proficiencyBonus,
      totalModifier,
      rollResult,
      success,
      timestamp: Date.now(),
    };

    // Update concentration state
    concentration.lastDamage = damage;
    concentration.lastDamageTime = Date.now();

    // Store check in history
    this.concentrationHistory.push(check);

    // If failed, end concentration
    if (!success) {
      this.endConcentration(concentration.casterId);
      this.emit("concentrationBroken", check);
    } else {
      this.emit("concentrationMaintained", check);
    }

    return check;
  }

  /**
   * Force a concentration check (e.g., from spell effects)
   */
  forceConcentrationCheck(casterId: string, dc: number): ConcentrationCheck | null {
    const concentration = this.activeConcentration.get(casterId);
    if (!concentration) {return null;}

    // Roll d20
    const rollResult = this.rollD20();

    // Calculate total modifier
    const totalModifier = concentration.constitutionMod + concentration.proficiencyBonus;

    // Check success
    const success = rollResult + totalModifier >= dc;

    const check: ConcentrationCheck = {
      casterId: concentration.casterId,
      damage: 0, // No damage for forced checks
      dc,
      constitutionSave: concentration.constitutionMod,
      proficiencyBonus: concentration.proficiencyBonus,
      totalModifier,
      rollResult,
      success,
      timestamp: Date.now(),
    };

    // Store check in history
    this.concentrationHistory.push(check);

    // If failed, end concentration
    if (!success) {
      this.endConcentration(concentration.casterId);
      this.emit("concentrationBroken", check);
    } else {
      this.emit("concentrationMaintained", check);
    }

    return check;
  }

  /**
   * Check if entity is concentrating
   */
  isConcentrating(casterId: string): boolean {
    return this.activeConcentration.has(casterId);
  }

  /**
   * Get concentration state for caster
   */
  getConcentrationState(casterId: string): ConcentrationState | undefined {
    return this.activeConcentration.get(casterId);
  }

  /**
   * Get all active concentration states
   */
  getAllConcentrationStates(): ConcentrationState[] {
    return Array.from(this.activeConcentration.values());
  }

  /**
   * Get concentration history for analysis
   */
  getConcentrationHistory(casterId?: string): ConcentrationCheck[] {
    if (casterId) {
      return this.concentrationHistory.filter((check) => check.casterId === casterId);
    }
    return [...this.concentrationHistory];
  }

  /**
   * Clear concentration history (for performance)
   */
  clearHistory(olderThanMs?: number): void {
    if (olderThanMs) {
      const cutoff = Date.now() - olderThanMs;
      this.concentrationHistory = this.concentrationHistory.filter(
        (check) => check.timestamp > cutoff,
      );
    } else {
      this.concentrationHistory = [];
    }
  }

  /**
   * Auto-fail concentration under certain conditions
   */
  checkAutoFailConditions(casterId: string): boolean {
    const concentration = this.activeConcentration.get(casterId);
    if (!concentration) {return false;}

    // Auto-fail if incapacitated, stunned, etc.
    // This would typically integrate with the conditions system

    return false; // No auto-fail conditions met
  }

  /**
   * Handle spell end effects that might affect concentration
   */
  handleSpellEnd(spellId: string): void {
    // Find any concentration spells that ended
    for (const [casterId, concentration] of this.activeConcentration.entries()) {
      if (concentration.spellId === spellId) {
        this.endConcentration(casterId);
      }
    }
  }

  /**
   * Simulate d20 roll
   */
  private rollD20(): number {
    return Math.floor(Math.random() * 20) + 1;
  }

  /**
   * Get concentration statistics
   */
  getStatistics(): {
    activeCount: number;
    totalChecks: number;
    successRate: number;
    averageDC: number;
    mostRecentCheck?: ConcentrationCheck;
  } {
    const totalChecks = this.concentrationHistory.length;
    const successfulChecks = this.concentrationHistory.filter((check) => check.success).length;
    const successRate = totalChecks > 0 ? (successfulChecks / totalChecks) * 100 : 0;
    const averageDC =
      totalChecks > 0
        ? this.concentrationHistory.reduce((_sum, _check) => sum + check.dc, 0) / totalChecks
        : 0;

    return {
      activeCount: this.activeConcentration.size,
      totalChecks,
      successRate,
      averageDC,
      mostRecentCheck: this.concentrationHistory[this.concentrationHistory.length - 1],
    };
  }

  /**
   * Batch process physics events for multiple entities
   */
  processBatchPhysicsEvents(events: PhysicsEvent[]): ConcentrationCheck[] {
    const checks: ConcentrationCheck[] = [];

    for (const event of events) {
      const check = this.handlePhysicsEvent(event);
      if (check) {
        checks.push(check);
      }
    }

    if (checks.length > 0) {
      this.emit("batchChecksProcessed", checks);
    }

    return checks;
  }

  /**
   * Handle mass damage events (e.g., fireball)
   */
  handleMassDamageEvent(
    entityIds: string[],
    damage: number,
    sourceSpell?: string,
  ): ConcentrationCheck[] {
    const checks: ConcentrationCheck[] = [];

    for (const entityId of entityIds) {
      const concentration = this.activeConcentration.get(entityId);
      if (concentration) {
        const check = this.makeConcentrationCheck(concentration, damage);
        checks.push(check);
      }
    }

    if (checks.length > 0) {
      this.emit("massDamageProcessed", { checks, sourceSpell });
    }

    return checks;
  }
}

/**
 * Integration with Physics Events
 */
export class PhysicsConcentrationIntegration extends EventEmitter {
  private concentrationManager: ConcentrationManager;
  private physicsEventQueue: PhysicsEvent[] = [];
  private processingInterval: NodeJS.Timeout;

  constructor(concentrationManager: ConcentrationManager) {
    super();
    this.concentrationManager = concentrationManager;

    // Process physics events every 100ms
    this.processingInterval = setInterval(() => {
      this.processPhysicsEventQueue();
    }, 100);
  }

  /**
   * Queue a physics event for processing
   */
  queuePhysicsEvent(event: PhysicsEvent): void {
    this.physicsEventQueue.push(event);
  }

  /**
   * Process queued physics events
   */
  private processPhysicsEventQueue(): void {
    if (this.physicsEventQueue.length === 0) {return;}

    const events = [...this.physicsEventQueue];
    this.physicsEventQueue = [];

    const checks = this.concentrationManager.processBatchPhysicsEvents(events);

    if (checks.length > 0) {
      this.emit("concentrationChecksProcessed", checks);
    }
  }

  /**
   * Handle collision events from physics system
   */
  handleCollision(collision: {
    bodyA: { id: number; entityId?: string };
    bodyB: { id: number; entityId?: string };
    force: number;
  }): void {
    // Convert collision force to potential damage
    const damage = Math.max(1, Math.floor(collision.force / 10));

    if (collision.bodyA.entityId) {
      this.queuePhysicsEvent({
        type: "collision",
        entityId: collision.bodyA.entityId,
        damage,
        timestamp: Date.now(),
      });
    }

    if (collision.bodyB.entityId) {
      this.queuePhysicsEvent({
        type: "collision",
        entityId: collision.bodyB.entityId,
        damage,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Handle force applications that might cause concentration checks
   */
  handleForceApplication(
    entityId: string,
    force: { magnitude: number; direction: { x: number; y: number } },
  ): void {
    // Large forces might require concentration checks
    if (force.magnitude > 50) {
      const damage = Math.floor(force.magnitude / 20);
      this.queuePhysicsEvent({
        type: "force",
        entityId,
        damage,
        force,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Clean up
   */
  destroy(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
  }
}

export const _createConcentrationManager = (): ConcentrationManager => {
  return new ConcentrationManager();
};

export const _createPhysicsConcentrationIntegration = (
  concentrationManager: ConcentrationManager,
): PhysicsConcentrationIntegration => {
  return new PhysicsConcentrationIntegration(concentrationManager);
};
