/**
 * Conditions component for tracking status effects
 */
export class ConditionsStore {
    constructor(capacity = 1000) {
        this.count = 0;
        this.capacity = capacity;
        this.entities = new Uint32Array(capacity);
        this.conditions = new Map();
    }
    add(entity, condition) {
        if (!this.conditions.has(entity)) {
            if (this.count >= this.capacity) {
                throw new Error('ConditionsStore capacity exceeded');
            }
            this.entities[this.count++] = entity;
            this.conditions.set(entity, []);
        }
        const entityConditions = this.conditions.get(entity);
        // Check if condition already exists
        const existingIndex = entityConditions.findIndex(c => c.type === condition.type);
        if (existingIndex !== -1) {
            // Update existing condition (take longer duration)
            const existing = entityConditions[existingIndex];
            if (existing && condition.duration > existing.duration) {
                entityConditions[existingIndex] = condition;
            }
        }
        else {
            entityConditions.push(condition);
        }
    }
    remove(entity, conditionType) {
        const entityConditions = this.conditions.get(entity);
        if (!entityConditions)
            return;
        if (conditionType) {
            // Remove specific condition
            const index = entityConditions.findIndex(c => c.type === conditionType);
            if (index !== -1) {
                entityConditions.splice(index, 1);
            }
        }
        else {
            // Remove all conditions
            this.conditions.delete(entity);
            const entityIndex = this.findEntityIndex(entity);
            if (entityIndex !== -1) {
                const lastIndex = this.count - 1;
                if (entityIndex !== lastIndex) {
                    this.entities[entityIndex] = this.entities[lastIndex];
                }
                this.count--;
            }
        }
        // Clean up if no conditions remain
        if (entityConditions.length === 0) {
            this.conditions.delete(entity);
            const entityIndex = this.findEntityIndex(entity);
            if (entityIndex !== -1) {
                const lastIndex = this.count - 1;
                if (entityIndex !== lastIndex) {
                    this.entities[entityIndex] = this.entities[lastIndex];
                }
                this.count--;
            }
        }
    }
    has(entity, conditionType) {
        const entityConditions = this.conditions.get(entity);
        if (!entityConditions)
            return false;
        if (conditionType) {
            return entityConditions.some(c => c.type === conditionType);
        }
        return entityConditions.length > 0;
    }
    get(entity) {
        return this.conditions.get(entity) || [];
    }
    getCondition(entity, conditionType) {
        const entityConditions = this.conditions.get(entity);
        if (!entityConditions)
            return null;
        return entityConditions.find(c => c.type === conditionType) || null;
    }
    updateDurations() {
        for (const [entity, conditions] of this.conditions) {
            for (let i = conditions.length - 1; i >= 0; i--) {
                const condition = conditions[i];
                if (condition && condition.duration > 0) {
                    condition.duration--;
                    if (condition.duration === 0) {
                        conditions.splice(i, 1);
                    }
                }
            }
            // Clean up entities with no conditions
            if (conditions.length === 0) {
                this.conditions.delete(entity);
                const entityIndex = this.findEntityIndex(entity);
                if (entityIndex !== -1) {
                    const lastIndex = this.count - 1;
                    if (entityIndex !== lastIndex) {
                        this.entities[entityIndex] = this.entities[lastIndex];
                    }
                    this.count--;
                }
            }
        }
    }
    // Check if entity is affected by specific condition effects
    isIncapacitated(entity) {
        return this.has(entity, 'incapacitated') ||
            this.has(entity, 'paralyzed') ||
            this.has(entity, 'petrified') ||
            this.has(entity, 'stunned') ||
            this.has(entity, 'unconscious');
    }
    canAct(entity) {
        return !this.isIncapacitated(entity);
    }
    canMove(entity) {
        return !this.has(entity, 'paralyzed') &&
            !this.has(entity, 'petrified') &&
            !this.has(entity, 'stunned') &&
            !this.has(entity, 'unconscious') &&
            !this.has(entity, 'grappled') &&
            !this.has(entity, 'restrained');
    }
    canSee(entity) {
        return !this.has(entity, 'blinded') &&
            !this.has(entity, 'unconscious');
    }
    canHear(entity) {
        return !this.has(entity, 'deafened') &&
            !this.has(entity, 'unconscious');
    }
    hasAdvantageOnAttacks(entity) {
        return this.has(entity, 'invisible') || this.has(entity, 'blessed');
    }
    hasDisadvantageOnAttacks(entity) {
        return this.has(entity, 'blinded') ||
            this.has(entity, 'frightened') ||
            this.has(entity, 'poisoned') ||
            this.has(entity, 'prone');
    }
    getExhaustionLevel(entity) {
        const exhaustion = this.getCondition(entity, 'exhaustion');
        return exhaustion?.duration || 0;
    }
    // Apply condition immunity/resistance based on creature type
    applyCondition(entity, condition, immunities = [], resistances = []) {
        if (immunities.includes(condition.type)) {
            return false; // Immune to this condition
        }
        if (resistances.includes(condition.type)) {
            // Halve duration for resistance
            condition.duration = Math.floor(condition.duration / 2);
        }
        this.add(entity, condition);
        return true;
    }
    findEntityIndex(entity) {
        for (let i = 0; i < this.count; i++) {
            if (this.entities[i] === entity)
                return i;
        }
        return -1;
    }
    getEntities() {
        return Array.from(this.entities.slice(0, this.count));
    }
    forEach(callback) {
        for (const [entity, conditions] of this.conditions) {
            callback(entity, conditions);
        }
    }
    size() {
        return this.count;
    }
}
//# sourceMappingURL=Conditions.js.map