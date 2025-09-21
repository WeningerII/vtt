import { Monster, MonsterSchema, ChallengeRating } from "@vtt/core-schemas";
import { EventEmitter } from "events";

// Export additional systems
export { DiceRoller, _diceRoller as diceRoller } from "./DiceRoller";
export { SpellSystem } from "./SpellSystem";
export { ActionSystem } from "./ActionSystem";
export type { DiceRoll, RollResult } from "./DiceRoller";
export type { Spell, SpellSlot, SchoolOfMagic, SpellcastingAbility } from "./SpellSystem";
export type { AttackAction, ActionResult, ActionType, DamageType } from "./ActionSystem";

export type CompiledMonster = Monster & {
  xp: number;
  proficiencyBonus: number;
  passivePerception: number;
};

export function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

export const CR_XP_MAP: Record<ChallengeRating, number> = {
  "0": 10,
  "1/8": 25,
  "1/4": 50,
  "1/2": 100,
  "1": 200,
  "2": 450,
  "3": 700,
  "4": 1100,
  "5": 1800,
  "6": 2300,
  "7": 2900,
  "8": 3900,
  "9": 5000,
  "10": 5900,
  "11": 7200,
  "12": 8400,
  "13": 10000,
  "14": 11500,
  "15": 13000,
  "16": 15000,
  "17": 18000,
  "18": 20000,
  "19": 22000,
  "20": 25000,
  "21": 33000,
  "22": 41000,
  "23": 50000,
  "24": 62000,
  "25": 75000,
  "26": 90000,
  "27": 105000,
  "28": 120000,
  "29": 135000,
  "30": 155000,
};

export function crToProficiency(cr: ChallengeRating): number {
  // Typical MM guidance for proficiency by CR bands
  switch (cr) {
    case "0":
    case "1/8":
    case "1/4":
    case "1/2":
    case "1":
    case "2":
    case "3":
    case "4":
      return 2;
    case "5":
    case "6":
    case "7":
    case "8":
      return 3;
    case "9":
    case "10":
    case "11":
    case "12":
      return 4;
    case "13":
    case "14":
    case "15":
    case "16":
      return 5;
    case "17":
    case "18":
    case "19":
    case "20":
      return 6;
    case "21":
    case "22":
    case "23":
    case "24":
      return 7;
    case "25":
    case "26":
    case "27":
    case "28":
      return 8;
    case "29":
    case "30":
      return 9;
    default:
      // Fallback for any unhandled CR values
      return 2;
  }
}

export function compileMonster(mon: Monster): CompiledMonster {
  // Validate upfront
  const parsed = MonsterSchema.parse(mon);

  const xp = parsed.xp ?? CR_XP_MAP[parsed.challengeRating];
  const proficiencyBonus = parsed.proficiencyBonus ?? crToProficiency(parsed.challengeRating);

  // Passive Perception: prefer explicit, else 10 + skill bonus if present, else 10 + WIS mod
  const explicitPassive = parsed.passivePerception;
  const skillPerception = parsed.skills?.PERCEPTION;
  const wisMod = abilityMod(parsed.abilities.WIS);
  const passivePerception =
    explicitPassive ?? (skillPerception != null ? 10 + skillPerception : 10 + wisMod);

  return {
    ...parsed,
    xp,
    proficiencyBonus,
    passivePerception,
  };
}

export function compileMonsters(list: Monster[]): CompiledMonster[] {
  return list.map(compileMonster);
}

// Combat system types and classes
export interface Combatant {
  id: string;
  name: string;
  initiative: number;
  hitPoints: number;
  maxHitPoints: number;
  armorClass: number;
  isPlayer: boolean;
}

export class CombatEngine extends EventEmitter {
  private combatants: Combatant[] = [];
  private turnOrder: string[] = [];
  private currentTurnIndex = 0;
  private currentRound = 1;
  private isActive = false;

  constructor() {
    super();
  }

  addCombatant(combatant: Combatant): void {
    this.combatants.push(combatant);
    this.sortInitiative();
  }

  removeCombatant(id: string): void {
    this.combatants = this.combatants.filter((c) => c.id !== id);
    this.turnOrder = this.turnOrder.filter((id) => id !== id);
  }

  startCombat(): void {
    this.isActive = true;
    this.currentRound = 1;
    this.currentTurnIndex = 0;
    this.sortInitiative();
  }

  endCombat(): void {
    this.isActive = false;
    this.currentRound = 1;
    this.currentTurnIndex = 0;
  }

  nextTurn(): void {
    if (!this.isActive) {
      return;
    }

    this.currentTurnIndex++;
    if (this.currentTurnIndex >= this.turnOrder.length) {
      this.currentTurnIndex = 0;
      this.currentRound++;
    }
  }

  getCurrentCombatant(): Combatant | null {
    if (!this.isActive || this.turnOrder.length === 0) {
      return null;
    }
    const id = this.turnOrder[this.currentTurnIndex];
    return this.combatants.find((c) => c.id === id) || null;
  }

  getCombatants(): Combatant[] {
    return [...this.combatants];
  }

  getTurnOrder(): string[] {
    return [...this.turnOrder];
  }

  getCurrentRound(): number {
    return this.currentRound;
  }

  isInCombat(): boolean {
    return this.isActive;
  }

  executeAction(_action: unknown): void {
    // Placeholder for action execution
  }

  private sortInitiative(): void {
    this.combatants.sort((a, b) => b.initiative - a.initiative);
    this.turnOrder = this.combatants.map((c) => c.id);
  }
}
