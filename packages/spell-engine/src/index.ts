/**
 * D&D 5e Spell Casting Automation Engine
 * Handles spell casting mechanics, slot management, and spell effects
 */

import { DiceEngine, DamageResult, diceEngine } from '@vtt/dice-engine';
import { ConditionsEngine, conditionsEngine, Condition} from '@vtt/conditions-engine';

export interface Spell {
  id: string;
  name: string;
  level: number; // 0 for cantrips
  school: 'abjuration' | 'conjuration' | 'divination' | 'enchantment' | 
         'evocation' | 'illusion' | 'necromancy' | 'transmutation';
  castingTime: string; // "1 action", "1 bonus action", "1 minute", etc.
  range: string; // "60 feet", "Touch", "Self", etc.
  components: {
    verbal: boolean;
    somatic: boolean;
    material?: string; // material component description
    consumed?: boolean; // component is consumed
    cost?: number; // cost in gold if expensive material
  };
  duration: string; // "Instantaneous", "1 minute", "Concentration, up to 10 minutes"
  concentration: boolean;
  ritual: boolean;
  description: string;
  atHigherLevels?: string;
  effects: SpellEffect[];
  scaling?: SpellScaling;
}

export interface SpellEffect {
  type: 'damage' | 'healing' | 'condition' | 'teleport' | 'summon' | 
        'buff' | 'debuff' | 'utility' | 'custom';
  target: 'self' | 'single' | 'multiple' | 'area' | 'line' | 'cone' | 'sphere';
  area?: {
    type: 'sphere' | 'cube' | 'cylinder' | 'line' | 'cone';
    size: number; // radius, width, length, etc.
  };
  damage?: {
    dice: string;
    type: string;
    savingThrow?: {
      ability: 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';
      dc?: number; // if not provided, uses caster's spell save DC
      onSuccess: 'half' | 'none' | 'negates';
    };
  };
  healing?: {
    dice: string;
    maxTargets?: number;
  };
  condition?: {
    id: string;
    duration: number;
    savingThrow?: {
      ability: 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';
      dc?: number;
      endOfTurn?: boolean;
    };
  };
  modifier?: {
    target: string;
    value: number;
    duration: number;
  };
  custom?: {
    description: string;
    handler?: string; // custom handler function name
  };
}

export interface SpellScaling {
  damage?: string; // additional damage dice per level
  healing?: string; // additional healing per level
  duration?: string; // duration scaling
  targets?: number; // additional targets per level
  area?: number; // area increase per level
}

export interface SpellSlots {
  1: { max: number; current: number };
  2: { max: number; current: number };
  3: { max: number; current: number };
  4: { max: number; current: number };
  5: { max: number; current: number };
  6: { max: number; current: number };
  7: { max: number; current: number };
  8: { max: number; current: number };
  9: { max: number; current: number };
}

export interface CastingResult {
  success: boolean;
  spellSlotUsed: number;
  effects: Array<{
    type: string;
    target: string;
    result: DamageResult | { amount: number } | { condition: string } | any;
  }>;
  conditions?: Array<{ target: string; condition: string; duration: number }>;
  error?: string;
}

export class SpellEngine {
  private dice: DiceEngine;
  private conditions: ConditionsEngine;

  constructor() {
    this.dice = diceEngine;
    this.conditions = conditionsEngine;
  }

  /**
   * Cast a spell with automatic effect resolution
   */
  castSpell(
    spell: Spell,
    caster: any,
    targets: string[],
    spellLevel?: number,
    position?: { x: number; y: number }
  ): CastingResult {
    const castLevel = spellLevel || spell.level;
    
    // Check spell slot availability
    if (spell.level > 0) {
      if (!this.hasSpellSlot(caster, castLevel)) {
        return { success: false, error: 'No spell slots available', spellSlotUsed: 0, effects: [] };
      }
    }

    // Check concentration
    if (spell.concentration && caster.concentrationSpell) {
      // End existing concentration spell
      this.endConcentration(caster);
    }

    // Consume spell slot
    if (spell.level > 0) {
      this.consumeSpellSlot(caster, castLevel);
    }

    // Apply spell effects
    const effects: any[] = [];
    const conditions: Array<{ target: string; condition: string; duration: number }> = [];

    for (const effect of spell.effects) {
      const effectResults = this.resolveSpellEffect(effect, caster, targets, castLevel, position);
      effects.push(...effectResults.effects);
      conditions.push(...effectResults.conditions);
    }

    // Handle concentration
    if (spell.concentration) {
      caster.concentrationSpell = {
        spell: spell.id,
        duration: this.parseDuration(spell.duration),
        effects: conditions
      };
    }

    return {
      success: true,
      spellSlotUsed: castLevel,
      effects,
      conditions
    };
  }

  private resolveSpellEffect(
    effect: SpellEffect,
    caster: any,
    targets: string[],
    spellLevel: number,
    position?: { x: number; y: number }
  ): { effects: any[]; conditions: Array<{ target: string; condition: string; duration: number }> } {
    const effects: any[] = [];
    const conditions: Array<{ target: string; condition: string; duration: number }> = [];

    switch (effect.type) {
      case 'damage':
        if (effect.damage) {
          let damage = effect.damage.dice;
          
          // Apply scaling
          const bonusLevels = spellLevel - 1; // spells scale from their base level
          if (bonusLevels > 0) {
            // Add scaling damage if available
            damage = this.scaleDamage(damage, bonusLevels);
          }

          for (const targetId of targets) {
            const damageResult = this.dice.rollDamage(damage, effect.damage.type);
            let finalDamage = damageResult.total;

            // Handle saving throws
            if (effect.damage.savingThrow) {
              const saveResult = this.rollSavingThrow(
                targetId,
                effect.damage.savingThrow.ability,
                effect.damage.savingThrow.dc || caster.spellSaveDC
              );

              if (saveResult.success) {
                switch (effect.damage.savingThrow.onSuccess) {
                  case 'half':
                    finalDamage = Math.floor(finalDamage / 2);
                    break;
                  case 'none':
                    finalDamage = 0;
                    break;
                  case 'negates':
                    continue; // Skip this target entirely
                }
              }
            }

            effects.push({
              type: 'damage',
              target: targetId,
              result: { ...damageResult, total: finalDamage }
            });
          }
        }
        break;

      case 'healing':
        if (effect.healing) {
          let healing = effect.healing.dice;
          
          // Apply scaling
          const bonusLevels = spellLevel - 1;
          if (bonusLevels > 0) {
            healing = this.scaleHealing(healing, bonusLevels);
          }

          const healTargets = effect.healing.maxTargets ? 
            targets.slice(0, effect.healing.maxTargets) : targets;

          for (const targetId of healTargets) {
            const healingRoll = this.dice.roll(healing);
            effects.push({
              type: 'healing',
              target: targetId,
              result: { amount: healingRoll.total }
            });
          }
        }
        break;

      case 'condition':
        if (effect.condition) {
          for (const targetId of targets) {
            let applyCondition = true;

            // Handle saving throws
            if (effect.condition.savingThrow) {
              const saveResult = this.rollSavingThrow(
                targetId,
                effect.condition.savingThrow.ability,
                effect.condition.savingThrow.dc || caster.spellSaveDC
              );

              if (saveResult.success) {
                applyCondition = false;
              }
            }

            if (applyCondition) {
              conditions.push({
                target: targetId,
                condition: effect.condition.id,
                duration: effect.condition.duration
              });

              effects.push({
                type: 'condition',
                target: targetId,
                result: { condition: effect.condition.id }
              });
            }
          }
        }
        break;

      case 'buff':
      case 'debuff':
        if (effect.modifier) {
          for (const targetId of targets) {
            effects.push({
              type: effect.type,
              target: targetId,
              result: {
                modifier: effect.modifier.target,
                value: effect.modifier.value,
                duration: effect.modifier.duration
              }
            });
          }
        }
        break;

      case 'custom':
        // Handle custom spell effects
        if (effect.custom) {
          effects.push({
            type: 'custom',
            target: targets[0] || 'none',
            result: { description: effect.custom.description }
          });
        }
        break;
    }

    return { effects, conditions };
  }

  private hasSpellSlot(caster: any, level: number): boolean {
    const slots = caster.spellSlots;
    if (!slots || !slots[level]) return false;
    return slots[level].current > 0;
  }

  private consumeSpellSlot(caster: any, level: number): void {
    if (caster.spellSlots && caster.spellSlots[level]) {
      caster.spellSlots[level].current = Math.max(0, caster.spellSlots[level].current - 1);
    }
  }

  private rollSavingThrow(targetId: string, ability: string, dc: number): { success: boolean; roll: any } {
    // This would integrate with the character system to get the target's save bonus
    const saveBonus = 0; // Placeholder - would get from character data
    const roll = this.dice.rollSavingThrow(saveBonus, dc);
    return roll;
  }

  private scaleDamage(baseDamage: string, bonusLevels: number): string {
    // Simple scaling - add 1d6 per level (would be spell-specific in real implementation)
    return `${baseDamage}+${bonusLevels}d6`;
  }

  private scaleHealing(baseHealing: string, bonusLevels: number): string {
    // Simple scaling for healing
    return `${baseHealing}+${bonusLevels}d4`;
  }

  private parseDuration(duration: string): number {
    // Parse duration strings into rounds/minutes
    if (duration.includes('1 minute')) return 10; // 10 rounds
    if (duration.includes('10 minutes')) return 100; // 100 rounds
    if (duration.includes('1 hour')) return 600; // 600 rounds
    return 1; // Default to 1 round
  }

  /**
   * End concentration on a spell
   */
  endConcentration(caster: any): void {
    if (caster.concentrationSpell) {
      // Remove all conditions applied by the concentration spell
      for (const conditionEffect of caster.concentrationSpell.effects) {
        this.conditions.removeCondition(conditionEffect.target, conditionEffect.condition);
      }
      caster.concentrationSpell = null;
    }
  }

  /**
   * Check concentration when taking damage
   */
  checkConcentration(caster: any, damage: number): boolean {
    if (!caster.concentrationSpell) return true;

    const dc = Math.max(10, Math.floor(damage / 2));
    const constitutionSave = caster.abilities?.CON?.modifier || 0;
    const proficiencyBonus = caster.proficiencyBonus || 0;
    
    const saveResult = this.dice.rollSavingThrow(constitutionSave + proficiencyBonus, dc);
    
    if (!saveResult.success) {
      this.endConcentration(caster);
      return false;
    }
    
    return true;
  }

  /**
   * Restore spell slots (long rest)
   */
  restoreSpellSlots(caster: any): void {
    if (caster.spellSlots) {
      for (const level of Object.keys(caster.spellSlots)) {
        caster.spellSlots[level].current = caster.spellSlots[level].max;
      }
    }
  }

  /**
   * Get available spell slots
   */
  getAvailableSlots(caster: any): Partial<SpellSlots> {
    return caster.spellSlots || {};
  }
}

// Common D&D 5e spells
export const D5E_SPELLS: Record<string, Spell> = {
  magicMissile: {
    id: 'magic_missile',
    name: 'Magic Missile',
    level: 1,
    school: 'evocation',
    castingTime: '1 action',
    range: '120 feet',
    components: { verbal: true, somatic: true },
    duration: 'Instantaneous',
    concentration: false,
    ritual: false,
    description: 'Three glowing darts of magical force strike targets for 1d4+1 force damage each',
    effects: [{
      type: 'damage',
      target: 'multiple',
      damage: {
        dice: '1d4+1',
        type: 'force'
      }
    }],
    scaling: {
      damage: '1d4+1'
    }
  },
  fireball: {
    id: 'fireball',
    name: 'Fireball',
    level: 3,
    school: 'evocation',
    castingTime: '1 action',
    range: '150 feet',
    components: { verbal: true, somatic: true, material: 'A tiny ball of bat guano and sulfur' },
    duration: 'Instantaneous',
    concentration: false,
    ritual: false,
    description: 'A bright flash and thunderous boom, creatures in 20-foot radius make Dex save',
    effects: [{
      type: 'damage',
      target: 'area',
      area: { type: 'sphere', size: 20 },
      damage: {
        dice: '8d6',
        type: 'fire',
        savingThrow: {
          ability: 'DEX',
          onSuccess: 'half'
        }
      }
    }],
    scaling: {
      damage: '1d6'
    }
  },
  cureWounds: {
    id: 'cure_wounds',
    name: 'Cure Wounds',
    level: 1,
    school: 'evocation',
    castingTime: '1 action',
    range: 'Touch',
    components: { verbal: true, somatic: true },
    duration: 'Instantaneous',
    concentration: false,
    ritual: false,
    description: 'Touch a creature to restore hit points',
    effects: [{
      type: 'healing',
      target: 'single',
      healing: {
        dice: '1d8'
      }
    }],
    scaling: {
      healing: '1d8'
    }
  }
};

// Export singleton instance
export const _spellEngine = new SpellEngine();
