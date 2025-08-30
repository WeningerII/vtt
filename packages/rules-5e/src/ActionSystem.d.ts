/**
 * D&D 5e Action System for handling combat actions
 */
import { DiceRoller, RollResult } from "./DiceRoller";
export type ActionType = "action" | "bonus_action" | "reaction" | "free_action" | "movement";
export type DamageType =
  | "acid"
  | "bludgeoning"
  | "cold"
  | "fire"
  | "force"
  | "lightning"
  | "necrotic"
  | "piercing"
  | "poison"
  | "psychic"
  | "radiant"
  | "slashing"
  | "thunder";
export interface ActionResource {
  type: ActionType;
  used: boolean;
  reactions?: number;
}
export interface AttackAction {
  id: string;
  name: string;
  actionType: ActionType;
  attackBonus: number;
  damage: {
    diceExpression: string;
    damageType: DamageType;
  };
  criticalRange?: number;
  range: {
    normal: number;
    long?: number;
  };
  properties: string[];
  description?: string;
}
export interface SpellAttackAction {
  id: string;
  spellId: string;
  actionType: ActionType;
  attackBonus: number;
  saveDC?: number;
  saveAbility?: "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA";
}
export interface MovementAction {
  entityId: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  movementUsed: number;
  isOpportunityAttackProvoking?: boolean;
}
export interface ActionResult {
  success: boolean;
  rolls: RollResult[];
  damage?: {
    total: number;
    type: DamageType;
    critical: boolean;
  };
  healing?: {
    total: number;
  };
  effects?: string[];
  description: string;
}
export declare class ActionSystem {
  private diceRoller;
  private actionResources;
  private availableActions;
  constructor(diceRoller?: DiceRoller);
  /**
   * Initialize action resources for a turn
   */
  initializeTurnResources(entityId: string): void;
  /**
   * Check if an action type is available
   */
  canUseAction(entityId: string, actionType: ActionType): boolean;
  /**
   * Use an action resource
   */
  useAction(entityId: string, actionType: ActionType): boolean;
  /**
   * Add an available action for an entity
   */
  addAvailableAction(entityId: string, action: AttackAction | SpellAttackAction): void;
  /**
   * Get available actions for an entity
   */
  getAvailableActions(entityId: string): (AttackAction | SpellAttackAction)[];
  /**
   * Execute a melee attack
   */
  executeMeleeAttack(
    attackerId: string,
    targetId: string,
    action: AttackAction,
    advantage?: boolean,
    disadvantage?: boolean,
  ): ActionResult;
  /**
   * Execute a ranged attack
   */
  executeRangedAttack(
    attackerId: string,
    targetId: string,
    action: AttackAction,
    distance: number,
    advantage?: boolean,
    disadvantage?: boolean,
  ): ActionResult;
  /**
   * Execute a saving throw
   */
  executeSavingThrow(
    entityId: string,
    abilityModifier: number,
    dc: number,
    advantage?: boolean,
    disadvantage?: boolean,
  ): ActionResult;
  /**
   * Execute movement
   */
  executeMovement(entityId: string, movement: MovementAction): ActionResult;
  /**
   * Execute a dash action (double movement)
   */
  executeDash(entityId: string): ActionResult;
  /**
   * Execute dodge action
   */
  executeDodge(entityId: string): ActionResult;
  /**
   * Execute help action
   */
  executeHelp(entityId: string, targetId: string): ActionResult;
  /**
   * Check if attack roll is a critical hit
   */
  private isCriticalHit;
  /**
   * Reset action resources for a new turn
   */
  resetTurnResources(entityId: string): void;
  /**
   * Get current action resources
   */
  getActionResources(entityId: string): ActionResource[];
  /**
   * Check if entity has used specific action type
   */
  hasUsedAction(entityId: string, actionType: ActionType): boolean;
}
//# sourceMappingURL=ActionSystem.d.ts.map
