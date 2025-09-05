/**
 * Spell Scaling and Upcasting Engine
 * Handles automatic scaling of spell effects when cast at higher levels
 */
export class SpellScalingEngine {
    /**
     * Calculate scaled spell effects for upcasting
     */
    upcastSpell(spell, castAtLevel, casterLevel) {
        if (castAtLevel < spell.level && spell.level > 0) {
            throw new Error(`Cannot cast ${spell.name} at level ${castAtLevel} (minimum level ${spell.level})`);
        }
        const scaledEffect = {
            originalSpell: spell,
            castAtLevel,
            scalingDescription: this.generateScalingDescription(spell, castAtLevel, casterLevel),
        };
        // Handle cantrip scaling (based on character level)
        if (spell.level === 0 && casterLevel) {
            return this.scaleCantrip(spell, casterLevel, scaledEffect);
        }
        // Handle spell slot upcasting
        if (spell.level > 0 && castAtLevel > spell.level) {
            return this.upcastSpellSlot(spell, castAtLevel, scaledEffect);
        }
        return scaledEffect;
    }
    /**
     * Scale cantrips based on character level
     */
    scaleCantrip(spell, casterLevel, effect) {
        const cantripScaleLevels = [5, 11, 17];
        const scaleMultiplier = cantripScaleLevels.filter((level) => casterLevel >= level).length + 1;
        if (spell.damage?.scalingDice && scaleMultiplier > 1) {
            const baseDice = spell.damage.diceExpression;
            const scalingDice = spell.damage.scalingDice;
            const bonusDice = scalingDice ? this.multiplyDice(scalingDice, scaleMultiplier - 1) : "";
            effect.scaledDamage = {
                originalDice: baseDice,
                scaledDice: this.addDice(baseDice, bonusDice),
                bonusDamage: bonusDice,
            };
        }
        if (spell.healing?.scalingDice && scaleMultiplier > 1) {
            const baseDice = spell.healing.diceExpression;
            const scalingDice = spell.healing.scalingDice;
            const bonusDice = scalingDice ? this.multiplyDice(scalingDice, scaleMultiplier - 1) : "";
            effect.scaledHealing = {
                originalDice: baseDice,
                scaledDice: this.addDice(baseDice, bonusDice),
                bonusHealing: bonusDice,
            };
        }
        return effect;
    }
    /**
     * Upcast spell using higher level slot
     */
    upcastSpellSlot(spell, castAtLevel, effect) {
        const bonusLevels = castAtLevel - spell.level;
        // Handle damage scaling
        if (spell.damage?.scalingDice) {
            const baseDice = spell.damage.diceExpression;
            const bonusDice = this.multiplyDice(spell.damage.scalingDice, bonusLevels);
            effect.scaledDamage = {
                originalDice: baseDice,
                scaledDice: this.addDice(baseDice, bonusDice),
                bonusDamage: bonusDice,
            };
        }
        // Handle healing scaling
        if (spell.healing?.scalingDice) {
            const baseDice = spell.healing.diceExpression;
            const bonusDice = this.multiplyDice(spell.healing.scalingDice, bonusLevels);
            effect.scaledHealing = {
                originalDice: baseDice,
                scaledDice: this.addDice(baseDice, bonusDice),
                bonusHealing: bonusDice,
            };
        }
        // Handle special spell-specific scaling
        effect.enhancedEffects = this.getSpellSpecificScaling(spell, bonusLevels);
        // Handle additional targets for certain spells
        effect.additionalTargets = this.getAdditionalTargets(spell, bonusLevels);
        return effect;
    }
    /**
     * Get spell-specific scaling effects
     */
    getSpellSpecificScaling(spell, bonusLevels) {
        const effects = [];
        switch (spell.id) {
            case "magic_missile":
                effects.push(`Creates ${bonusLevels} additional dart${bonusLevels > 1 ? "s" : ""}`);
                break;
            case "scorching_ray":
                effects.push(`Creates ${bonusLevels} additional ray${bonusLevels > 1 ? "s" : ""}`);
                break;
            case "sleep":
                {
                    const additionalHitPoints = bonusLevels * 16; // 2d8 average
                    effects.push(`Affects an additional ${additionalHitPoints} hit points worth of creatures`);
                }
                break;
            case "color_spray":
                {
                    const additionalHp = bonusLevels * 20; // 2d10 average
                    effects.push(`Affects an additional ${additionalHp} hit points worth of creatures`);
                }
                break;
            case "bless":
            case "charm_person":
            case "command":
            case "hold_person":
            case "invisibility":
                effects.push(`Can target ${bonusLevels} additional creature${bonusLevels > 1 ? "s" : ""}`);
                break;
            case "cure_wounds":
            case "burning_hands":
            case "thunderwave":
                // These just get dice scaling, already handled above
                break;
        }
        return effects;
    }
    /**
     * Calculate additional targets for upcasting
     */
    getAdditionalTargets(spell, bonusLevels) {
        const multiTargetSpells = [
            "bless",
            "charm_person",
            "command",
            "hold_person",
            "invisibility",
            "fly",
            "haste",
        ];
        if (multiTargetSpells.includes(spell.id)) {
            return bonusLevels;
        }
        return 0;
    }
    /**
     * Generate human-readable scaling description
     */
    generateScalingDescription(spell, castAtLevel, casterLevel) {
        if (spell.level === 0 && casterLevel) {
            const cantripScaleLevels = [5, 11, 17];
            const scaleLevel = cantripScaleLevels.find((level) => casterLevel >= level && casterLevel < level + 6);
            if (scaleLevel) {
                return `Cantrip scaled for character level ${casterLevel} (tier ${Math.floor(casterLevel / 6) + 1})`;
            }
            return `Cantrip at character level ${casterLevel}`;
        }
        if (castAtLevel === spell.level) {
            return `Cast at base level ${spell.level}`;
        }
        const bonusLevels = castAtLevel - spell.level;
        return `Cast at level ${castAtLevel} (+${bonusLevels} level${bonusLevels > 1 ? "s" : ""} higher)`;
    }
    /**
     * Multiply dice expression by a factor
     */
    multiplyDice(diceExpression, multiplier) {
        if (multiplier <= 0)
            return "";
        if (multiplier === 1)
            return diceExpression;
        // Handle expressions like "1d6", "2d8+1", etc.
        const diceRegex = /(\d+)d(\d+)(\+\d+)?/g;
        return diceExpression.replace(diceRegex, (match, _numDice, _diceSize, _bonus) => {
            const newNumDice = parseInt(numDice) * multiplier;
            const bonusPart = bonus || "";
            return `${newNumDice}d${diceSize}${bonusPart}`;
        });
    }
    /**
     * Add two dice expressions together
     */
    addDice(baseDice, bonusDice) {
        if (!bonusDice)
            return baseDice;
        if (!baseDice)
            return bonusDice;
        return `${baseDice}+${bonusDice}`;
    }
    /**
     * Calculate average damage for a dice expression
     */
    calculateAverageDamage(diceExpression) {
        const diceRegex = /(\d+)d(\d+)(\+\d+)?/g;
        let total = 0;
        let match;
        while ((match = diceRegex.exec(diceExpression)) !== null) {
            const numDice = parseInt(match[1]);
            const diceSize = parseInt(match[2]);
            const bonus = match[3] ? parseInt(match[3]) : 0;
            total += (numDice * (diceSize + 1)) / 2 + bonus;
        }
        // Handle standalone bonuses like "+5"
        const bonusRegex = /(?:^|\+)(\d+)(?!d)/g;
        while ((match = bonusRegex.exec(diceExpression)) !== null) {
            if (!diceExpression.substring(0, match.index).includes("d")) {
                total += parseInt(match[1]);
            }
        }
        return Math.round(total);
    }
    /**
     * Get all possible upcasting levels for a spell
     */
    getAvailableUpcastLevels(spell, availableSlots) {
        if (spell.level === 0)
            return [0]; // Cantrips don't upcast with slots
        const levels = [];
        for (let level = spell.level; level <= 9; level++) {
            if (availableSlots[level] && availableSlots[level] > 0) {
                levels.push(level);
            }
        }
        return levels;
    }
    /**
     * Predict spell effectiveness at different levels
     */
    getUpcastingRecommendation(spell, availableSlots) {
        const recommendations = [];
        const availableLevels = this.getAvailableUpcastLevels(spell, availableSlots);
        for (const level of availableLevels) {
            const scaledEffect = this.upcastSpell(spell, level);
            let effectiveness = level; // Base effectiveness is the slot level
            let recommendation = "";
            // Calculate effectiveness based on scaling
            if (scaledEffect.scaledDamage && spell.damage) {
                const baseDamage = this.calculateAverageDamage(spell.damage.diceExpression);
                const scaledDamage = this.calculateAverageDamage(scaledEffect.scaledDamage.scaledDice);
                const damageIncrease = (scaledDamage - baseDamage) / baseDamage;
                effectiveness += damageIncrease * 5; // Weight damage increases
                recommendation = `+${Math.round(damageIncrease * 100)}% damage`;
            }
            if (scaledEffect.additionalTargets) {
                effectiveness += scaledEffect.additionalTargets * 2; // Additional targets are valuable
                recommendation +=
                    (recommendation ? ", " : "") +
                        `+${scaledEffect.additionalTargets} target${scaledEffect.additionalTargets > 1 ? "s" : ""}`;
            }
            if (scaledEffect.enhancedEffects && scaledEffect.enhancedEffects.length > 0) {
                effectiveness += scaledEffect.enhancedEffects.length;
                recommendation += (recommendation ? ", " : "") + scaledEffect.enhancedEffects.join(", ");
            }
            if (!recommendation) {
                recommendation = level === spell.level ? "Base level" : "Higher slot level";
            }
            recommendations.push({ level, effectiveness, recommendation });
        }
        return recommendations.sort((_a, _b) => b.effectiveness - a.effectiveness);
    }
}
// Export singleton instance
export const _spellScalingEngine = new SpellScalingEngine();
//# sourceMappingURL=SpellScalingEngine.js.map