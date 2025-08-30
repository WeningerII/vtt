/**
 * Concentration Management System
 * Handles spell concentration mechanics for D&D 5e
 */

import { EventEmitter } from "events";

export interface ConcentrationSpell {
  id: string;
  spellId: string;
  casterId: string;
  spellName: string;
  level: number;
  startTime: number;
  duration: number; // in milliseconds
  effects: ConcentrationEffect[];
  autoFail?: {
    damage: number; // Auto-fail if damage exceeds this
  };
}

export interface ConcentrationEffect {
  id: string;
  type: "condition" | "buff" | "debuff" | "environmental" | "utility";
  targetId?: string;
  effect: any;
  maintainedBy: "concentration";
}

export interface ConcentrationCheck {
  casterId: string;
  trigger: "damage" | "incapacitated" | "death" | "manual";
  dc: number;
  damage?: number;
  result?: {
    rolled: number;
    success: boolean;
    maintained: boolean;
  };
}

export class ConcentrationManager extends EventEmitter {
  private concentratingCasters: Map<string, ConcentrationSpell> = new Map();
  private concentrationEffects: Map<string, ConcentrationEffect[]> = new Map();
  private checkQueue: ConcentrationCheck[] = [];

  constructor() {
    super();
    this.setupConcentrationMonitoring();
  }

  /**
   * Start concentrating on a spell
   */
  startConcentration(concentration: Omit<ConcentrationSpell, "startTime">): boolean {
    const casterId = concentration.casterId;

    // End existing concentration
    if (this.concentratingCasters.has(casterId)) {
      this.endConcentration(casterId, "new_spell");
    }

    const concentrationSpell: ConcentrationSpell = {
      ...concentration,
      startTime: Date.now(),
    };

    this.concentratingCasters.set(casterId, concentrationSpell);
    this.concentrationEffects.set(concentration.id, concentration.effects);

    this.emit("concentrationStarted", concentrationSpell);

    // Schedule automatic end
    setTimeout(() => {
      if (this.concentratingCasters.get(casterId)?.id === concentration.id) {
        this.endConcentration(casterId, "duration_expired");
      }
    }, concentration.duration);

    return true;
  }

  /**
   * End concentration (voluntary or forced)
   */
  endConcentration(casterId: string, reason: string): boolean {
    const concentration = this.concentratingCasters.get(casterId);
    if (!concentration) return false;

    // Remove effects
    const effects = this.concentrationEffects.get(concentration.id) || [];
    for (const effect of effects) {
      this.removeConcentrationEffect(effect);
    }

    this.concentratingCasters.delete(casterId);
    this.concentrationEffects.delete(concentration.id);

    this.emit("concentrationEnded", concentration, reason);
    return true;
  }

  /**
   * Trigger concentration check from damage
   */
  triggerConcentrationCheck(
    casterId: string,
    trigger: ConcentrationCheck["trigger"],
    damage?: number,
  ): ConcentrationCheck | null {
    const concentration = this.concentratingCasters.get(casterId);
    if (!concentration) return null;

    let dc = 10;

    switch (trigger) {
      case "damage":
        if (damage) {
          dc = Math.max(10, Math.floor(damage / 2));

          // Auto-fail for massive damage
          if (concentration.autoFail && damage >= concentration.autoFail.damage) {
            this.endConcentration(casterId, "massive_damage");
            return {
              casterId,
              trigger,
              dc: 999, // Impossible DC
              damage,
              result: {
                rolled: 0,
                success: false,
                maintained: false,
              },
            };
          }
        }
        break;
      case "incapacitated":
        // Automatically fail if incapacitated
        this.endConcentration(casterId, "incapacitated");
        return {
          casterId,
          trigger,
          dc: 999,
          result: {
            rolled: 0,
            success: false,
            maintained: false,
          },
        };
      case "death":
        this.endConcentration(casterId, "death");
        return {
          casterId,
          trigger,
          dc: 999,
          result: {
            rolled: 0,
            success: false,
            maintained: false,
          },
        };
    }

    const check: ConcentrationCheck = {
      casterId,
      trigger,
      dc,
      ...(damage !== undefined && { damage }),
    };

    this.checkQueue.push(check);
    this.emit("concentrationCheckRequired", check);

    return check;
  }

  /**
   * Resolve concentration check with dice roll
   */
  resolveConcentrationCheck(
    checkIndex: number,
    constitutionSave: number,
    proficiencyBonus: number = 0,
  ): boolean {
    const check = this.checkQueue[checkIndex];
    if (!check) return false;

    const totalRoll = constitutionSave + proficiencyBonus;
    const success = totalRoll >= check.dc;

    check.result = {
      rolled: totalRoll,
      success,
      maintained: success,
    };

    if (!success) {
      this.endConcentration(check.casterId, "failed_check");
    }

    this.emit("concentrationCheckResolved", check);
    this.checkQueue.splice(checkIndex, 1);

    return success;
  }

  /**
   * Get current concentration for a caster
   */
  getConcentration(casterId: string): ConcentrationSpell | undefined {
    return this.concentratingCasters.get(casterId);
  }

  /**
   * Check if caster is concentrating
   */
  isConcentrating(casterId: string): boolean {
    return this.concentratingCasters.has(casterId);
  }

  /**
   * Get all concentration effects by spell
   */
  getConcentrationEffects(concentrationId: string): ConcentrationEffect[] {
    return this.concentrationEffects.get(concentrationId) || [];
  }

  /**
   * Add effect to concentration
   */
  addConcentrationEffect(concentrationId: string, effect: ConcentrationEffect): void {
    if (!this.concentrationEffects.has(concentrationId)) {
      this.concentrationEffects.set(concentrationId, []);
    }

    this.concentrationEffects.get(concentrationId)!.push(effect);
    this.emit("concentrationEffectAdded", concentrationId, effect);
  }

  /**
   * Remove concentration effect
   */
  private removeConcentrationEffect(effect: ConcentrationEffect): void {
    this.emit("concentrationEffectRemoved", effect);

    // Handle different effect types
    switch (effect.type) {
      case "condition":
        this.emit("conditionRemoved", effect.targetId, effect.effect);
        break;
      case "buff":
        this.emit("buffRemoved", effect.targetId, effect.effect);
        break;
      case "debuff":
        this.emit("debuffRemoved", effect.targetId, effect.effect);
        break;
      case "environmental":
        this.emit("environmentalEffectRemoved", effect.effect);
        break;
      case "utility":
        this.emit("utilityEffectRemoved", effect.effect);
        break;
    }
  }

  /**
   * Get pending concentration checks
   */
  getPendingChecks(): ConcentrationCheck[] {
    return [...this.checkQueue];
  }

  /**
   * Force end all concentration (e.g., for unconsciousness)
   */
  endAllConcentration(casterId: string): void {
    if (this.concentratingCasters.has(casterId)) {
      this.endConcentration(casterId, "forced_end");
    }
  }

  /**
   * Get all current concentrations (for debugging/admin)
   */
  getAllConcentrations(): ConcentrationSpell[] {
    return Array.from(this.concentratingCasters.values());
  }

  /**
   * Monitor concentration duration and auto-cleanup
   */
  private setupConcentrationMonitoring(): void {
    setInterval(() => {
      const now = Date.now();
      const expiredConcentrations: string[] = [];

      for (const [casterId, concentration] of this.concentratingCasters.entries()) {
        if (now > concentration.startTime + concentration.duration) {
          expiredConcentrations.push(casterId);
        }
      }

      for (const casterId of expiredConcentrations) {
        this.endConcentration(casterId, "duration_expired");
      }
    }, 1000); // Check every second
  }

  /**
   * Handle combat events that affect concentration
   */
  handleCombatEvent(event: {
    type: "damage" | "incapacitated" | "unconscious" | "death";
    targetId: string;
    damage?: number;
  }): void {
    switch (event.type) {
      case "damage":
        if (event.damage && event.damage > 0) {
          this.triggerConcentrationCheck(event.targetId, "damage", event.damage);
        }
        break;
      case "incapacitated":
      case "unconscious":
        this.triggerConcentrationCheck(event.targetId, "incapacitated");
        break;
      case "death":
        this.triggerConcentrationCheck(event.targetId, "death");
        break;
    }
  }
}

// Cantrip-specific concentration requirements
export const cantripConcentrationRequirements: Record<
  string,
  {
    requiresConcentration: boolean;
    duration: number; // milliseconds
    effects: string[];
  }
> = {
  dancing_lights: {
    requiresConcentration: true,
    duration: 60000, // 1 minute
    effects: ["light_control", "movement_control"],
  },
  guidance: {
    requiresConcentration: true,
    duration: 60000, // 1 minute
    effects: ["ability_bonus"],
  },
  resistance: {
    requiresConcentration: true,
    duration: 60000, // 1 minute
    effects: ["saving_throw_bonus"],
  },
  true_strike: {
    requiresConcentration: true,
    duration: 6000, // Until end of next turn
    effects: ["attack_advantage"],
  },
  // Most other cantrips don't require concentration
  acid_splash: { requiresConcentration: false, duration: 0, effects: [] },
  chill_touch: { requiresConcentration: false, duration: 0, effects: [] },
  druidcraft: { requiresConcentration: false, duration: 0, effects: [] },
  eldritch_blast: { requiresConcentration: false, duration: 0, effects: [] },
  firebolt: { requiresConcentration: false, duration: 0, effects: [] },
  light: { requiresConcentration: false, duration: 0, effects: [] },
  mage_hand: { requiresConcentration: false, duration: 0, effects: [] },
  mending: { requiresConcentration: false, duration: 0, effects: [] },
  message: { requiresConcentration: false, duration: 0, effects: [] },
  minor_illusion: { requiresConcentration: false, duration: 0, effects: [] },
  poison_spray: { requiresConcentration: false, duration: 0, effects: [] },
  prestidigitation: { requiresConcentration: false, duration: 0, effects: [] },
  produce_flame: { requiresConcentration: false, duration: 0, effects: [] },
  ray_of_frost: { requiresConcentration: false, duration: 0, effects: [] },
  sacred_flame: { requiresConcentration: false, duration: 0, effects: [] },
  shillelagh: { requiresConcentration: false, duration: 0, effects: [] },
  shocking_grasp: { requiresConcentration: false, duration: 0, effects: [] },
  thaumaturgy: { requiresConcentration: false, duration: 0, effects: [] },
  vicious_mockery: { requiresConcentration: false, duration: 0, effects: [] },
};

export const _concentrationManager = new ConcentrationManager();
