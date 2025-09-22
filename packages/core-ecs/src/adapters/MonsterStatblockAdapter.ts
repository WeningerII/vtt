/**
 * Monster Statblock Adapter - Converts D&D 5e monster statblocks to ECS components
 */

import { ConditionType } from "../components/Conditions";

export interface SRDMonster {
  name: string;
  size?: string;
  type?: string;
  alignment?: string;
  armor_class?: number;
  hit_points?: number;
  speed?: Record<string, number>;
  strength?: number;
  dexterity?: number;
  constitution?: number;
  intelligence?: number;
  wisdom?: number;
  charisma?: number;
  skills?: Record<string, number>;
  saving_throws?: Record<string, number>;
  damage_resistances?: string[];
  damage_immunities?: string[];
  damage_vulnerabilities?: string[];
  condition_immunities?: string[];
  senses?: Record<string, number>;
  languages?: string[];
  challenge_rating?: number | string;
  proficiency_bonus?: number;
  actions?: Action[];
  bonus_actions?: Action[];
  reactions?: Action[];
  legendary_actions?: LegendaryAction[];
  spellcasting?: Spellcasting;
}

export interface D5eStatblock {
  name: string;
  size: string;
  type: string;
  alignment: string;
  armorClass: number | { value: number; type?: string };
  hitPoints: number | { value: number; formula?: string };
  speed: Record<string, number>;
  abilities: {
    STR: number;
    DEX: number;
    CON: number;
    INT: number;
    WIS: number;
    CHA: number;
  };
  skills?: Record<string, number>;
  savingThrows?: Record<string, number>;
  damageResistances?: string[];
  damageImmunities?: string[];
  damageVulnerabilities?: string[];
  conditionImmunities?: string[];
  senses?: Record<string, number>;
  languages?: string[];
  challengeRating: number | string;
  proficiencyBonus?: number;
  actions?: Action[];
  bonusActions?: Action[];
  reactions?: Action[];
  legendaryActions?: LegendaryAction[];
  spellcasting?: Spellcasting;
}

export interface Action {
  name: string;
  description: string;
  attackBonus?: number;
  damage?: {
    diceExpression: string;
    damageType: string;
    versatile?: string;
  };
  saveDC?: number;
  saveAbility?: string;
  range?: number;
  targets?: number;
  recharge?: number | string;
  uses?: number;
}

export interface LegendaryAction {
  name: string;
  description: string;
  cost: number;
}

export interface Spellcasting {
  level: number;
  ability: string;
  saveDC: number;
  attackBonus: number;
  slots?: Record<string, number>;
  spells: Record<string, string[]>;
}

export interface ECSMonsterData {
  name: string;
  health: {
    current: number;
    max: number;
    temporary: number;
  };
  stats: {
    STR: { value: number; modifier: number };
    DEX: { value: number; modifier: number };
    CON: { value: number; modifier: number };
    INT: { value: number; modifier: number };
    WIS: { value: number; modifier: number };
    CHA: { value: number; modifier: number };
  };
  armorClass: number;
  speed: number;
  proficiencyBonus: number;
  challengeRating: number;
  conditionImmunities: ConditionType[];
  actions: Action[];
  bonusActions: Action[];
  reactions: Action[];
  legendaryActions: LegendaryAction[];
  spellcasting?: Spellcasting;
  traits: {
    damageResistances: string[];
    damageImmunities: string[];
    damageVulnerabilities: string[];
    senses: Record<string, number>;
    languages: string[];
  };
}

export class MonsterStatblockAdapter {
  /**
   * Convert a D&D 5e statblock to ECS-compatible data
   */
  static convertToECS(statblock: D5eStatblock): ECSMonsterData {
    const hitPoints = this.extractHitPoints(statblock.hitPoints);
    const armorClass = this.extractArmorClass(statblock.armorClass);
    const challengeRating = this.extractChallengeRating(statblock.challengeRating);
    const proficiencyBonus =
      statblock.proficiencyBonus || this.calculateProficiencyBonus(challengeRating);

    return {
      name: statblock.name,
      health: {
        current: hitPoints,
        max: hitPoints,
        temporary: 0,
      },
      stats: {
        STR: {
          value: statblock.abilities.STR,
          modifier: Math.floor((statblock.abilities.STR - 10) / 2),
        },
        DEX: {
          value: statblock.abilities.DEX,
          modifier: Math.floor((statblock.abilities.DEX - 10) / 2),
        },
        CON: {
          value: statblock.abilities.CON,
          modifier: Math.floor((statblock.abilities.CON - 10) / 2),
        },
        INT: {
          value: statblock.abilities.INT,
          modifier: Math.floor((statblock.abilities.INT - 10) / 2),
        },
        WIS: {
          value: statblock.abilities.WIS,
          modifier: Math.floor((statblock.abilities.WIS - 10) / 2),
        },
        CHA: {
          value: statblock.abilities.CHA,
          modifier: Math.floor((statblock.abilities.CHA - 10) / 2),
        },
      },
      armorClass,
      speed: statblock.speed.walk || 30,
      proficiencyBonus,
      challengeRating,
      conditionImmunities: this.convertConditionImmunities(statblock.conditionImmunities || []),
      actions: statblock.actions || [],
      bonusActions: statblock.bonusActions || [],
      reactions: statblock.reactions || [],
      legendaryActions: statblock.legendaryActions || [],
      ...(statblock.spellcasting && { spellcasting: statblock.spellcasting }),
      traits: {
        damageResistances: statblock.damageResistances || [],
        damageImmunities: statblock.damageImmunities || [],
        damageVulnerabilities: statblock.damageVulnerabilities || [],
        senses: statblock.senses || {},
        languages: statblock.languages || [],
      },
    };
  }

  /**
   * Calculate initiative modifier for monster
   */
  static calculateInitiativeModifier(statblock: D5eStatblock): number {
    return Math.floor((statblock.abilities.DEX - 10) / 2);
  }

  /**
   * Generate available actions for ActionSystem
   */
  static generateActionSystemActions(monsterData: ECSMonsterData): Array<{
    id: string;
    name: string;
    actionType: "action" | "bonus_action" | "reaction";
    attackBonus?: number;
    damage?: {
      diceExpression: string;
      damageType: string;
    };
    saveDC?: number;
    saveAbility?: string;
    range?: { normal: number; long?: number };
    description: string;
  }> {
    const actions: Array<{
      id: string;
      name: string;
      actionType: "action" | "bonus_action" | "reaction";
      attackBonus?: number;
      damage?: {
        diceExpression: string;
        damageType: string;
      };
      saveDC?: number;
      saveAbility?: string;
      range?: { normal: number; long?: number };
      description: string;
    }> = [];

    // Convert main actions
    for (const action of monsterData.actions) {
      actions.push({
        id: `${monsterData.name.toLowerCase().replace(/\s+/g, "")}_${action.name.toLowerCase().replace(/\s+/g, "")}`,
        name: action.name,
        actionType: "action" as const,
        ...(action.attackBonus !== undefined && { attackBonus: action.attackBonus }),
        ...(action.damage && {
          damage: {
            diceExpression: action.damage.diceExpression,
            damageType: action.damage.damageType,
          },
        }),
        ...(action.saveDC !== undefined && { saveDC: action.saveDC }),
        ...(action.saveAbility !== undefined && { saveAbility: action.saveAbility }),
        ...(action.range !== undefined && { range: { normal: action.range } }),
        description: action.description,
      });
    }

    // Convert bonus actions
    for (const action of monsterData.bonusActions) {
      actions.push({
        id: `${monsterData.name.toLowerCase().replace(/\s+/g, "")}_${action.name.toLowerCase().replace(/\s+/g, "")}_bonus`,
        name: action.name,
        actionType: "bonus_action" as const,
        ...(action.attackBonus !== undefined && { attackBonus: action.attackBonus }),
        ...(action.damage && {
          damage: {
            diceExpression: action.damage.diceExpression,
            damageType: action.damage.damageType,
          },
        }),
        ...(action.saveDC !== undefined && { saveDC: action.saveDC }),
        ...(action.saveAbility !== undefined && { saveAbility: action.saveAbility }),
        ...(action.range !== undefined && { range: { normal: action.range } }),
        description: action.description,
      });
    }

    // Convert reactions
    for (const action of monsterData.reactions) {
      actions.push({
        id: `${monsterData.name.toLowerCase().replace(/\s+/g, "")}_${action.name.toLowerCase().replace(/\s+/g, "")}_reaction`,
        name: action.name,
        actionType: "reaction" as const,
        ...(action.attackBonus !== undefined && { attackBonus: action.attackBonus }),
        ...(action.damage && {
          damage: {
            diceExpression: action.damage.diceExpression,
            damageType: action.damage.damageType,
          },
        }),
        ...(action.saveDC !== undefined && { saveDC: action.saveDC }),
        ...(action.saveAbility !== undefined && { saveAbility: action.saveAbility }),
        ...(action.range !== undefined && { range: { normal: action.range } }),
        description: action.description,
      });
    }

    return actions;
  }

  /**
   * Extract hit points from various formats
   */
  private static extractHitPoints(hitPoints: number | { value: number; formula?: string }): number {
    if (typeof hitPoints === "number") {
      return hitPoints;
    }
    return hitPoints.value;
  }

  /**
   * Extract armor class from various formats
   */
  private static extractArmorClass(armorClass: number | { value: number; type?: string }): number {
    if (typeof armorClass === "number") {
      return armorClass;
    }
    return armorClass.value;
  }

  /**
   * Extract challenge rating as number
   */
  private static extractChallengeRating(cr: number | string): number {
    if (typeof cr === "number") {
      return cr;
    }

    // Handle fractional CRs like "1/2", "1/4", "1/8"
    if (cr.includes("/")) {
      const parts = cr.split("/").map(Number);
      const numerator = parts[0];
      const denominator = parts[1];
      if (numerator !== undefined && denominator !== undefined && denominator !== 0) {
        return numerator / denominator;
      }
    }

    return parseFloat(cr) || 0;
  }

  /**
   * Calculate proficiency bonus from challenge rating
   */
  private static calculateProficiencyBonus(challengeRating: number): number {
    if (challengeRating < 1) {
      return 2;
    }
    if (challengeRating < 5) {
      return 2;
    }
    if (challengeRating < 9) {
      return 3;
    }
    if (challengeRating < 13) {
      return 4;
    }
    if (challengeRating < 17) {
      return 5;
    }
    if (challengeRating < 21) {
      return 6;
    }
    if (challengeRating < 25) {
      return 7;
    }
    if (challengeRating < 29) {
      return 8;
    }
    return 9;
  }

  /**
   * Convert condition immunities to typed array
   */
  private static convertConditionImmunities(immunities: string[]): ConditionType[] {
    const conditionMap: Record<string, ConditionType> = {
      blinded: "blinded",
      charmed: "charmed",
      deafened: "deafened",
      frightened: "frightened",
      grappled: "grappled",
      incapacitated: "incapacitated",
      invisible: "invisible",
      paralyzed: "paralyzed",
      petrified: "petrified",
      poisoned: "poisoned",
      prone: "prone",
      restrained: "restrained",
      stunned: "stunned",
      unconscious: "unconscious",
      exhaustion: "exhaustion",
    };

    return immunities
      .map((immunity) => conditionMap[immunity.toLowerCase()])
      .filter(Boolean) as ConditionType[];
  }

  /**
   * Parse damage dice expressions like "2d6+3" or "1d8+2"
   */
  static parseDamageExpression(expression: string): {
    dice: number;
    sides: number;
    modifier: number;
    average: number;
  } {
    const match = expression.match(/(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?/);
    if (!match) {
      return { dice: 1, sides: 4, modifier: 0, average: 2.5 };
    }

    const dice = parseInt(match[1] || "1");
    const sides = parseInt(match[2] || "4");
    const modifierSign = match[3] === "-" ? -1 : 1;
    const modifier = match[4] ? parseInt(match[4]) * modifierSign : 0;
    const average = (dice * (sides + 1)) / 2 + modifier;

    return { dice, sides, modifier, average };
  }

  /**
   * Convert SRD monster format to standardized format
   */
  static normalizeSRDMonster(srdMonster: SRDMonster): D5eStatblock {
    const statblock: D5eStatblock = {
      name: srdMonster.name,
      size: srdMonster.size || "Medium",
      type: srdMonster.type || "humanoid",
      alignment: srdMonster.alignment || "neutral",
      armorClass: srdMonster.armor_class || 10,
      hitPoints: srdMonster.hit_points || 10,
      speed: srdMonster.speed || { walk: 30 },
      abilities: {
        STR: srdMonster.strength || 10,
        DEX: srdMonster.dexterity || 10,
        CON: srdMonster.constitution || 10,
        INT: srdMonster.intelligence || 10,
        WIS: srdMonster.wisdom || 10,
        CHA: srdMonster.charisma || 10,
      },
      challengeRating: srdMonster.challenge_rating || 0,
    };

    // Add optional properties only if they exist
    if (srdMonster.skills) {
      statblock.skills = srdMonster.skills;
    }
    if (srdMonster.saving_throws) {
      statblock.savingThrows = srdMonster.saving_throws;
    }
    if (srdMonster.damage_resistances) {
      statblock.damageResistances = srdMonster.damage_resistances;
    }
    if (srdMonster.damage_immunities) {
      statblock.damageImmunities = srdMonster.damage_immunities;
    }
    if (srdMonster.damage_vulnerabilities) {
      statblock.damageVulnerabilities = srdMonster.damage_vulnerabilities;
    }
    if (srdMonster.condition_immunities) {
      statblock.conditionImmunities = srdMonster.condition_immunities;
    }
    if (srdMonster.senses) {
      statblock.senses = srdMonster.senses;
    }
    if (srdMonster.languages) {
      statblock.languages = srdMonster.languages;
    }
    if (srdMonster.proficiency_bonus) {
      statblock.proficiencyBonus = srdMonster.proficiency_bonus;
    }
    if (srdMonster.actions) {
      statblock.actions = srdMonster.actions;
    }
    if (srdMonster.bonus_actions) {
      statblock.bonusActions = srdMonster.bonus_actions;
    }
    if (srdMonster.reactions) {
      statblock.reactions = srdMonster.reactions;
    }
    if (srdMonster.legendary_actions) {
      statblock.legendaryActions = srdMonster.legendary_actions;
    }
    if (srdMonster.spellcasting) {
      statblock.spellcasting = srdMonster.spellcasting;
    }

    return statblock;
  }
}
