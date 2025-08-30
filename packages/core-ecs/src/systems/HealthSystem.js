/**
 * Health system for managing damage, healing, and death
 */
export class HealthSystem {
    constructor(healthStore, conditionsStore) {
        this.eventHandlers = new Map();
        this.healthStore = healthStore;
        this.conditionsStore = conditionsStore;
    }
    update(deltaTime) {
        // Process regeneration and damage over time
        this.healthStore.forEach((entity, health) => {
            this.processRegeneration(entity, deltaTime);
            this.processDamageOverTime(entity, deltaTime);
        });
    }
    applyDamage(event) {
        const { entity, damage, damageType, source } = event;
        if (!this.healthStore.has(entity))
            return;
        const health = this.healthStore.get(entity);
        if (!health)
            return;
        const originalHP = health.current;
        const success = this.healthStore.takeDamage(entity, damage);
        if (success) {
            const newHealth = this.healthStore.get(entity);
            const actualDamage = originalHP - (newHealth?.current || 0);
            this.emit('damageApplied', {
                entity,
                damage: actualDamage,
                damageType,
                source,
                newHealth: newHealth?.current || 0,
            });
            // Check for death or unconsciousness
            if (this.healthStore.isDead(entity)) {
                this.handleDeath(entity);
            }
        }
    }
    applyHealing(event) {
        const { entity, healing, source } = event;
        if (!this.healthStore.has(entity))
            return;
        const health = this.healthStore.get(entity);
        if (!health)
            return;
        const originalHP = health.current;
        const success = this.healthStore.heal(entity, healing);
        if (success) {
            const newHealth = this.healthStore.get(entity);
            const actualHealing = (newHealth?.current || 0) - originalHP;
            this.emit('healingApplied', {
                entity,
                healing: actualHealing,
                source,
                newHealth: newHealth?.current || 0,
            });
            // Remove unconscious condition if healed above 0
            if (originalHP <= 0 && (newHealth?.current || 0) > 0) {
                this.conditionsStore.remove(entity, 'unconscious');
                this.emit('entityRevived', { entity });
            }
        }
    }
    setTemporaryHitPoints(entity, tempHP) {
        if (!this.healthStore.has(entity))
            return;
        const health = this.healthStore.get(entity);
        if (!health)
            return;
        // Temporary hit points don't stack, take the higher value
        const newTempHP = Math.max(health.temporary, tempHP);
        this.healthStore.set(entity, { temporary: newTempHP });
        this.emit('temporaryHitPointsChanged', {
            entity,
            tempHP: newTempHP,
        });
    }
    handleDeath(entity) {
        // Add unconscious condition
        this.conditionsStore.add(entity, {
            type: 'unconscious',
            duration: -1, // Permanent until healed
            source: 'death',
        });
        this.emit('entityDied', { entity });
    }
    processRegeneration(entity, deltaTime) {
        // Check for regeneration conditions or abilities
        const conditions = this.conditionsStore.get(entity);
        const regenCondition = conditions.find(c => c.type === 'blessed'); // Example
        if (regenCondition) {
            // Apply small amount of healing over time
            const regenAmount = Math.floor(deltaTime * 0.1); // 0.1 HP per second
            if (regenAmount > 0) {
                this.applyHealing({ entity, healing: regenAmount });
            }
        }
    }
    processDamageOverTime(entity, deltaTime) {
        const conditions = this.conditionsStore.get(entity);
        for (const condition of conditions) {
            if (condition.type === 'poisoned') {
                // Apply poison damage over time
                const poisonDamage = Math.floor(deltaTime * 0.2); // 0.2 damage per second
                if (poisonDamage > 0) {
                    this.applyDamage({
                        entity,
                        damage: poisonDamage,
                        damageType: 'poison',
                    });
                }
            }
        }
    }
    // Utility methods
    isAlive(entity) {
        return this.healthStore.has(entity) && !this.healthStore.isDead(entity);
    }
    isUnconscious(entity) {
        return this.conditionsStore.has(entity, 'unconscious');
    }
    getHealthPercentage(entity) {
        return this.healthStore.getHealthPercentage(entity);
    }
    getHealthStatus(entity) {
        if (!this.healthStore.has(entity))
            return 'dead';
        if (this.isUnconscious(entity))
            return 'unconscious';
        if (this.healthStore.isDead(entity))
            return 'dead';
        const percentage = this.getHealthPercentage(entity);
        if (percentage >= 0.75)
            return 'healthy';
        if (percentage >= 0.5)
            return 'injured';
        if (percentage >= 0.25)
            return 'bloodied';
        return 'critical';
    }
    // Event system
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
    }
    off(event, handler) {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }
    emit(event, data) {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            handlers.forEach(handler => handler(data));
        }
    }
}
//# sourceMappingURL=HealthSystem.js.map