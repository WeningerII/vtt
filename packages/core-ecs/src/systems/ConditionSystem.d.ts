/**
 * Condition system for managing status effects and their interactions
 */
import { ConditionsStore } from "../components/Conditions";
import { StatsStore } from "../components/Stats";
export interface ConditionEffect {
  entity: number;
  conditionType: string;
  effect: "advantage" | "disadvantage" | "modifier" | "immunity" | "resistance";
  target: "attack" | "save" | "skill" | "damage" | "speed";
  value?: number;
}
export declare class ConditionSystem {
  private conditionsStore;
  private statsStore;
  private eventHandlers;
  constructor(conditionsStore: ConditionsStore, statsStore: StatsStore);
  update(deltaTime: number): void;
  private processConditionDurations;
  private processSavingThrows;
  getAttackModifiers(entity: number): {
    advantage: boolean;
    disadvantage: boolean;
    modifier: number;
  };
  getSavingThrowModifiers(
    entity: number,
    ability: string,
  ): {
    advantage: boolean;
    disadvantage: boolean;
    modifier: number;
  };
  getSpeedModifier(entity: number): number;
  getDamageResistances(entity: number): string[];
  getDamageImmunities(entity: number): string[];
  canTakeActions(entity: number): boolean;
  canMove(entity: number): boolean;
  canSee(entity: number): boolean;
  canHear(entity: number): boolean;
  canConcentrate(entity: number): boolean;
  makeConcentrationCheck(entity: number, damage: number): boolean;
  private rollD20;
  on(event: string, handler: (...args: any[]) => any): void;
  off(event: string, handler: (...args: any[]) => any): void;
  private emit;
}
//# sourceMappingURL=ConditionSystem.d.ts.map
