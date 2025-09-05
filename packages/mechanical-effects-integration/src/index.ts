/**
 * Mechanical Effects Integration Service
 * Connects conditions, spells, equipment, and abilities to their mechanical impacts
 */

import { conditionsEngine, _ConditionEffect, ActiveCondition } from "@vtt/conditions-engine";
import { equipmentEffectsEngine } from "@vtt/equipment-effects";
import { _spellEngine } from "@vtt/spell-engine";
import { monsterAbilitiesEngine } from "@vtt/monster-abilities";
import { networkSyncEngine } from "@vtt/network-sync";

export interface MechanicalEffectContext {
  entityId: string;
  actionType: "attack" | "save" | "check" | "damage" | "healing" | "movement" | "spell";
  target?: string;
  subtype?: string; // e.g., 'strength_save', 'melee_attack', 'fire_damage'
  baseDice?: string;
  baseModifier?: number;
  metadata?: Record<string, any>;
}

export interface MechanicalResult {
  finalValue: number;
  advantage: boolean;
  disadvantage: boolean;
  modifiers: Array<{
    source: string;
    type: string;
    value: number;
  }>;
  resistances: string[];
  immunities: string[];
  vulnerabilities: string[];
  prevented: boolean;
  additionalEffects: Array<{
    type: string;
    value: any;
    source: string;
  }>;
}

export class MechanicalEffectsIntegrator {
  private activeIntegrations = new Map<string, Set<string>>(); // entityId -> active effect sources

  /**
   * Apply all mechanical effects to an action/roll
   */
  calculateMechanicalEffects(context: MechanicalEffectContext): MechanicalResult {
    const result: MechanicalResult = {
      finalValue: context.baseModifier || 0,
      advantage: false,
      disadvantage: false,
      modifiers: [],
      resistances: [],
      immunities: [],
      vulnerabilities: [],
      prevented: false,
      additionalEffects: [],
    };

    // Apply condition effects
    this.applyConditionEffects(context, result);

    // Apply equipment effects
    this.applyEquipmentEffects(context, result);

    // Apply spell effects
    this.applySpellEffects(context, result);

    // Apply ability effects (for monsters)
    this.applyAbilityEffects(context, result);

    // Calculate final result
    this.calculateFinalResult(context, result);

    return result;
  }

  private applyConditionEffects(context: MechanicalEffectContext, result: MechanicalResult): void {
    const conditionEffects = conditionsEngine.applyConditionEffects(
      context.entityId,
      context.actionType,
    );

    if (conditionEffects.advantage) {result.advantage = true;}
    if (conditionEffects.disadvantage) {result.disadvantage = true;}
    if (conditionEffects.prevented) {result.prevented = true;}

    // Add condition modifiers
    conditionEffects.modifiers.forEach((modifier) => {
      result.modifiers.push({
        source: "condition",
        type: "modifier",
        value: modifier,
      });
    });

    // Get damage modifications from conditions
    const damageModifications = conditionsEngine.getDamageModifications(context.entityId);
    result.resistances.push(...damageModifications.resistances);
    result.immunities.push(...damageModifications.immunities);
    result.vulnerabilities.push(...damageModifications.vulnerabilities);
  }

  private applyEquipmentEffects(context: MechanicalEffectContext, result: MechanicalResult): void {
    // Get equipment bonuses
    const characterData = this.getCharacterData(context.entityId);
    if (!characterData) {return;}

    const equipmentBonuses = equipmentEffectsEngine.calculateEquipmentBonuses(
      context.entityId,
      characterData,
    );

    // Apply relevant bonuses based on action type
    switch (context.actionType) {
      case "attack":
        result.modifiers.push({
          source: "equipment",
          type: "attack_bonus",
          value: equipmentBonuses.attackBonus,
        });
        break;

      case "damage":
        result.modifiers.push({
          source: "equipment",
          type: "damage_bonus",
          value: equipmentBonuses.damageBonus,
        });
        break;

      case "save":
        if (context.subtype && equipmentBonuses.savingThrows[context.subtype]) {
          result.modifiers.push({
            source: "equipment",
            type: "save_bonus",
            value: equipmentBonuses.savingThrows[context.subtype],
          });
        }
        break;
    }

    // Apply equipment-triggered effects
    if (context.actionType === "attack" && context.metadata?.weaponId) {
      const weaponEffects = equipmentEffectsEngine.processWeaponAttack(
        context.entityId,
        context.metadata.weaponId,
        characterData,
        context.target || "",
        context.metadata,
      );

      result.modifiers.push({
        source: "weapon",
        type: "attack_bonus",
        value: weaponEffects.attackBonus,
      });

      weaponEffects.effects.forEach((effect) => {
        result.additionalEffects.push({
          type: effect.type,
          value: effect.result,
          source: "weapon_property",
        });
      });
    }
  }

  private applySpellEffects(context: MechanicalEffectContext, result: MechanicalResult): void {
    const characterData = this.getCharacterData(context.entityId);
    if (!characterData?.concentrationSpell) {return;}

    const concentrationSpell = characterData.concentrationSpell;

    // Apply ongoing spell effects that might affect rolls
    if (concentrationSpell.spell === "bless" && context.actionType === "attack") {
      result.modifiers.push({
        source: "spell_bless",
        type: "divine_bonus",
        value: 4, // 1d4 average
      });
    }

    if (concentrationSpell.spell === "guidance" && context.actionType === "check") {
      result.modifiers.push({
        source: "spell_guidance",
        type: "divine_bonus",
        value: 2, // 1d4 average
      });
    }
  }

  private applyAbilityEffects(context: MechanicalEffectContext, result: MechanicalResult): void {
    // Apply monster ability effects
    const availableAbilities = monsterAbilitiesEngine.getAvailableAbilities(context.entityId);

    // Check for passive abilities that affect actions
    for (const trait of availableAbilities.traits) {
      if (trait.type === "trait" && this.traitAffectsAction(trait, context)) {
        this.applyTraitEffect(trait, context, result);
      }
    }
  }

  private traitAffectsAction(trait: any, context: MechanicalEffectContext): boolean {
    // Examples of traits that affect actions
    switch (trait.id) {
      case "pack_tactics":
        return context.actionType === "attack" && this.hasNearbyAllies(context.entityId);
      case "keen_senses":
        return context.actionType === "check" && context.subtype?.includes("perception");
      case "magic_resistance":
        return context.actionType === "save" && context.metadata?.isMagical;
      default:
        return false;
    }
  }

  private applyTraitEffect(
    trait: any,
    context: MechanicalEffectContext,
    result: MechanicalResult,
  ): void {
    switch (trait.id) {
      case "pack_tactics":
        result.advantage = true;
        result.additionalEffects.push({
          type: "pack_tactics",
          value: "advantage_on_attack",
          source: trait.name,
        });
        break;

      case "keen_senses":
        result.advantage = true;
        result.additionalEffects.push({
          type: "keen_senses",
          value: "advantage_on_perception",
          source: trait.name,
        });
        break;

      case "magic_resistance":
        result.advantage = true;
        result.additionalEffects.push({
          type: "magic_resistance",
          value: "advantage_on_magic_saves",
          source: trait.name,
        });
        break;
    }
  }

  private calculateFinalResult(context: MechanicalEffectContext, result: MechanicalResult): void {
    // Sum all modifiers
    const totalModifier = result.modifiers.reduce((_sum, _mod) => sum + mod.value, 0);
    result.finalValue = (context.baseModifier || 0) + totalModifier;

    // Handle advantage/disadvantage cancellation
    if (result.advantage && result.disadvantage) {
      result.advantage = false;
      result.disadvantage = false;
    }
  }

  /**
   * Process damage with all mechanical effects
   */
  processDamage(
    targetId: string,
    damage: { amount: number; type: string; source: string },
  ): {
    finalDamage: number;
    resistances: string[];
    immunities: string[];
    vulnerabilities: string[];
    effects: Array<{ type: string; value: any; source: string }>;
  } {
    const context: MechanicalEffectContext = {
      entityId: targetId,
      actionType: "damage",
      subtype: damage.type,
      metadata: { damageSource: damage.source },
    };

    const mechanicalResult = this.calculateMechanicalEffects(context);
    let finalDamage = damage.amount;

    // Apply resistances, immunities, vulnerabilities
    if (
      mechanicalResult.immunities.includes(damage.type) ||
      mechanicalResult.immunities.includes("all_damage")
    ) {
      finalDamage = 0;
    } else if (
      mechanicalResult.resistances.includes(damage.type) ||
      mechanicalResult.resistances.includes("all_damage")
    ) {
      finalDamage = Math.floor(finalDamage / 2);
    } else if (mechanicalResult.vulnerabilities.includes(damage.type)) {
      finalDamage = finalDamage * 2;
    }

    // Apply damage modifiers
    const damageModifiers = mechanicalResult.modifiers
      .filter((mod) => mod.type.includes("damage"))
      .reduce((_sum, _mod) => sum + mod.value, 0);

    finalDamage = Math.max(0, finalDamage + damageModifiers);

    return {
      finalDamage,
      resistances: mechanicalResult.resistances,
      immunities: mechanicalResult.immunities,
      vulnerabilities: mechanicalResult.vulnerabilities,
      effects: mechanicalResult.additionalEffects,
    };
  }

  /**
   * Process healing with mechanical effects
   */
  processHealing(
    targetId: string,
    healing: { amount: number; source: string },
  ): {
    finalHealing: number;
    effects: Array<{ type: string; value: any; source: string }>;
  } {
    const context: MechanicalEffectContext = {
      entityId: targetId,
      actionType: "healing",
      metadata: { healingSource: healing.source },
    };

    const mechanicalResult = this.calculateMechanicalEffects(context);

    // Apply healing modifiers
    const healingModifiers = mechanicalResult.modifiers
      .filter((mod) => mod.type.includes("healing"))
      .reduce((_sum, _mod) => sum + mod.value, 0);

    const finalHealing = Math.max(0, healing.amount + healingModifiers);

    return {
      finalHealing,
      effects: mechanicalResult.additionalEffects,
    };
  }

  /**
   * Check if an action is prevented by mechanical effects
   */
  isActionPrevented(entityId: string, actionType: string): boolean {
    const context: MechanicalEffectContext = {
      entityId,
      actionType: actionType as any,
      subtype: actionType,
    };

    const result = this.calculateMechanicalEffects(context);
    return result.prevented;
  }

  /**
   * Get all active mechanical effects for an entity
   */
  getActiveMechanicalEffects(entityId: string): {
    conditions: ActiveCondition[];
    equipment: any[];
    spells: any[];
    abilities: any[];
  } {
    return {
      conditions: conditionsEngine.getActiveConditions(entityId),
      equipment: equipmentEffectsEngine.getEquippedItems(entityId),
      spells: [], // Would get from spell system
      abilities: monsterAbilitiesEngine.getAvailableAbilities(entityId).traits,
    };
  }

  /**
   * Trigger effects based on events
   */
  triggerEventEffects(
    entityId: string,
    event: string,
    context?: any,
  ): Array<{ type: string; effect: any; source: string }> {
    const effects: Array<{ type: string; effect: any; source: string }> = [];

    // Trigger equipment effects
    const equipmentEffects = equipmentEffectsEngine.processTriggers(
      entityId,
      event,
      this.getCharacterData(entityId),
      context,
    );

    equipmentEffects.forEach((result) => {
      result.effects.forEach((effect) => {
        effects.push({
          type: effect.type,
          effect: effect.result,
          source: "equipment",
        });
      });
    });

    // Trigger monster ability effects
    const abilityEffects = monsterAbilitiesEngine.processTriggers(
      entityId,
      event,
      this.getCharacterData(entityId),
      context,
    );

    abilityEffects.forEach((result) => {
      result.effects.forEach((effect) => {
        effects.push({
          type: effect.type,
          effect: effect.result,
          source: "monster_ability",
        });
      });
    });

    // Process condition effects at start/end of turn
    if (event === "start_turn") {
      const conditionEffects = conditionsEngine.processTurnStart(entityId);
      conditionEffects.forEach((effect) => {
        effects.push({
          type: effect.type,
          effect,
          source: "condition",
        });
      });
    } else if (event === "end_turn") {
      const turnEndResult = conditionsEngine.processTurnEnd(entityId);
      turnEndResult.effects.forEach((effect) => {
        effects.push({
          type: effect.type,
          effect,
          source: "condition",
        });
      });
    }

    return effects;
  }

  /**
   * Sync mechanical effect changes to network
   */
  syncMechanicalChanges(entityId: string, changes: any): void {
    networkSyncEngine.updateEntityState(entityId, changes, "mechanical_effects");
  }

  private getCharacterData(entityId: string): any {
    // This would integrate with the character system to get full character data
    // For now, return a placeholder
    return {
      id: entityId,
      hitPoints: { current: 100, max: 100 },
      abilities: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
      level: 1,
      class: "fighter",
      proficiencyBonus: 2,
    };
  }

  private hasNearbyAllies(_entityId: string): boolean {
    // This would check the game state for nearby allies
    // For now, return false as placeholder
    return false;
  }
}

// Integration with combat system
export class CombatMechanicsIntegrator {
  private mechanicalEffects = new MechanicalEffectsIntegrator();

  /**
   * Process a complete attack with all mechanical effects
   */
  processAttack(
    attackerId: string,
    targetId: string,
    attackData: {
      weaponId?: string;
      attackType: "melee" | "ranged" | "spell";
      baseDamage: string;
      damageType: string;
    },
  ): {
    attackRoll: { total: number; advantage: boolean; disadvantage: boolean };
    damage: { total: number; type: string; effects: any[] };
    effects: any[];
  } {
    // Process attack roll
    const attackContext: MechanicalEffectContext = {
      entityId: attackerId,
      actionType: "attack",
      target: targetId,
      subtype: attackData.attackType,
      metadata: { weaponId: attackData.weaponId },
    };

    const attackEffects = this.mechanicalEffects.calculateMechanicalEffects(attackContext);

    // Process damage
    const damageContext: MechanicalEffectContext = {
      entityId: targetId,
      actionType: "damage",
      subtype: attackData.damageType,
      baseDice: attackData.baseDamage,
      metadata: { attackerId, weaponId: attackData.weaponId },
    };

    const damageEffects = this.mechanicalEffects.calculateMechanicalEffects(damageContext);

    return {
      attackRoll: {
        total: attackEffects.finalValue,
        advantage: attackEffects.advantage,
        disadvantage: attackEffects.disadvantage,
      },
      damage: {
        total: damageEffects.finalValue,
        type: attackData.damageType,
        effects: damageEffects.additionalEffects,
      },
      effects: [...attackEffects.additionalEffects, ...damageEffects.additionalEffects],
    };
  }

  /**
   * Process a saving throw with all mechanical effects
   */
  processSavingThrow(
    entityId: string,
    saveType: string,
    dc: number,
    source?: string,
  ): {
    total: number;
    success: boolean;
    advantage: boolean;
    disadvantage: boolean;
    effects: any[];
  } {
    const context: MechanicalEffectContext = {
      entityId,
      actionType: "save",
      subtype: saveType,
      metadata: { dc, source },
    };

    const result = this.mechanicalEffects.calculateMechanicalEffects(context);

    return {
      total: result.finalValue,
      success: result.finalValue >= dc,
      advantage: result.advantage,
      disadvantage: result.disadvantage,
      effects: result.additionalEffects,
    };
  }
}

// Export singleton instances
export const _mechanicalEffectsIntegrator = new MechanicalEffectsIntegrator();
export const _combatMechanicsIntegrator = new CombatMechanicsIntegrator();
