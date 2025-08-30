/**
 * D&D 5e Equipment Effects Automation System
 * Handles magical item effects, weapon properties, and equipment bonuses
 */

import { DiceEngine, diceEngine } from '@vtt/dice-engine';
import { ConditionsEngine, conditionsEngine } from '@vtt/conditions-engine';
import { SpellEngine, spellEngine } from '@vtt/spell-engine';

export interface Equipment {
  id: string;
  name: string;
  type: 'weapon' | 'armor' | 'shield' | 'wondrous' | 'consumable' | 'tool';
  rarity: 'common' | 'uncommon' | 'rare' | 'very_rare' | 'legendary' | 'artifact';
  equipped: boolean;
  attuned?: boolean;
  requiresAttunement: boolean;
  charges?: {
    current: number;
    max: number;
    rechargeRate?: string; // "1d3 at dawn", "all at dawn", etc.
    rechargeCondition?: string;
  };
  effects: EquipmentEffect[];
  properties?: WeaponProperty[];
  baseStats?: {
    ac?: number;
    damage?: string;
    range?: number;
    weight?: number;
    cost?: number;
  };
}

export interface EquipmentEffect {
  id: string;
  name: string;
  type: 'passive' | 'active' | 'triggered' | 'charges';
  trigger?: EffectTrigger;
  effects: EffectResult[];
  cost?: {
    type: 'charges' | 'attunement_slot' | 'action' | 'bonus_action';
    amount?: number;
  };
  restrictions?: EffectRestriction[];
}

export interface EffectTrigger {
  event: 'on_hit' | 'on_crit' | 'on_kill' | 'on_damage_taken' | 'start_turn' | 
         'end_turn' | 'cast_spell' | 'use_ability' | 'attack_roll' | 'saving_throw' | 'death_save';
  condition?: string;
  once_per_turn?: boolean;
  once_per_day?: boolean;
}

export interface EffectResult {
  type: 'damage' | 'healing' | 'condition' | 'modifier' | 'advantage' | 
        'spell_cast' | 'resource_restore' | 'teleport' | 'summon';
  target: 'self' | 'attacker' | 'target' | 'all_enemies' | 'all_allies' | 'area';
  value?: number;
  dice?: string;
  damageType?: string;
  condition?: string;
  duration?: number;
  spell?: {
    id: string;
    level: number;
    saveDC?: number;
  };
  modifier?: {
    stat: string;
    bonus: number;
    type: 'enhancement' | 'circumstance' | 'competence';
  };
  area?: {
    type: 'sphere' | 'cube' | 'line' | 'cone';
    size: number;
  };
}

export interface EffectRestriction {
  type: 'class' | 'alignment' | 'race' | 'level' | 'ability_score' | 'custom';
  value: string | number;
  comparison?: 'equal' | 'greater' | 'less' | 'not_equal';
}

export interface WeaponProperty {
  id: string;
  name: string;
  description: string;
  mechanical_effect?: string;
}

export interface EquipmentActivationResult {
  success: boolean;
  effects: Array<{
    type: string;
    target: string;
    result: any;
  }>;
  chargesUsed: number;
  error?: string;
}

export class EquipmentEffectsEngine {
  private dice: DiceEngine;
  private conditions: ConditionsEngine;
  private spells: SpellEngine;
  private characterEquipment = new Map<string, Equipment[]>(); // characterId -> equipment

  constructor() {
    this.dice = diceEngine;
    this.conditions = conditionsEngine;
    this.spells = spellEngine;
  }

  /**
   * Initialize character equipment
   */
  initializeCharacterEquipment(characterId: string, equipment: Equipment[]): void {
    this.characterEquipment.set(characterId, equipment);
  }

  /**
   * Get all equipped items for a character
   */
  getEquippedItems(characterId: string): Equipment[] {
    const equipment = this.characterEquipment.get(characterId) || [];
    return equipment.filter(item => item.equipped);
  }

  /**
   * Apply passive equipment effects to character
   */
  applyPassiveEffects(characterId: string, character: any): void {
    const equippedItems = this.getEquippedItems(characterId);

    for (const item of equippedItems) {
      // Check attunement requirement
      if (item.requiresAttunement && !item.attuned) continue;

      for (const effect of item.effects) {
        if (effect.type === 'passive') {
          this.applyPassiveEffect(effect, character, item);
        }
      }
    }
  }

  /**
   * Process triggered equipment effects
   */
  processTriggers(
    characterId: string,
    event: string,
    character: any,
    context?: any
  ): EquipmentActivationResult[] {
    const equippedItems = this.getEquippedItems(characterId);
    const results: EquipmentActivationResult[] = [];

    for (const item of equippedItems) {
      if (item.requiresAttunement && !item.attuned) continue;

      for (const effect of item.effects) {
        if (effect.type === 'triggered' && effect.trigger) {
          if (effect.trigger.event === event && this.checkTriggerCondition(effect.trigger, character, context)) {
            const result = this.activateEquipmentEffect(item, effect, character, context);
            if (result.success) {
              results.push(result);
            }
          }
        }
      }
    }

    return results;
  }

  /**
   * Activate an equipment effect manually
   */
  activateEquipmentEffect(
    item: Equipment,
    effect: EquipmentEffect,
    character: any,
    context?: any
  ): EquipmentActivationResult {
    // Check restrictions
    if (effect.restrictions && !this.checkRestrictions(effect.restrictions, character)) {
      return { success: false, error: 'Restrictions not met', effects: [], chargesUsed: 0 };
    }

    // Check charges
    if (effect.cost?.type === 'charges') {
      const chargesNeeded = effect.cost.amount || 1;
      if (!item.charges || item.charges.current < chargesNeeded) {
        return { success: false, error: 'Insufficient charges', effects: [], chargesUsed: 0 };
      }
      item.charges.current -= chargesNeeded;
    }

    const effects: any[] = [];
    let chargesUsed = 0;

    // Execute effect results
    for (const result of effect.effects) {
      const effectResult = this.executeEffectResult(result, character, context);
      if (effectResult) {
        effects.push(effectResult);
      }
    }

    if (effect.cost?.type === 'charges') {
      chargesUsed = effect.cost.amount || 1;
    }

    return { success: true, effects, chargesUsed };
  }

  /**
   * Calculate equipment bonuses for combat stats
   */
  calculateEquipmentBonuses(characterId: string, _character: any): {
    ac: number;
    attackBonus: number;
    damageBonus: number;
    savingThrows: Record<string, number>;
    abilityScores: Record<string, number>;
  } {
    const equippedItems = this.getEquippedItems(characterId);
    const bonuses = {
      ac: 0,
      attackBonus: 0,
      damageBonus: 0,
      savingThrows: { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 },
      abilityScores: { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 }
    };

    for (const item of equippedItems) {
      if (item.requiresAttunement && !item.attuned) continue;

      // Base armor/shield bonuses
      if (item.type === 'armor' && item.baseStats?.ac) {
        bonuses.ac += item.baseStats.ac;
      }
      if (item.type === 'shield' && item.baseStats?.ac) {
        bonuses.ac += item.baseStats.ac;
      }

      // Magical bonuses from effects
      for (const effect of item.effects) {
        if (effect.type === 'passive') {
          for (const result of effect.effects) {
            if (result.type === 'modifier' && result.modifier) {
              this.applyStatBonus(bonuses, result.modifier);
            }
          }
        }
      }
    }

    return bonuses;
  }

  /**
   * Handle weapon attack with magical properties
   */
  processWeaponAttack(
    characterId: string,
    weaponId: string,
    character: any,
    target: string,
    context: any
  ): {
    attackBonus: number;
    damageBonus: string;
    effects: any[];
  } {
    const equipment = this.characterEquipment.get(characterId) || [];
    const weapon = equipment.find(item => item.id === weaponId);
    
    if (!weapon || weapon.type !== 'weapon') {
      return { attackBonus: 0, damageBonus: '', effects: [] };
    }

    let attackBonus = 0;
    let damageBonus = '';
    const effects: any[] = [];

    // Apply weapon properties
    if (weapon.properties) {
      for (const property of weapon.properties) {
        const propertyEffect = this.handleWeaponProperty(property, character, target, context);
        if (propertyEffect) {
          effects.push(propertyEffect);
        }
      }
    }

    // Apply magical weapon effects
    for (const effect of weapon.effects) {
      if (effect.trigger?.event === 'attack_roll' || effect.trigger?.event === 'on_hit') {
        for (const result of effect.effects) {
          if (result.type === 'modifier' && result.modifier) {
            if (result.modifier.stat === 'attack') {
              attackBonus += result.modifier.bonus;
            } else if (result.modifier.stat === 'damage') {
              damageBonus += `+${result.modifier.bonus}`;
            }
          }
        }
      }
    }

    return { attackBonus, damageBonus, effects };
  }

  private applyPassiveEffect(effect: EquipmentEffect, character: any, item: Equipment): void {
    for (const result of effect.effects) {
      switch (result.type) {
        case 'modifier':
          if (result.modifier) {
            // Apply permanent modifier to character
            this.applyCharacterModifier(character, result.modifier);
          }
          break;
        case 'condition':
          if (result.condition) {
            // Apply permanent condition (like from a cursed item)
            this.conditions.applyCondition(character.id, result.condition, -1, item.name);
          }
          break;
      }
    }
  }

  private executeEffectResult(result: EffectResult, character: any, context?: any): any {
    switch (result.type) {
      case 'damage':
        if (result.dice) {
          const damage = this.dice.rollDamage(result.dice, result.damageType || 'force');
          return {
            type: 'damage',
            target: result.target === 'self' ? character.id : context?.target || 'unknown',
            result: damage
          };
        }
        break;

      case 'healing':
        if (result.dice) {
          const healing = this.dice.roll(result.dice);
          return {
            type: 'healing',
            target: result.target === 'self' ? character.id : context?.target || character.id,
            result: { amount: healing.total }
          };
        }
        break;

      case 'condition':
        if (result.condition) {
          const targetId = result.target === 'self' ? character.id : context?.target || character.id;
          this.conditions.applyCondition(targetId, result.condition, result.duration);
          return {
            type: 'condition',
            target: targetId,
            result: { condition: result.condition }
          };
        }
        break;

      case 'spell_cast':
        if (result.spell) {
          return {
            type: 'spell_cast',
            target: result.target === 'self' ? character.id : context?.target || 'unknown',
            result: result.spell
          };
        }
        break;

      case 'teleport':
        return {
          type: 'teleport',
          target: character.id,
          result: { distance: result.value || 30 }
        };

      case 'advantage':
        return {
          type: 'advantage',
          target: result.target === 'self' ? character.id : context?.target || character.id,
          result: { duration: result.duration || 1 }
        };
    }

    return null;
  }

  private checkTriggerCondition(trigger: EffectTrigger, character: any, context?: any): boolean {
    if (trigger.condition) {
      // Check specific trigger conditions
      switch (trigger.condition) {
        case 'critical_hit':
          return context?.isCritical === true;
        case 'killing_blow':
          return context?.targetDefeated === true;
        case 'below_half_hp':
          return character.hitPoints.current < character.hitPoints.max / 2;
        default:
          return true;
      }
    }
    return true;
  }

  private checkRestrictions(restrictions: EffectRestriction[], character: any): boolean {
    for (const restriction of restrictions) {
      if (!this.checkSingleRestriction(restriction, character)) {
        return false;
      }
    }
    return true;
  }

  private checkSingleRestriction(restriction: EffectRestriction, character: any): boolean {
    switch (restriction.type) {
      case 'class':
        return character.class?.toLowerCase() === restriction.value.toString().toLowerCase();
      case 'level': {
        const level = character.level || 1;
        switch (restriction.comparison) {
    }
          case 'greater': return level > restriction.value;
          case 'less': return level < restriction.value;
          case 'equal': return level === restriction.value;
          default: return level >= restriction.value;
        }
      case 'alignment':
        return character.alignment?.includes(restriction.value.toString());
      default:
        return true;
    }
  }

  private handleWeaponProperty(property: WeaponProperty, character: any, target: string, context: any): any {
    switch (property.id) {
      case 'finesse':
        // Allow using DEX instead of STR for attack/damage
        return {
          type: 'weapon_property',
          target: character.id,
          result: { property: 'finesse', allows_dex: true }
        };
      case 'versatile':
        // Different damage when used two-handed
        return {
          type: 'weapon_property',
          target: character.id,
          result: { property: 'versatile', two_handed_damage: context?.twoHanded }
        };
      case 'magic':
        // Magical weapon bypasses resistances
        return {
          type: 'weapon_property',
          target: character.id,
          result: { property: 'magic', bypasses_resistance: true }
        };
      default:
        return null;
    }
  }

  private applyStatBonus(bonuses: any, modifier: any): void {
    switch (modifier.stat) {
      case 'ac':
        bonuses.ac += modifier.bonus;
        break;
      case 'attack':
        bonuses.attackBonus += modifier.bonus;
        break;
      case 'damage':
        bonuses.damageBonus += modifier.bonus;
        break;
      case 'strength':
      case 'STR':
        bonuses.abilityScores.STR += modifier.bonus;
        break;
      case 'dexterity':
      case 'DEX':
        bonuses.abilityScores.DEX += modifier.bonus;
        break;
      case 'constitution':
      case 'CON':
        bonuses.abilityScores.CON += modifier.bonus;
        break;
      case 'intelligence':
      case 'INT':
        bonuses.abilityScores.INT += modifier.bonus;
        break;
      case 'wisdom':
      case 'WIS':
        bonuses.abilityScores.WIS += modifier.bonus;
        break;
      case 'charisma':
      case 'CHA':
        bonuses.abilityScores.CHA += modifier.bonus;
        break;
    }
  }

  private applyCharacterModifier(character: any, modifier: any): void {
    // Apply modifier directly to character stats
    if (!character.equipmentBonuses) {
      character.equipmentBonuses = {
        ac: 0, attackBonus: 0, damageBonus: 0,
        abilityScores: { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 }
      };
    }

    this.applyStatBonus(character.equipmentBonuses, modifier);
  }

  /**
   * Recharge magic item charges
   */
  rechargeItems(characterId: string, timeOfDay: 'dawn' | 'dusk' | 'midnight'): void {
    const equipment = this.characterEquipment.get(characterId) || [];

    for (const item of equipment) {
      if (item.charges && item.charges.rechargeRate) {
        if (item.charges.rechargeCondition === timeOfDay || 
            (timeOfDay === 'dawn' && !item.charges.rechargeCondition)) {
          
          if (item.charges.rechargeRate === 'all') {
            item.charges.current = item.charges.max;
          } else if (item.charges.rechargeRate.includes('d')) {
            // Roll for recharge (e.g., "1d3")
            const rechargeRoll = this.dice.roll(item.charges.rechargeRate);
            item.charges.current = Math.min(
              item.charges.max, 
              item.charges.current + rechargeRoll.total
            );
          }
        }
      }
    }
  }
}

// Common magical items
export const MAGICAL_ITEMS: Record<string, Equipment> = {
  swordOfSharpness: {
    id: 'sword_of_sharpness',
    name: 'Sword of Sharpness',
    type: 'weapon',
    rarity: 'very_rare',
    equipped: false,
    requiresAttunement: true,
    baseStats: {
      damage: '1d8+1',
      weight: 3
    },
    effects: [{
      id: 'critical_severing',
      name: 'Severing',
      type: 'triggered',
      trigger: {
        event: 'on_crit',
        condition: 'critical_hit'
      },
      effects: [{
        type: 'condition',
        target: 'target',
        condition: 'severed_limb',
        duration: -1
      }]
    }]
  },
  ringOfProtection: {
    id: 'ring_of_protection',
    name: 'Ring of Protection',
    type: 'wondrous',
    rarity: 'rare',
    equipped: false,
    requiresAttunement: true,
    effects: [{
      id: 'protection_bonus',
      name: 'Protection',
      type: 'passive',
      effects: [{
        type: 'modifier',
        target: 'self',
        modifier: {
          stat: 'ac',
          bonus: 1,
          type: 'enhancement'
        }
      }]
    }]
  }
};

// Export singleton instance
export const _equipmentEffectsEngine = new EquipmentEffectsEngine();
