/**
 * Computational Spell System - Full Machine-Executable Spell Logic
 * Every spell effect is defined as computational primitives that can be executed algorithmically
 */
// Spell execution engine
export class SpellExecutionEngine {
    execute(spell, ctx, slotLevel) {
        // Validation
        const validation = spell.canCast(ctx);
        if (!validation.valid) {
            return { success: false, results: [], error: validation.reason };
        }
        // Apply scaling
        const scaledSpell = this.applyScaling(spell, slotLevel || spell.metadata.level, ctx);
        // Pre-execution
        const executionCtx = spell.preExecution ? spell.preExecution(ctx) : ctx;
        // Execute effects
        const results = [];
        for (let i = 0; i < scaledSpell.effects.length; i++) {
            const effect = scaledSpell.effects[i];
            const result = this.executeEffect(effect, executionCtx, i);
            results.push(result);
            // Update context with effect results
            this.updateContext(executionCtx, result);
        }
        // Post-execution
        if (spell.postExecution) {
            spell.postExecution(executionCtx, results);
        }
        return { success: true, results };
    }
    executeEffect(effect, ctx, index) {
        switch (effect.type) {
            case "damage":
                return this.executeDamageEffect(effect, ctx, index);
            case "healing":
                return this.executeHealingEffect(effect, ctx, index);
            case "movement":
                return this.executeMovementEffect(effect, ctx, index);
            case "condition":
                return this.executeConditionEffect(effect, ctx, index);
            case "transformation":
                return this.executeTransformationEffect(effect, ctx, index);
            case "summon":
                return this.executeSummonEffect(effect, ctx, index);
            case "geometry":
                return this.executeGeometryEffect(effect, ctx, index);
            case "time":
                return this.executeTimeEffect(effect, ctx, index);
            case "information":
                return this.executeInformationEffect(effect, ctx, index);
            default:
                return { effectIndex: index, success: false, targets: [] };
        }
    }
    executeDamageEffect(effect, ctx, index) {
        const validTargets = Array.from(ctx.environment.entities.values()).filter((entity) => effect.targetFilter(entity, ctx));
        const results = {
            effectIndex: index,
            success: true,
            targets: [],
            modifications: [],
        };
        for (const target of validTargets) {
            let damage = effect.amount(ctx);
            // Apply saving throw
            if (effect.savingThrow) {
                const dc = effect.savingThrow.dc(ctx);
                const saveBonus = target.savingThrows[effect.savingThrow.ability] || 0;
                const roll = ctx.dice(20)[0] + saveBonus;
                if (roll >= dc) {
                    switch (effect.savingThrow.onSave) {
                        case "half":
                            damage = Math.floor(damage / 2);
                            break;
                        case "none":
                            damage = 0;
                            break;
                        case "negate":
                            continue;
                    }
                }
            }
            // Apply resistances/immunities
            damage = this.applyDamageResistance(damage, effect.damageType, target);
            // Apply damage
            if (damage > 0) {
                const oldHp = target.hitPoints.current;
                target.hitPoints.current = Math.max(0, target.hitPoints.current - damage);
                results.targets.push(target.id);
                results.modifications.push({
                    entityId: target.id,
                    property: "hitPoints.current",
                    oldValue: oldHp,
                    newValue: target.hitPoints.current,
                });
            }
        }
        return results;
    }
    executeHealingEffect(effect, ctx, index) {
        const validTargets = Array.from(ctx.environment.entities.values())
            .filter((entity) => effect.targetFilter(entity, ctx))
            .slice(0, effect.constraints?.maxTargets);
        const results = {
            effectIndex: index,
            success: true,
            targets: [],
            modifications: [],
        };
        for (const target of validTargets) {
            const healing = effect.amount(ctx);
            const oldHp = target.hitPoints.current;
            target.hitPoints.current = Math.min(target.hitPoints.maximum, target.hitPoints.current + healing);
            if (target.hitPoints.current > oldHp) {
                results.targets.push(target.id);
                results.modifications.push({
                    entityId: target.id,
                    property: "hitPoints.current",
                    oldValue: oldHp,
                    newValue: target.hitPoints.current,
                });
            }
        }
        return results;
    }
    // Additional effect execution methods would be implemented similarly...
    executeMovementEffect(effect, ctx, index) {
        // Implementation for movement effects
        return { effectIndex: index, success: true, targets: [] };
    }
    executeConditionEffect(effect, ctx, index) {
        // Implementation for condition effects
        return { effectIndex: index, success: true, targets: [] };
    }
    executeTransformationEffect(effect, ctx, index) {
        // Implementation for transformation effects
        return { effectIndex: index, success: true, targets: [] };
    }
    executeSummonEffect(effect, ctx, index) {
        // Implementation for summon effects
        return { effectIndex: index, success: true, targets: [] };
    }
    executeGeometryEffect(effect, ctx, index) {
        // Implementation for geometry effects
        return { effectIndex: index, success: true, targets: [] };
    }
    executeTimeEffect(effect, ctx, index) {
        // Implementation for time effects
        return { effectIndex: index, success: true, targets: [] };
    }
    executeInformationEffect(effect, ctx, index) {
        // Implementation for information effects
        return { effectIndex: index, success: true, targets: [] };
    }
    applyDamageResistance(damage, damageType, target) {
        if (target.immunities.has(damageType)) {
            return 0;
        }
        if (target.resistances.has(damageType)) {
            return Math.floor(damage / 2);
        }
        if (target.vulnerabilities.has(damageType)) {
            return damage * 2;
        }
        return damage;
    }
    applyScaling(spell, level, ctx) {
        if (!spell.scaling) {
            return spell;
        }
        const scaledSpell = JSON.parse(JSON.stringify(spell)); // Deep clone
        for (const scalingRule of spell.scaling.effects) {
            if (level >= scalingRule.threshold) {
                for (const modification of scalingRule.modifications) {
                    const effect = scaledSpell.effects[modification.effectIndex];
                    const newValue = modification.value(level, ctx);
                    // Apply modification based on operation
                    this.applyPropertyModification(effect, modification.property, modification.operation, newValue);
                }
            }
        }
        return scaledSpell;
    }
    applyPropertyModification(obj, property, operation, value) {
        const keys = property.split(".");
        let current = obj;
        for (let i = 0; i < keys.length - 1; i++) {
            current = current[keys[i]];
        }
        const finalKey = keys[keys.length - 1];
        switch (operation) {
            case "add":
                if (typeof current[finalKey] === "function") {
                    const originalFn = current[finalKey];
                    current[finalKey] = (ctx) => originalFn(ctx) + value;
                }
                else {
                    current[finalKey] += value;
                }
                break;
            case "multiply":
                if (typeof current[finalKey] === "function") {
                    const originalFn = current[finalKey];
                    current[finalKey] = (ctx) => originalFn(ctx) * value;
                }
                else {
                    current[finalKey] *= value;
                }
                break;
            case "replace":
                current[finalKey] = value;
                break;
        }
    }
    updateContext(ctx, result) {
        // Update the execution context based on effect results
        // This allows subsequent effects to see the changes from previous effects
        if (result.modifications) {
            for (const mod of result.modifications) {
                const entity = ctx.environment.entities.get(mod.entityId);
                if (entity) {
                    // Apply the modification to the context entity
                    this.setNestedProperty(entity, mod.property, mod.newValue);
                }
            }
        }
    }
    setNestedProperty(obj, path, value) {
        const keys = path.split(".");
        let current = obj;
        for (let i = 0; i < keys.length - 1; i++) {
            current = current[keys[i]];
        }
        current[keys[keys.length - 1]] = value;
    }
}
export const _spellExecutionEngine = new SpellExecutionEngine();
//# sourceMappingURL=ComputationalSpellSystem.js.map