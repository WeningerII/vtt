/**
 * D&D 5e Condition and Status Effect Management System
 * Handles all conditions, temporary effects, and their interactions
 */
// Predefined D&D 5e conditions
export const D5E_CONDITIONS = {
    blinded: {
        id: 'blinded',
        name: 'Blinded',
        description: 'Cannot see and automatically fails ability checks that require sight',
        duration: -1,
        effects: [
            { type: 'disadvantage', target: 'attack_rolls' },
            { type: 'advantage', target: 'incoming_attacks' }
        ]
    },
    charmed: {
        id: 'charmed',
        name: 'Charmed',
        description: 'Cannot attack the charmer or target them with harmful abilities',
        duration: -1,
        effects: [
            { type: 'prevent_action', target: 'attack_charmer' },
            { type: 'advantage', target: 'charmer_social_interactions' }
        ]
    },
    deafened: {
        id: 'deafened',
        name: 'Deafened',
        description: 'Cannot hear and automatically fails ability checks that require hearing',
        duration: -1,
        effects: []
    },
    frightened: {
        id: 'frightened',
        name: 'Frightened',
        description: 'Disadvantage on ability checks and attacks while source is in sight',
        duration: -1,
        effects: [
            { type: 'disadvantage', target: 'ability_checks' },
            { type: 'disadvantage', target: 'attack_rolls' },
            { type: 'prevent_action', target: 'move_closer_to_source' }
        ]
    },
    grappled: {
        id: 'grappled',
        name: 'Grappled',
        description: 'Speed becomes 0 and cannot benefit from bonuses to speed',
        duration: -1,
        effects: [
            { type: 'speed_modifier', target: 'all', value: 0 }
        ]
    },
    incapacitated: {
        id: 'incapacitated',
        name: 'Incapacitated',
        description: 'Cannot take actions or reactions',
        duration: -1,
        effects: [
            { type: 'prevent_action', target: 'actions' },
            { type: 'prevent_action', target: 'reactions' }
        ]
    },
    invisible: {
        id: 'invisible',
        name: 'Invisible',
        description: 'Cannot be seen without special senses',
        duration: -1,
        effects: [
            { type: 'advantage', target: 'attack_rolls' },
            { type: 'disadvantage', target: 'incoming_attacks' },
            { type: 'advantage', target: 'stealth_checks' }
        ]
    },
    paralyzed: {
        id: 'paralyzed',
        name: 'Paralyzed',
        description: 'Incapacitated and cannot move or speak',
        duration: -1,
        effects: [
            { type: 'prevent_action', target: 'actions' },
            { type: 'prevent_action', target: 'reactions' },
            { type: 'prevent_action', target: 'movement' },
            { type: 'prevent_action', target: 'speech' },
            { type: 'advantage', target: 'incoming_attacks' },
            { type: 'advantage', target: 'incoming_melee_crits' }
        ]
    },
    petrified: {
        id: 'petrified',
        name: 'Petrified',
        description: 'Incapacitated, cannot move or speak, and has resistance to all damage',
        duration: -1,
        effects: [
            { type: 'prevent_action', target: 'actions' },
            { type: 'prevent_action', target: 'reactions' },
            { type: 'prevent_action', target: 'movement' },
            { type: 'prevent_action', target: 'speech' },
            { type: 'resistance', target: 'all_damage' }
        ]
    },
    poisoned: {
        id: 'poisoned',
        name: 'Poisoned',
        description: 'Disadvantage on attack rolls and ability checks',
        duration: -1,
        effects: [
            { type: 'disadvantage', target: 'attack_rolls' },
            { type: 'disadvantage', target: 'ability_checks' }
        ]
    },
    prone: {
        id: 'prone',
        name: 'Prone',
        description: 'Disadvantage on attack rolls, advantage on incoming melee attacks',
        duration: -1,
        effects: [
            { type: 'disadvantage', target: 'attack_rolls' },
            { type: 'advantage', target: 'incoming_melee_attacks' },
            { type: 'disadvantage', target: 'incoming_ranged_attacks' }
        ]
    },
    restrained: {
        id: 'restrained',
        name: 'Restrained',
        description: 'Speed becomes 0, disadvantage on attacks and Dex saves',
        duration: -1,
        effects: [
            { type: 'speed_modifier', target: 'all', value: 0 },
            { type: 'disadvantage', target: 'attack_rolls' },
            { type: 'disadvantage', target: 'dexterity_saves' },
            { type: 'advantage', target: 'incoming_attacks' }
        ]
    },
    stunned: {
        id: 'stunned',
        name: 'Stunned',
        description: 'Incapacitated, cannot move, and can speak only falteringly',
        duration: -1,
        effects: [
            { type: 'prevent_action', target: 'actions' },
            { type: 'prevent_action', target: 'reactions' },
            { type: 'prevent_action', target: 'movement' },
            { type: 'advantage', target: 'incoming_attacks' }
        ]
    },
    unconscious: {
        id: 'unconscious',
        name: 'Unconscious',
        description: 'Incapacitated, cannot move or speak, unaware of surroundings',
        duration: -1,
        effects: [
            { type: 'prevent_action', target: 'actions' },
            { type: 'prevent_action', target: 'reactions' },
            { type: 'prevent_action', target: 'movement' },
            { type: 'prevent_action', target: 'speech' },
            { type: 'advantage', target: 'incoming_attacks' },
            { type: 'advantage', target: 'incoming_melee_crits' },
            { type: 'custom', target: 'drop_concentration' }
        ],
        replaces: ['prone']
    }
};
export class ConditionsEngine {
    constructor() {
        this.activeConditions = new Map(); // entityId -> conditions
    }
    /**
     * Apply condition to entity
     */
    applyCondition(entityId, condition, duration, source, metadata) {
        const conditionData = typeof condition === 'string' ?
            D5E_CONDITIONS[condition] : condition;
        if (!conditionData) {
            throw new Error(`Unknown condition: ${condition}`);
        }
        // Check if condition is prevented by existing conditions
        const existingConditions = this.getActiveConditions(entityId);
        for (const existing of existingConditions) {
            if (existing.preventedBy?.includes(conditionData.id)) {
                throw new Error(`Condition ${conditionData.name} prevented by ${existing.name}`);
            }
        }
        // Handle condition replacement
        if (conditionData.replaces) {
            for (const replacedId of conditionData.replaces) {
                this.removeCondition(entityId, replacedId);
            }
        }
        // Check if condition is stackable
        if (!conditionData.stackable) {
            const existing = existingConditions.find(c => c.id === conditionData.id);
            if (existing) {
                // Update existing condition instead of stacking
                existing.remainingDuration = Math.max(existing.remainingDuration, duration ?? conditionData.duration);
                existing.metadata = { ...existing.metadata, ...metadata };
                return existing;
            }
        }
        const activeCondition = {
            ...conditionData,
            appliedAt: Date.now(),
            remainingDuration: duration ?? conditionData.duration,
            appliedBy: source || 'unknown',
            metadata: metadata || {}
        };
        if (!this.activeConditions.has(entityId)) {
            this.activeConditions.set(entityId, []);
        }
        this.activeConditions.get(entityId).push(activeCondition);
        return activeCondition;
    }
    /**
     * Remove condition from entity
     */
    removeCondition(entityId, conditionId) {
        const conditions = this.activeConditions.get(entityId);
        if (!conditions)
            return false;
        const index = conditions.findIndex(c => c.id === conditionId);
        if (index === -1)
            return false;
        conditions.splice(index, 1);
        return true;
    }
    /**
     * Get all active conditions for entity
     */
    getActiveConditions(entityId) {
        return this.activeConditions.get(entityId) || [];
    }
    /**
     * Check if entity has specific condition
     */
    hasCondition(entityId, conditionId) {
        const conditions = this.activeConditions.get(entityId);
        return conditions?.some(c => c.id === conditionId) || false;
    }
    /**
     * Process turn-based condition updates
     */
    processTurnStart(entityId) {
        const effects = [];
        const conditions = this.getActiveConditions(entityId);
        for (const condition of conditions) {
            // Process start-of-turn effects
            for (const effect of condition.effects) {
                if (effect.trigger === 'start_turn') {
                    effects.push(effect);
                }
            }
            // Reduce duration
            if (condition.remainingDuration > 0) {
                condition.remainingDuration--;
                if (condition.remainingDuration === 0) {
                    this.removeCondition(entityId, condition.id);
                }
            }
        }
        return effects;
    }
    /**
     * Process end of turn condition updates
     */
    processTurnEnd(entityId) {
        const effects = [];
        const saves = [];
        const conditions = this.getActiveConditions(entityId);
        for (const condition of conditions) {
            // Process end-of-turn effects
            for (const effect of condition.effects) {
                if (effect.trigger === 'end_turn') {
                    effects.push(effect);
                }
            }
            // Check for saves
            if (condition.saveAtEnd && condition.dc && condition.saveAbility) {
                saves.push({
                    condition: condition.id,
                    dc: condition.dc,
                    ability: condition.saveAbility
                });
            }
        }
        return { effects, saves };
    }
    /**
     * Apply condition effect results
     */
    applyConditionEffects(entityId, rollType) {
        const conditions = this.getActiveConditions(entityId);
        let advantage = false;
        let disadvantage = false;
        const modifiers = [];
        let prevented = false;
        for (const condition of conditions) {
            for (const effect of condition.effects) {
                if (this.effectApplies(effect, rollType)) {
                    switch (effect.type) {
                        case 'advantage':
                            advantage = true;
                            break;
                        case 'disadvantage':
                            disadvantage = true;
                            break;
                        case 'ability_modifier':
                        case 'skill_modifier':
                        case 'save_modifier':
                            if (effect.value !== undefined) {
                                modifiers.push(effect.value);
                            }
                            break;
                        case 'prevent_action':
                            prevented = true;
                            break;
                    }
                }
            }
        }
        return { advantage, disadvantage, modifiers, prevented };
    }
    /**
     * Get damage resistances/immunities/vulnerabilities
     */
    getDamageModifications(entityId) {
        const conditions = this.getActiveConditions(entityId);
        const resistances = [];
        const immunities = [];
        const vulnerabilities = [];
        for (const condition of conditions) {
            for (const effect of condition.effects) {
                switch (effect.type) {
                    case 'resistance':
                        resistances.push(effect.target);
                        break;
                    case 'immunity':
                        immunities.push(effect.target);
                        break;
                    case 'vulnerability':
                        vulnerabilities.push(effect.target);
                        break;
                }
            }
        }
        return { resistances, immunities, vulnerabilities };
    }
    effectApplies(effect, rollType) {
        switch (effect.target) {
            case 'all':
            case 'attack_rolls':
            case 'ability_checks':
            case 'saving_throws':
                return rollType.includes(effect.target) || rollType === 'all';
            default:
                return effect.target === rollType;
        }
    }
    /**
     * Clear all conditions from entity
     */
    clearAllConditions(entityId) {
        this.activeConditions.delete(entityId);
    }
    /**
     * Create custom condition
     */
    createCustomCondition(id, name, description, effects, duration = -1) {
        return {
            id,
            name,
            description,
            duration,
            effects
        };
    }
}
// Export singleton instance
export const conditionsEngine = new ConditionsEngine();
// Utility functions
export function applyCondition(entityId, conditionId, duration) {
    return conditionsEngine.applyCondition(entityId, conditionId, duration);
}
export function removeCondition(entityId, conditionId) {
    return conditionsEngine.removeCondition(entityId, conditionId);
}
export function hasCondition(entityId, conditionId) {
    return conditionsEngine.hasCondition(entityId, conditionId);
}
//# sourceMappingURL=index.js.map