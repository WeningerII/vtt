/**
 * D&D 5e Spell Casting Automation Engine
 * Handles spell casting mechanics, slot management, and spell effects
 */
import { diceEngine } from "@vtt/dice-engine";
import { conditionsEngine } from "@vtt/conditions-engine";
export class SpellEngine {
    constructor() {
        this.dice = diceEngine;
        this.conditions = conditionsEngine;
    }
    /**
     * Cast a spell with automatic effect resolution
     */
    castSpell(spell, caster, targets, spellLevel, position) {
        const castLevel = spellLevel || spell.level;
        // Check spell slot availability
        if (spell.level > 0) {
            if (!this.hasSpellSlot(caster, castLevel)) {
                return { success: false, error: "No spell slots available", spellSlotUsed: 0, effects: [] };
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
        const effects = [];
        const conditions = [];
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
                effects: conditions,
            };
        }
        return {
            success: true,
            spellSlotUsed: castLevel,
            effects,
            conditions,
        };
    }
    resolveSpellEffect(effect, caster, targets, spellLevel, position) {
        const effects = [];
        const conditions = [];
        switch (effect.type) {
            case "damage":
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
                            const saveResult = this.rollSavingThrow(targetId, effect.damage.savingThrow.ability, effect.damage.savingThrow.dc || caster.spellSaveDC);
                            if (saveResult.success) {
                                switch (effect.damage.savingThrow.onSuccess) {
                                    case "half":
                                        finalDamage = Math.floor(finalDamage / 2);
                                        break;
                                    case "none":
                                        finalDamage = 0;
                                        break;
                                    case "negates":
                                        continue; // Skip this target entirely
                                }
                            }
                        }
                        effects.push({
                            type: "damage",
                            target: targetId,
                            result: { ...damageResult, total: finalDamage },
                        });
                    }
                }
                break;
            case "healing":
                if (effect.healing) {
                    let healing = effect.healing.dice;
                    // Apply scaling
                    const bonusLevels = spellLevel - 1;
                    if (bonusLevels > 0) {
                        healing = this.scaleHealing(healing, bonusLevels);
                    }
                    const healTargets = effect.healing.maxTargets
                        ? targets.slice(0, effect.healing.maxTargets)
                        : targets;
                    for (const targetId of healTargets) {
                        const healingRoll = this.dice.roll(healing);
                        effects.push({
                            type: "healing",
                            target: targetId,
                            result: { amount: healingRoll.total },
                        });
                    }
                }
                break;
            case "condition":
                if (effect.condition) {
                    for (const targetId of targets) {
                        let applyCondition = true;
                        // Handle saving throws
                        if (effect.condition.savingThrow) {
                            const saveResult = this.rollSavingThrow(targetId, effect.condition.savingThrow.ability, effect.condition.savingThrow.dc || caster.spellSaveDC);
                            if (saveResult.success) {
                                applyCondition = false;
                            }
                        }
                        if (applyCondition) {
                            conditions.push({
                                target: targetId,
                                condition: effect.condition.id,
                                duration: effect.condition.duration,
                            });
                            effects.push({
                                type: "condition",
                                target: targetId,
                                result: { condition: effect.condition.id },
                            });
                        }
                    }
                }
                break;
            case "buff":
            case "debuff":
                if (effect.modifier) {
                    for (const targetId of targets) {
                        effects.push({
                            type: effect.type,
                            target: targetId,
                            result: {
                                modifier: effect.modifier.target,
                                value: effect.modifier.value,
                                duration: effect.modifier.duration,
                            },
                        });
                    }
                }
                break;
            case "custom":
                // Handle custom spell effects
                if (effect.custom) {
                    effects.push({
                        type: "custom",
                        target: targets[0] || "none",
                        result: { description: effect.custom.description },
                    });
                }
                break;
        }
        return { effects, conditions };
    }
    hasSpellSlot(caster, level) {
        const slots = caster.spellSlots;
        if (!slots || !slots[level])
            return false;
        return slots[level].current > 0;
    }
    consumeSpellSlot(caster, level) {
        if (caster.spellSlots && caster.spellSlots[level]) {
            caster.spellSlots[level].current = Math.max(0, caster.spellSlots[level].current - 1);
        }
    }
    rollSavingThrow(targetId, ability, dc) {
        // This would integrate with the character system to get the target's save bonus
        const saveBonus = 0; // Placeholder - would get from character data
        const roll = this.dice.rollSavingThrow(saveBonus, dc);
        return roll;
    }
    scaleDamage(baseDamage, bonusLevels) {
        // Simple scaling - add 1d6 per level (would be spell-specific in real implementation)
        return `${baseDamage}+${bonusLevels}d6`;
    }
    scaleHealing(baseHealing, bonusLevels) {
        // Simple scaling for healing
        return `${baseHealing}+${bonusLevels}d4`;
    }
    parseDuration(duration) {
        // Parse duration strings into rounds/minutes
        if (duration.includes("1 minute"))
            return 10; // 10 rounds
        if (duration.includes("10 minutes"))
            return 100; // 100 rounds
        if (duration.includes("1 hour"))
            return 600; // 600 rounds
        return 1; // Default to 1 round
    }
    /**
     * End concentration on a spell
     */
    endConcentration(caster) {
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
    checkConcentration(caster, damage) {
        if (!caster.concentrationSpell)
            return true;
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
    restoreSpellSlots(caster) {
        if (caster.spellSlots) {
            for (const level of Object.keys(caster.spellSlots)) {
                caster.spellSlots[level].current = caster.spellSlots[level].max;
            }
        }
    }
    /**
     * Get available spell slots
     */
    getAvailableSlots(caster) {
        return caster.spellSlots || {};
    }
}
// Common D&D 5e spells
export const D5E_SPELLS = {
    magicMissile: {
        id: "magic_missile",
        name: "Magic Missile",
        level: 1,
        school: "evocation",
        castingTime: "1 action",
        range: "120 feet",
        components: { verbal: true, somatic: true },
        duration: "Instantaneous",
        concentration: false,
        ritual: false,
        description: "Three glowing darts of magical force strike targets for 1d4+1 force damage each",
        effects: [
            {
                type: "damage",
                target: "multiple",
                damage: {
                    dice: "1d4+1",
                    type: "force",
                },
            },
        ],
        scaling: {
            damage: "1d4+1",
        },
    },
    fireball: {
        id: "fireball",
        name: "Fireball",
        level: 3,
        school: "evocation",
        castingTime: "1 action",
        range: "150 feet",
        components: { verbal: true, somatic: true, material: "A tiny ball of bat guano and sulfur" },
        duration: "Instantaneous",
        concentration: false,
        ritual: false,
        description: "A bright flash and thunderous boom, creatures in 20-foot radius make Dex save",
        effects: [
            {
                type: "damage",
                target: "area",
                area: { type: "sphere", size: 20 },
                damage: {
                    dice: "8d6",
                    type: "fire",
                    savingThrow: {
                        ability: "DEX",
                        onSuccess: "half",
                    },
                },
            },
        ],
        scaling: {
            damage: "1d6",
        },
    },
    cureWounds: {
        id: "cure_wounds",
        name: "Cure Wounds",
        level: 1,
        school: "evocation",
        castingTime: "1 action",
        range: "Touch",
        components: { verbal: true, somatic: true },
        duration: "Instantaneous",
        concentration: false,
        ritual: false,
        description: "Touch a creature to restore hit points",
        effects: [
            {
                type: "healing",
                target: "single",
                healing: {
                    dice: "1d8",
                },
            },
        ],
        scaling: {
            healing: "1d8",
        },
    },
};
// Export singleton instance
export const _spellEngine = new SpellEngine();
export const spellEngine = _spellEngine;
//# sourceMappingURL=index.js.map