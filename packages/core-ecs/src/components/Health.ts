/**
 * Health component for tracking hit points and damage
 */

export interface HealthData {
  current: number;
  max: number;
  temporary: number;
}

export class HealthStore {
  private capacity: number;
  private count = 0;
  private entities: Uint32Array;
  private current: Float32Array;
  private max: Float32Array;
  private temporary: Float32Array;

  constructor(capacity = 1000) {
    this.capacity = capacity;
    this.entities = new Uint32Array(capacity);
    this.current = new Float32Array(capacity);
    this.max = new Float32Array(capacity);
    this.temporary = new Float32Array(capacity);
  }

  add(entity: number, data: HealthData): void {
    if (this.count >= this.capacity) {
      throw new Error('HealthStore capacity exceeded');
    }

    const index = this.count++;
    this.entities[index] = entity;
    this.current[index] = data.current;
    this.max[index] = data.max;
    this.temporary[index] = data.temporary;
  }

  remove(entity: number): void {
    const index = this.findIndex(entity);
    if (index === -1) return;

    // Move last element to this position
    const lastIndex = this.count - 1;
    if (index !== lastIndex) {
      this.entities[index] = this.entities[lastIndex] || 0;
      this.current[index] = this.current[lastIndex] || 0;
      this.max[index] = this.max[lastIndex] || 0;
      this.temporary[index] = this.temporary[lastIndex] || 0;
    }
    this.count--;
  }

  has(entity: number): boolean {
    return this.findIndex(entity) !== -1;
  }

  get(entity: number): HealthData | null {
    const index = this.findIndex(entity);
    if (index === -1) return null;

    return {
      current: this.current[index] || 0,
      max: this.max[index] || 0,
      temporary: this.temporary[index] || 0,
    };
  }

  set(entity: number, data: Partial<HealthData>): void {
    const index = this.findIndex(entity);
    if (index === -1) return;

    if (data.current !== undefined) this.current[index] = data.current;
    if (data.max !== undefined) this.max[index] = data.max;
    if (data.temporary !== undefined) this.temporary[index] = data.temporary;
  }

  takeDamage(entity: number, damage: number): boolean {
    const index = this.findIndex(entity);
    if (index === -1) return false;

    // Apply temporary hit points first
    const tempHP = this.temporary[index] || 0;
    if (tempHP > 0) {
      const tempDamage = Math.min(damage, tempHP);
      this.temporary[index] = tempHP - tempDamage;
      damage -= tempDamage;
    }

    // Apply remaining damage to current hit points
    const currentHP = this.current[index] || 0;
    this.current[index] = Math.max(0, currentHP - damage);
    return true;
  }

  heal(entity: number, healing: number): boolean {
    const index = this.findIndex(entity);
    if (index === -1) return false;

    const currentHP = this.current[index] || 0;
    const maxHP = this.max[index] || 0;
    this.current[index] = Math.min(maxHP, currentHP + healing);
    return true;
  }

  setMaxHP(entityId: number, maxHP: number): void {
    const index = this.findIndex(entityId);
    if (index !== -1) {
      this.max[index] = maxHP;
      this.current[index] = maxHP;
      this.temporary[index] = 0;
    }
  }

  isDead(entity: number): boolean {
    const index = this.findIndex(entity);
    if (index === -1) return false;
    return (this.current[index] || 0) <= 0;
  }

  getHealthPercentage(entity: number): number {
    const index = this.findIndex(entity);
    if (index === -1) return 0;
    const current = this.current[index] || 0;
    const max = this.max[index] || 1;
    return current / max;
  }

  private findIndex(entity: number): number {
    for (let i = 0; i < this.count; i++) {
      if (this.entities[i] === entity) return i;
    }
    return -1;
  }

  // Iterator methods
  getEntities(): number[] {
    return Array.from(this.entities.slice(0, this.count));
  }

  forEach(_callback: (entity: number, _health: HealthData) => void): void {
    for (let i = 0; i < this.count; i++) {
      const entity = this.entities[i];
      if (entity !== undefined) {
        callback(entity, {
          current: this.current[i] || 0,
          max: this.max[i] || 0,
          temporary: this.temporary[i] || 0,
        });
      }
    }
  }

  size(): number {
    return this.count;
  }
}
