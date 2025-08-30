/**
 * D&D 5e Action System for handling combat actions
 */

import { DiceRoller, RollResult } from './DiceRoller';

export type ActionType = 'action' | 'bonus_action' | 'reaction' | 'free_action' | 'movement';

export type DamageType = 
  | 'acid' | 'bludgeoning' | 'cold' | 'fire' | 'force' | 'lightning' 
  | 'necrotic' | 'piercing' | 'poison' | 'psychic' | 'radiant' | 'slashing' | 'thunder';

export interface ActionResource {
  type: ActionType;
  used: boolean;
  reactions?: number; // Some characters can have multiple reactions
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
  criticalRange?: number; // e.g., 20 for normal weapons, 19-20 for improved critical
  range: {
    normal: number;
    long?: number;
  };
  properties: string[]; // e.g., ['finesse', 'light', 'thrown']
  description?: string;
}

export interface SpellAttackAction {
  id: string;
  spellId: string;
  actionType: ActionType;
  attackBonus: number;
  saveDC?: number;
  saveAbility?: 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';
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

export class ActionSystem {
  private diceRoller: DiceRoller;
  private actionResources: Map<string, ActionResource[]> = new Map(); // entityId -> resources
  private availableActions: Map<string, (AttackAction | SpellAttackAction)[]> = new Map();

  constructor(diceRoller?: DiceRoller) {
    this.diceRoller = diceRoller || new DiceRoller();
  }

  /**
   * Initialize action resources for a turn
   */
  initializeTurnResources(entityId: string): void {
    const resources: ActionResource[] = [
      { type: 'action', used: false },
      { type: 'bonus_action', used: false },
      { type: 'reaction', used: false, reactions: 1 },
      { type: 'movement', used: false },
    ];

    this.actionResources.set(entityId, resources);
  }

  /**
   * Check if an action type is available
   */
  canUseAction(entityId: string, actionType: ActionType): boolean {
    const resources = this.actionResources.get(entityId);
    if (!resources) return false;

    const resource = resources.find(r => r.type === actionType);
    return resource ? !resource.used : false;
  }

  /**
   * Use an action resource
   */
  useAction(entityId: string, actionType: ActionType): boolean {
    const resources = this.actionResources.get(entityId);
    if (!resources) return false;

    const resource = resources.find(r => r.type === actionType);
    if (!resource || resource.used) return false;

    resource.used = true;
    return true;
  }

  /**
   * Add an available action for an entity
   */
  addAvailableAction(entityId: string, action: AttackAction | SpellAttackAction): void {
    let actions = this.availableActions.get(entityId);
    if (!actions) {
      actions = [];
      this.availableActions.set(entityId, actions);
    }
    actions.push(action);
  }

  /**
   * Get available actions for an entity
   */
  getAvailableActions(entityId: string): (AttackAction | SpellAttackAction)[] {
    return this.availableActions.get(entityId) || [];
  }

  /**
   * Execute a melee attack
   */
  executeMeleeAttack(
    attackerId: string, 
    targetId: string, 
    action: AttackAction, 
    advantage?: boolean, 
    disadvantage?: boolean
  ): ActionResult {
    if (!this.canUseAction(attackerId, action.actionType)) {
      return {
        success: false,
        rolls: [],
        description: `Cannot use ${action.actionType} - already used this turn`
      };
    }

    // Roll attack
    const attackRoll = this.diceRoller.rollAttack(action.attackBonus, advantage, disadvantage);
    const rolls = [attackRoll];

    // Check for hit (assuming target AC needs to be provided externally)
    // For now, assume hit if roll is 10 or higher
    const isHit = attackRoll.total >= 10;
    const isCritical = this.isCriticalHit(attackRoll, action.criticalRange);

    if (!isHit && !isCritical) {
      this.useAction(attackerId, action.actionType);
      return {
        success: true,
        rolls,
        description: `${action.name} attack missed with ${attackRoll.total}`
      };
    }

    // Roll damage
    const damageRoll = this.diceRoller.rollDamage(action.damage.diceExpression, isCritical);
    rolls.push(damageRoll);

    this.useAction(attackerId, action.actionType);

    return {
      success: true,
      rolls,
      damage: {
        total: damageRoll.total,
        type: action.damage.damageType,
        critical: isCritical
      },
      description: isCritical 
        ? `Critical hit! ${action.name} deals ${damageRoll.total} ${action.damage.damageType} damage`
        : `${action.name} hits for ${damageRoll.total} ${action.damage.damageType} damage`
    };
  }

  /**
   * Execute a ranged attack
   */
  executeRangedAttack(
    attackerId: string,
    targetId: string,
    action: AttackAction,
    distance: number,
    advantage?: boolean,
    disadvantage?: boolean
  ): ActionResult {
    if (!this.canUseAction(attackerId, action.actionType)) {
      return {
        success: false,
        rolls: [],
        description: `Cannot use ${action.actionType} - already used this turn`
      };
    }

    // Check range and apply disadvantage if at long range
    let finalDisadvantage = disadvantage;
    if (action.range.long && distance > action.range.normal && distance <= action.range.long) {
      finalDisadvantage = true;
    } else if (distance > (action.range.long || action.range.normal)) {
      return {
        success: false,
        rolls: [],
        description: `Target is out of range (${distance} ft > ${action.range.long || action.range.normal} ft)`
      };
    }

    return this.executeMeleeAttack(attackerId, targetId, action, advantage, finalDisadvantage);
  }

  /**
   * Execute a saving throw
   */
  executeSavingThrow(
    entityId: string,
    abilityModifier: number,
    dc: number,
    advantage?: boolean,
    disadvantage?: boolean
  ): ActionResult {
    const saveRoll = this.diceRoller.rollSavingThrow(abilityModifier, advantage, disadvantage);
    const success = saveRoll.total >= dc;

    return {
      success,
      rolls: [saveRoll],
      description: success 
        ? `Saving throw succeeded (${saveRoll.total} vs DC ${dc})`
        : `Saving throw failed (${saveRoll.total} vs DC ${dc})`
    };
  }

  /**
   * Execute movement
   */
  executeMovement(entityId: string, movement: MovementAction): ActionResult {
    if (!this.canUseAction(entityId, 'movement')) {
      return {
        success: false,
        rolls: [],
        description: 'No movement remaining this turn'
      };
    }

    // Calculate distance moved
    const distance = Math.sqrt(
      Math.pow(movement.toX - movement.fromX, 2) + 
      Math.pow(movement.toY - movement.fromY, 2)
    ) * 5; // Assuming 5ft per grid square

    this.useAction(entityId, 'movement');

    return {
      success: true,
      rolls: [],
      description: `Moved ${distance} feet`,
      effects: movement.isOpportunityAttackProvoking ? ['provokes_opportunity_attacks'] : []
    };
  }

  /**
   * Execute a dash action (double movement)
   */
  executeDash(entityId: string): ActionResult {
    if (!this.canUseAction(entityId, 'action')) {
      return {
        success: false,
        rolls: [],
        description: 'Cannot dash - action already used'
      };
    }

    this.useAction(entityId, 'action');

    return {
      success: true,
      rolls: [],
      description: 'Movement speed doubled this turn',
      effects: ['doubled_movement']
    };
  }

  /**
   * Execute dodge action
   */
  executeDodge(entityId: string): ActionResult {
    if (!this.canUseAction(entityId, 'action')) {
      return {
        success: false,
        rolls: [],
        description: 'Cannot dodge - action already used'
      };
    }

    this.useAction(entityId, 'action');

    return {
      success: true,
      rolls: [],
      description: 'Taking the Dodge action - attacks against you have disadvantage',
      effects: ['dodge_active']
    };
  }

  /**
   * Execute help action
   */
  executeHelp(entityId: string, targetId: string): ActionResult {
    if (!this.canUseAction(entityId, 'action')) {
      return {
        success: false,
        rolls: [],
        description: 'Cannot help - action already used'
      };
    }

    this.useAction(entityId, 'action');

    return {
      success: true,
      rolls: [],
      description: `Helping ally - their next ability check or attack has advantage`,
      effects: [`help_${targetId}`]
    };
  }

  /**
   * Check if attack roll is a critical hit
   */
  private isCriticalHit(attackRoll: RollResult, criticalRange: number = 20): boolean {
    if (attackRoll.rolls.length === 0) return false;
    const naturalRoll = attackRoll.rolls[0];
    return naturalRoll !== undefined && naturalRoll >= criticalRange;
  }

  /**
   * Reset action resources for a new turn
   */
  resetTurnResources(entityId: string): void {
    this.initializeTurnResources(entityId);
  }

  /**
   * Get current action resources
   */
  getActionResources(entityId: string): ActionResource[] {
    return this.actionResources.get(entityId) || [];
  }

  /**
   * Check if entity has used specific action type
   */
  hasUsedAction(entityId: string, actionType: ActionType): boolean {
    const resources = this.actionResources.get(entityId);
    if (!resources) return false;

    const resource = resources.find(r => r.type === actionType);
    return resource ? resource.used : false;
  }
}
