/**
 * Health system for managing damage, healing, and death
 */
import { HealthStore } from '../components/Health';
import { ConditionsStore } from '../components/Conditions';
export interface DamageEvent {
    entity: number;
    damage: number;
    damageType: string;
    source?: number;
}
export interface HealingEvent {
    entity: number;
    healing: number;
    source?: number;
}
export declare class HealthSystem {
    private healthStore;
    private conditionsStore;
    private eventHandlers;
    constructor(healthStore: HealthStore, conditionsStore: ConditionsStore);
    update(deltaTime: number): void;
    applyDamage(event: DamageEvent): void;
    applyHealing(event: HealingEvent): void;
    setTemporaryHitPoints(entity: number, tempHP: number): void;
    private handleDeath;
    private processRegeneration;
    private processDamageOverTime;
    isAlive(entity: number): boolean;
    isUnconscious(entity: number): boolean;
    getHealthPercentage(entity: number): number;
    getHealthStatus(entity: number): 'healthy' | 'injured' | 'bloodied' | 'critical' | 'unconscious' | 'dead';
    on(event: string, handler: (...args: any[]) => any): void;
    off(event: string, handler: (...args: any[]) => any): void;
    private emit;
}
//# sourceMappingURL=HealthSystem.d.ts.map