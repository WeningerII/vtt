/**
 * Conditions component for tracking status effects
 */
export type ConditionType =
  | "blinded"
  | "charmed"
  | "deafened"
  | "frightened"
  | "grappled"
  | "incapacitated"
  | "invisible"
  | "paralyzed"
  | "petrified"
  | "poisoned"
  | "prone"
  | "restrained"
  | "stunned"
  | "unconscious"
  | "exhaustion"
  | "concentration"
  | "blessed"
  | "cursed"
  | "hasted"
  | "slowed";
export interface Condition {
  type: ConditionType;
  duration: number;
  source?: string;
  saveEndOfTurn?: {
    ability: "strength" | "dexterity" | "constitution" | "intelligence" | "wisdom" | "charisma";
    dc: number;
  };
}
export declare class ConditionsStore {
  private capacity;
  private count;
  private entities;
  private conditions;
  constructor(capacity?: number);
  add(entity: number, condition: Condition): void;
  remove(entity: number, conditionType?: ConditionType): void;
  has(entity: number, conditionType?: ConditionType): boolean;
  get(entity: number): Condition[];
  getCondition(entity: number, conditionType: ConditionType): Condition | null;
  updateDurations(): void;
  isIncapacitated(entity: number): boolean;
  canAct(entity: number): boolean;
  canMove(entity: number): boolean;
  canSee(entity: number): boolean;
  canHear(entity: number): boolean;
  hasAdvantageOnAttacks(entity: number): boolean;
  hasDisadvantageOnAttacks(entity: number): boolean;
  getExhaustionLevel(entity: number): number;
  applyCondition(
    entity: number,
    condition: Condition,
    immunities?: ConditionType[],
    resistances?: ConditionType[],
  ): boolean;
  private findEntityIndex;
  getEntities(): number[];
  forEach(_callback: (entity: number, _conditions: Condition[]) => void): void;
  size(): number;
}
//# sourceMappingURL=Conditions.d.ts.map
