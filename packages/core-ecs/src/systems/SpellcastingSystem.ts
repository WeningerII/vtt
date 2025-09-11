import { EntityId, CombatStore } from "../components/Combat";
import { logger } from "@vtt/logging";
import { HealthStore } from "../components/Health";
import { StatsStore } from "../components/Stats";

export interface SpellEffect {
  type: "damage" | "healing" | "condition" | "buff" | "debuff";
  target: EntityId | EntityId[];
  value?: number;
  diceExpression?: string;
  damageType?: string;
  condition?: string;
  duration?: number;
  savingThrow?: {
    ability: string;
    dc: number;
    onSave?: "half" | "negates";
  };
}

export interface SpellInstance {
  spellId: string;
  casterLevel: number;
  spellSlotLevel: number;
  casterId: EntityId;
  targets: EntityId[];
  effects: SpellEffect[];
  concentration: boolean;
  duration?: number | undefined;
}

export class SpellcastingSystem {
  private healthStore: HealthStore;
  private statsStore: StatsStore;
  private combatStore: CombatStore;
  private activeSpells: Map<string, SpellInstance> = new Map();

  constructor(healthStore: HealthStore, statsStore: StatsStore, combatStore: CombatStore) {
    this.healthStore = healthStore;
    this.statsStore = statsStore;
    this.combatStore = combatStore;
  }

  castSpell(spell: SpellInstance): boolean {
    // Validate caster can cast
    if (!this.canCastSpell(spell.casterId, spell.spellSlotLevel)) {
      return false;
    }

    // Apply concentration rules
    if (spell.concentration) {
      this.breakExistingConcentration(spell.casterId);
      this.combatStore.setConcentration(spell.casterId, spell.casterId);
    }

    // Process spell effects
    for (const effect of spell.effects) {
      this.applySpellEffect(spell, effect);
    }

    // Track active spell if it has duration
    if (spell.duration && spell.duration > 0) {
      const spellKey = `${spell.casterId}_${spell.spellId}_${Date.now()}`;
      this.activeSpells.set(spellKey, spell);
    }

    return true;
  }

  private canCastSpell(casterId: EntityId, _spellLevel: number): boolean {
    // Check if entity is in combat and has actions remaining
    const combat = this.combatStore.get(casterId);
    if (combat && combat.actionPoints < 1) {
      return false;
    }

    // In a full implementation, would check spell slots
    return true;
  }

  private breakExistingConcentration(casterId: EntityId): void {
    // Find and end any concentration spells by this caster
    for (const [key, spell] of Array.from(this.activeSpells.entries())) {
      if (spell.casterId === casterId && spell.concentration) {
        this.endSpell(key);
      }
    }
    this.combatStore.breakConcentration(casterId);
  }

  private applySpellEffect(spell: SpellInstance, effect: SpellEffect): void {
    const targets = Array.isArray(effect.target) ? effect.target : [effect.target];

    for (const targetId of targets) {
      switch (effect.type) {
        case "damage":
          this.applyDamage(spell, effect, targetId);
          break;
        case "healing":
          this.applyHealing(spell, effect, targetId);
          break;
        case "condition":
          this.applyCondition(effect, targetId);
          break;
        case "buff":
        case "debuff":
          this.applyStatModifier(effect, targetId);
          break;
      }
    }
  }

  private applyDamage(spell: SpellInstance, effect: SpellEffect, targetId: EntityId): void {
    let damage = effect.value || 0;

    // Roll dice if expression provided
    if (effect.diceExpression) {
      damage = this.rollDice(effect.diceExpression);
    }

    // Apply saving throw if specified
    if (effect.savingThrow) {
      const saved = this.rollSavingThrow(targetId, effect.savingThrow);
      if (saved && effect.savingThrow.onSave === "half") {
        damage = Math.floor(damage / 2);
      } else if (saved && effect.savingThrow.onSave === "negates") {
        damage = 0;
      }
    }

    // Apply damage with type
    if (damage > 0) {
      this.healthStore.takeDamage(targetId, damage);
    }
  }

  private applyHealing(spell: SpellInstance, effect: SpellEffect, targetId: EntityId): void {
    let healing = effect.value || 0;

    if (effect.diceExpression) {
      healing = this.rollDice(effect.diceExpression);
    }

    if (healing > 0) {
      this.healthStore.heal(targetId, healing);
    }
  }

  private applyCondition(effect: SpellEffect, targetId: EntityId): void {
    // In a full implementation, would integrate with condition system
    logger.info(`Applying condition ${effect.condition} to entity ${targetId}`);
  }

  private applyStatModifier(effect: SpellEffect, targetId: EntityId): void {
    // In a full implementation, would apply temporary stat modifications
    logger.info(`Applying ${effect.type} to entity ${targetId}`);
  }

  private rollSavingThrow(entityId: EntityId, save: { ability: string; dc: number }): boolean {
    const stats = this.statsStore.get(entityId);
    if (!stats) {return false;}

    const abilityMod = stats.abilityModifiers[save.ability.toLowerCase()] || 0;
    const roll = Math.floor(Math.random() * 20) + 1;
    return roll + abilityMod >= save.dc;
  }

  private rollDice(expression: string): number {
    // Simple dice rolling implementation
    const match = expression.match(/(\d+)d(\d+)(?:\+(\d+))?/);
    if (!match) {return 0;}

    const [, numDice, sides, modifier] = match;
    let total = 0;

    for (let i = 0; i < parseInt(numDice || "1"); i++) {
      total += Math.floor(Math.random() * parseInt(sides || "6")) + 1;
    }

    if (modifier) {
      total += parseInt(modifier);
    }

    return total;
  }

  private endSpell(spellKey: string): void {
    const spell = this.activeSpells.get(spellKey);
    if (spell) {
      // Clean up any ongoing effects
      if (spell.concentration) {
        this.combatStore.breakConcentration(spell.casterId);
      }
      this.activeSpells.delete(spellKey);
    }
  }

  // Process end-of-turn effects for duration spells
  processTurnEnd(): void {
    for (const [key, spell] of Array.from(this.activeSpells.entries())) {
      if (spell.duration !== undefined) {
        spell.duration--;
        if (spell.duration <= 0) {
          this.endSpell(key);
        }
      }
    }
  }

  // Force concentration check (e.g., when taking damage)
  concentrationCheck(entityId: EntityId, damage: number): boolean {
    const dc = Math.max(10, Math.floor(damage / 2));
    const result = this.rollSavingThrow(entityId, { ability: "constitution", dc });

    if (!result) {
      this.breakExistingConcentration(entityId);
    }

    return result;
  }
}
