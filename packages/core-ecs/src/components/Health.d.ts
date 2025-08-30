/**
 * Health component for tracking hit points and damage
 */
export interface HealthData {
  current: number;
  max: number;
  temporary: number;
}
export declare class HealthStore {
  private capacity;
  private count;
  private entities;
  private current;
  private max;
  private temporary;
  constructor(capacity?: number);
  add(entity: number, data: HealthData): void;
  remove(entity: number): void;
  has(entity: number): boolean;
  get(entity: number): HealthData | null;
  set(entity: number, data: Partial<HealthData>): void;
  takeDamage(entity: number, damage: number): boolean;
  heal(entity: number, healing: number): boolean;
  setMaxHP(entityId: number, maxHP: number): void;
  isDead(entity: number): boolean;
  getHealthPercentage(entity: number): number;
  private findIndex;
  getEntities(): number[];
  forEach(_callback: (entity: number, _health: HealthData) => void): void;
  size(): number;
}
//# sourceMappingURL=Health.d.ts.map
