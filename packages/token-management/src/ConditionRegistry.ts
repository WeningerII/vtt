/**
 * Condition Registry - Predefined conditions and effects
 * Contains standard D&D 5e conditions and custom condition templates
 */

import { TokenCondition, ConditionEffect } from "./TokenManager";

export interface ConditionTemplate {
  name: string;
  description: string;
  type: "buff" | "debuff" | "neutral";
  effects: ConditionEffect[];
  duration?: number;
  concentration?: boolean;
  stackable?: boolean;
  suppressedBy?: string[];
  icon?: string;
  category: "combat" | "social" | "exploration" | "custom";
}

export class ConditionRegistry {
  private static instance: ConditionRegistry;
  private conditions: Map<string, ConditionTemplate> = new Map();

  private constructor() {
    this.initializeStandardConditions();
  }

  static getInstance(): ConditionRegistry {
    if (!ConditionRegistry.instance) {
      ConditionRegistry.instance = new ConditionRegistry();
    }
    return ConditionRegistry.instance;
  }

  private initializeStandardConditions(): void {
    // D&D 5e Standard Conditions
    const standardConditions: ConditionTemplate[] = [
      {
        name: "Blinded",
        description:
          "A blinded creature can't see and automatically fails any ability check that requires sight.",
        type: "debuff",
        category: "combat",
        effects: [
          { type: "custom", target: "attackRolls", modifier: -1, operation: "disadvantage" },
          { type: "custom", target: "abilityChecks", modifier: -1, operation: "disadvantage" },
        ],
        icon: "👁️‍🗨️",
      },
      {
        name: "Charmed",
        description:
          "A charmed creature can't attack the charmer or target the charmer with harmful abilities or magical effects.",
        type: "debuff",
        category: "social",
        effects: [],
        icon: "💕",
      },
      {
        name: "Deafened",
        description:
          "A deafened creature can't hear and automatically fails any ability check that requires hearing.",
        type: "debuff",
        category: "combat",
        effects: [
          { type: "custom", target: "hearingChecks", modifier: -1, operation: "disadvantage" },
        ],
        icon: "🔇",
      },
      {
        name: "Frightened",
        description:
          "A frightened creature has disadvantage on ability checks and attack rolls while the source of its fear is within line of sight.",
        type: "debuff",
        category: "combat",
        effects: [
          { type: "custom", target: "attackRolls", modifier: -1, operation: "disadvantage" },
          { type: "custom", target: "abilityChecks", modifier: -1, operation: "disadvantage" },
        ],
        icon: "😰",
      },
      {
        name: "Grappled",
        description:
          "A grappled creature's speed becomes 0, and it can't benefit from any bonus to its speed.",
        type: "debuff",
        category: "combat",
        effects: [{ type: "speed", target: "speed", modifier: 0, operation: "set" }],
        icon: "🤝",
      },
      {
        name: "Incapacitated",
        description: "An incapacitated creature can't take actions or reactions.",
        type: "debuff",
        category: "combat",
        effects: [],
        icon: "😵",
      },
      {
        name: "Invisible",
        description:
          "An invisible creature is impossible to see without the aid of magic or a special sense.",
        type: "buff",
        category: "combat",
        effects: [
          { type: "custom", target: "attackRolls", modifier: 1, operation: "advantage" },
          { type: "custom", target: "stealthChecks", modifier: 1, operation: "advantage" },
        ],
        icon: "👻",
      },
      {
        name: "Paralyzed",
        description: "A paralyzed creature is incapacitated and can't move or speak.",
        type: "debuff",
        category: "combat",
        effects: [
          { type: "speed", target: "speed", modifier: 0, operation: "set" },
          { type: "save", target: "dexterity", modifier: -1, operation: "disadvantage" },
          { type: "save", target: "strength", modifier: -1, operation: "disadvantage" },
        ],
        suppressedBy: ["Incapacitated"],
        icon: "🥶",
      },
      {
        name: "Petrified",
        description:
          "A petrified creature is transformed, along with any nonmagical object it is wearing or carrying, into a solid inanimate substance.",
        type: "debuff",
        category: "combat",
        effects: [{ type: "speed", target: "speed", modifier: 0, operation: "set" }],
        suppressedBy: ["Incapacitated"],
        icon: "🗿",
      },
      {
        name: "Poisoned",
        description: "A poisoned creature has disadvantage on attack rolls and ability checks.",
        type: "debuff",
        category: "combat",
        effects: [
          { type: "custom", target: "attackRolls", modifier: -1, operation: "disadvantage" },
          { type: "custom", target: "abilityChecks", modifier: -1, operation: "disadvantage" },
        ],
        icon: "🤢",
      },
      {
        name: "Prone",
        description:
          "A prone creature's only movement option is to crawl, unless it stands up and thereby ends the condition.",
        type: "debuff",
        category: "combat",
        effects: [
          { type: "custom", target: "attackRolls", modifier: -1, operation: "disadvantage" },
          { type: "speed", target: "speed", modifier: 0.5, operation: "multiply" },
        ],
        icon: "🤕",
      },
      {
        name: "Restrained",
        description:
          "A restrained creature's speed becomes 0, and it can't benefit from any bonus to its speed.",
        type: "debuff",
        category: "combat",
        effects: [
          { type: "speed", target: "speed", modifier: 0, operation: "set" },
          { type: "custom", target: "attackRolls", modifier: -1, operation: "disadvantage" },
          { type: "save", target: "dexterity", modifier: -1, operation: "disadvantage" },
        ],
        icon: "🕸️",
      },
      {
        name: "Stunned",
        description:
          "A stunned creature is incapacitated, can't move, and can speak only falteringly.",
        type: "debuff",
        category: "combat",
        effects: [
          { type: "speed", target: "speed", modifier: 0, operation: "set" },
          { type: "save", target: "dexterity", modifier: -1, operation: "disadvantage" },
        ],
        suppressedBy: ["Incapacitated"],
        icon: "😵‍💫",
      },
      {
        name: "Unconscious",
        description:
          "An unconscious creature is incapacitated, can't move or speak, and is unaware of its surroundings.",
        type: "debuff",
        category: "combat",
        effects: [
          { type: "speed", target: "speed", modifier: 0, operation: "set" },
          { type: "save", target: "dexterity", modifier: -1, operation: "disadvantage" },
          { type: "save", target: "strength", modifier: -1, operation: "disadvantage" },
        ],
        suppressedBy: ["Incapacitated", "Prone"],
        icon: "😴",
      },
    ];

    // Buff Conditions
    const buffConditions: ConditionTemplate[] = [
      {
        name: "Blessed",
        description: "Blessed creatures add 1d4 to attack rolls and saving throws.",
        type: "buff",
        category: "combat",
        effects: [
          { type: "custom", target: "attackRolls", modifier: 2, operation: "add" }, // Average of 1d4
          { type: "save", target: "all", modifier: 2, operation: "add" },
        ],
        duration: 10,
        concentration: true,
        icon: "✨",
      },
      {
        name: "Haste",
        description:
          "Target's speed is doubled, it gains +2 AC, advantage on Dex saves, and an additional action.",
        type: "buff",
        category: "combat",
        effects: [
          { type: "speed", target: "speed", modifier: 2, operation: "multiply" },
          { type: "ac", target: "ac", modifier: 2, operation: "add" },
          { type: "save", target: "dexterity", modifier: 1, operation: "advantage" },
        ],
        duration: 10,
        concentration: true,
        icon: "⚡",
      },
      {
        name: "Shield of Faith",
        description: "Target gains +2 AC.",
        type: "buff",
        category: "combat",
        effects: [{ type: "ac", target: "ac", modifier: 2, operation: "add" }],
        duration: 10,
        concentration: true,
        icon: "🛡️",
      },
      {
        name: "Bless",
        description: "Targets add 1d4 to attack rolls and saving throws.",
        type: "buff",
        category: "combat",
        effects: [
          { type: "custom", target: "attackRolls", modifier: 2, operation: "add" },
          { type: "save", target: "all", modifier: 2, operation: "add" },
        ],
        duration: 10,
        concentration: true,
        stackable: false,
        icon: "🙏",
      },
      {
        name: "Guidance",
        description: "Target adds 1d4 to one ability check of their choice.",
        type: "buff",
        category: "exploration",
        effects: [{ type: "custom", target: "abilityChecks", modifier: 2, operation: "add" }],
        duration: 1,
        icon: "🧭",
      },
    ];

    // Custom Conditions
    const customConditions: ConditionTemplate[] = [
      {
        name: "Burning",
        description: "Takes fire damage at the start of each turn.",
        type: "debuff",
        category: "combat",
        effects: [{ type: "damage", target: "fire", modifier: 5, operation: "add" }],
        duration: 3,
        stackable: true,
        icon: "🔥",
      },
      {
        name: "Regenerating",
        description: "Regains hit points at the start of each turn.",
        type: "buff",
        category: "combat",
        effects: [{ type: "custom", target: "healing", modifier: 3, operation: "add" }],
        duration: 10,
        stackable: false,
        icon: "💚",
      },
      {
        name: "Marked",
        description: "Attacker has advantage against this target.",
        type: "debuff",
        category: "combat",
        effects: [],
        duration: 3,
        stackable: false,
        icon: "🎯",
      },
      {
        name: "Inspired",
        description: "Has advantage on the next ability check, attack roll, or saving throw.",
        type: "buff",
        category: "social",
        effects: [{ type: "custom", target: "nextRoll", modifier: 1, operation: "advantage" }],
        duration: 1,
        stackable: false,
        icon: "🎵",
      },
    ];

    // Register all conditions
    [...standardConditions, ...buffConditions, ...customConditions].forEach((condition) => {
      this.conditions.set(condition.name.toLowerCase(), condition);
    });
  }

  /**
   * Get a condition template by name
   */
  getCondition(name: string): ConditionTemplate | undefined {
    return this.conditions.get(name.toLowerCase());
  }

  /**
   * Get all conditions of a specific type
   */
  getConditionsByType(type: "buff" | "debuff" | "neutral"): ConditionTemplate[] {
    return Array.from(this.conditions.values()).filter((condition) => condition.type === type);
  }

  /**
   * Get all conditions in a category
   */
  getConditionsByCategory(
    category: "combat" | "social" | "exploration" | "custom",
  ): ConditionTemplate[] {
    return Array.from(this.conditions.values()).filter(
      (condition) => condition.category === category,
    );
  }

  /**
   * Get all available conditions
   */
  getAllConditions(): ConditionTemplate[] {
    return Array.from(this.conditions.values());
  }

  /**
   * Search conditions by name or description
   */
  searchConditions(query: string): ConditionTemplate[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.conditions.values()).filter(
      (condition) =>
        condition.name.toLowerCase().includes(lowerQuery) ||
        condition.description.toLowerCase().includes(lowerQuery),
    );
  }

  /**
   * Create a condition instance from a template
   */
  createCondition(
    templateName: string,
    overrides: Partial<TokenCondition> = {},
  ): TokenCondition | null {
    const template = this.getCondition(templateName);
    if (!template) return null;

    const condition: TokenCondition = {
      id: `${templateName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: template.name,
      description: template.description,
      type: template.type,
      effects: template.effects,
      duration: template.duration ?? 0, // Default to 0 if undefined
      concentration: template.concentration ?? false, // Default to false if undefined
      stackable: template.stackable ?? false, // Default to false if undefined
      suppressedBy: template.suppressedBy ?? [], // Default to empty array if undefined
      icon: template.icon ?? "default", // Default to 'default' if undefined
      ...overrides,
    };

    return condition;
  }

  /**
   * Register a custom condition template
   */
  registerCondition(condition: ConditionTemplate): void {
    this.conditions.set(condition.name.toLowerCase(), condition);
  }

  /**
   * Remove a condition template
   */
  unregisterCondition(name: string): boolean {
    return this.conditions.delete(name.toLowerCase());
  }

  /**
   * Check if a condition exists
   */
  hasCondition(name: string): boolean {
    return this.conditions.has(name.toLowerCase());
  }

  /**
   * Get conditions that suppress a given condition
   */
  getSuppressingConditions(conditionName: string): ConditionTemplate[] {
    const condition = this.getCondition(conditionName);
    if (!condition || !condition.suppressedBy) return [];

    return condition.suppressedBy
      .map((name) => this.getCondition(name))
      .filter((c): c is ConditionTemplate => c !== undefined);
  }

  /**
   * Get conditions that are suppressed by a given condition
   */
  getSuppressedConditions(conditionName: string): ConditionTemplate[] {
    return Array.from(this.conditions.values()).filter((condition) =>
      condition.suppressedBy?.includes(conditionName),
    );
  }

  /**
   * Export all condition templates
   */
  exportConditions(): ConditionTemplate[] {
    return Array.from(this.conditions.values());
  }

  /**
   * Import condition templates
   */
  importConditions(conditions: ConditionTemplate[], merge: boolean = true): void {
    if (!merge) {
      this.conditions.clear();
      this.initializeStandardConditions();
    }

    conditions.forEach((condition) => {
      this.registerCondition(condition);
    });
  }

  /**
   * Reset to default conditions only
   */
  resetToDefaults(): void {
    this.conditions.clear();
    this.initializeStandardConditions();
  }
}
