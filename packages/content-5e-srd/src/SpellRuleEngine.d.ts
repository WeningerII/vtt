/**
 * Spell Rule Engine - Computational D&D 5e Rules Implementation
 * Every D&D rule is implemented as executable algorithms
 */
import { GameEntity, ComputationalSpell, Vector3D } from "./ComputationalSpellSystem";
export interface Rule {
  id: string;
  condition: (_ctx: RuleContext) => boolean;
  action: (_ctx: RuleContext) => RuleResult;
  priority: number;
}
export interface RuleContext {
  spell: ComputationalSpell;
  caster: GameEntity;
  targets: GameEntity[];
  environment: {
    entities: Map<string, GameEntity>;
    obstacles: any[];
    lighting: number;
    temperature: number;
    gravity?: Vector3D;
  };
  dice: (_sides: number, _count?: number) => number[];
  time: number;
  gameState: GameState;
  eventType: "pre_cast" | "post_cast" | "damage" | "healing" | "condition" | "movement";
  metadata: Record<string, any>;
}
export interface RuleResult {
  type: "modify" | "prevent" | "trigger" | "log";
  data: any;
  continue: boolean;
}
export interface GameState {
  round: number;
  turn: number;
  time: number;
  weather: string;
  lighting: number;
  gravity: number;
  magicLevel: number;
  antimagicFields: Array<{
    center: {
      x: number;
      y: number;
      z: number;
    };
    radius: number;
  }>;
}
export declare class SpellRuleEngine {
  private rules;
  addRule(rule: Rule): void;
  removeRule(ruleId: string): void;
  executeRules(ruleContext: RuleContext): RuleResult[];
  private applyRuleResult;
  validateSpellCast(
    spell: ComputationalSpell,
    caster: GameEntity,
    targets: GameEntity[],
    gameState: GameState,
  ): {
    valid: boolean;
    reasons: string[];
    modifications: Record<string, any>;
  };
}
export declare class SpellInteractionCalculator {
  calculateSpellInteraction(
    activeSpells: ComputationalSpell[],
    newSpell: ComputationalSpell,
  ): {
    conflicts: Array<{
      spellId: string;
      reason: string;
      resolution: string;
    }>;
    synergies: Array<{
      spellId: string;
      effect: string;
      modifier: number;
    }>;
    dispels: string[];
  };
  private spellsConflict;
  private calculateSynergy;
  private spellDispelsAnother;
  private matchesSpellPattern;
}
export declare const spellRuleEngine: SpellRuleEngine;
export declare const spellInteractionCalculator: SpellInteractionCalculator;
//# sourceMappingURL=SpellRuleEngine.d.ts.map
