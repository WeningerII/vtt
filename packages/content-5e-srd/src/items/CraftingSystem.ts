/**
 * D&D 5e Crafting System
 * Handles item crafting, recipes, skill checks, and tool requirements
 */

import { BaseItem, Tool, ItemCost } from "./index.js";

export interface CraftingRecipe {
  id: string;
  name: string;
  description: string;
  resultItemId: string;
  resultQuantity: number;
  materials: CraftingMaterial[];
  tools: string[]; // tool IDs required
  skills: CraftingSkill[];
  timeRequired: number; // in hours
  difficulty: CraftingDifficulty;
  category: CraftingCategory;
  prerequisites?: string[]; // other recipes or conditions required
}

export interface CraftingMaterial {
  itemId: string;
  quantity: number;
  consumed: boolean; // whether material is consumed in crafting
}

export interface CraftingSkill {
  skill: string; // skill name
  dc: number; // difficulty class
  required: boolean; // whether this check must succeed
}

export type CraftingDifficulty = "trivial" | "easy" | "medium" | "hard" | "very_hard" | "legendary";
export type CraftingCategory =
  | "alchemy"
  | "blacksmithing"
  | "leatherworking"
  | "woodworking"
  | "enchanting"
  | "cooking"
  | "herbalism"
  | "other";
export type CraftingQuality = "poor" | "standard" | "superior" | "masterwork";

export interface CraftingAttempt {
  id: string;
  recipeId: string;
  crafterId: string;
  startTime: Date;
  endTime?: Date;
  status: "in_progress" | "completed" | "failed" | "abandoned";
  skillChecks: SkillCheckResult[];
  quality: CraftingQuality;
  timeSpent: number; // actual time spent in hours
  materialsUsed: CraftingMaterial[];
  toolsUsed: string[];
  workspace?: string | undefined; // workspace ID if applicable
}

export interface SkillCheckResult {
  skill: string;
  dc: number;
  roll: number;
  modifier: number;
  total: number;
  success: boolean;
  critical: boolean;
}

export interface CraftingWorkspace {
  id: string;
  name: string;
  type: CraftingCategory;
  qualityBonus: number; // bonus to crafting checks
  timeMultiplier: number; // multiplier for crafting time (0.5 = half time)
  availableTools: string[]; // tools available in this workspace
  cost?: ItemCost; // cost to use workspace per day
}

export class CraftingSystem {
  private recipes: Map<string, CraftingRecipe> = new Map();
  private activeAttempts: Map<string, CraftingAttempt> = new Map();
  private workspaces: Map<string, CraftingWorkspace> = new Map();
  private completedAttempts: CraftingAttempt[] = [];

  constructor() {
    this.initializeRecipes();
    this.initializeWorkspaces();
  }

  /**
   * Start a crafting attempt
   */
  startCrafting(
    recipeId: string,
    crafterId: string,
    availableTools: string[],
    workspaceId?: string,
  ): CraftingAttempt | null {
    const recipe = this.recipes.get(recipeId);
    if (!recipe) {return null;}

    // Check if crafter has required tools
    const hasRequiredTools = recipe.tools.every(
      (toolId) =>
        availableTools.includes(toolId) ||
        (workspaceId && this.workspaces.get(workspaceId)?.availableTools.includes(toolId)),
    );

    if (!hasRequiredTools) {return null;}

    const attempt: CraftingAttempt = {
      id: `craft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      recipeId,
      crafterId,
      startTime: new Date(),
      status: "in_progress",
      skillChecks: [],
      quality: "standard",
      timeSpent: 0,
      materialsUsed: [],
      toolsUsed: recipe.tools,
      workspace: workspaceId,
    };

    this.activeAttempts.set(attempt.id, attempt);
    return attempt;
  }

  /**
   * Perform skill checks for crafting
   */
  performSkillChecks(
    attemptId: string,
    skillModifiers: Record<string, number>,
  ): SkillCheckResult[] {
    const attempt = this.activeAttempts.get(attemptId);
    if (!attempt) {return [];}

    const recipe = this.recipes.get(attempt.recipeId);
    if (!recipe) {return [];}

    const workspace = attempt.workspace ? this.workspaces.get(attempt.workspace) : undefined;
    const qualityBonus = workspace?.qualityBonus || 0;

    const results: SkillCheckResult[] = [];

    for (const skillCheck of recipe.skills) {
      const roll = Math.floor(Math.random() * 20) + 1;
      const modifier = (skillModifiers[skillCheck.skill] || 0) + qualityBonus;
      const total = roll + modifier;
      const success = total >= skillCheck.dc;
      const critical = roll === 20;

      const result: SkillCheckResult = {
        skill: skillCheck.skill,
        dc: skillCheck.dc,
        roll,
        modifier,
        total,
        success,
        critical,
      };

      results.push(result);
      attempt.skillChecks.push(result);
    }

    return results;
  }

  /**
   * Complete crafting attempt
   */
  completeCrafting(attemptId: string, hoursSpent: number): CraftingAttempt | null {
    const attempt = this.activeAttempts.get(attemptId);
    if (!attempt) {return null;}

    const recipe = this.recipes.get(attempt.recipeId);
    if (!recipe) {return null;}

    attempt.timeSpent = hoursSpent;
    attempt.endTime = new Date();

    // Determine success based on skill checks
    const requiredChecks = recipe.skills.filter((s) => s.required);
    const requiredSuccess = requiredChecks.every((check) =>
      attempt.skillChecks.some((result) => result.skill === check.skill && result.success),
    );

    if (!requiredSuccess) {
      attempt.status = "failed";
      attempt.quality = "poor";
    } else {
      attempt.status = "completed";

      // Determine quality based on skill check results
      const successfulChecks = attempt.skillChecks.filter((r) => r.success).length;
      const totalChecks = attempt.skillChecks.length;
      const criticalSuccesses = attempt.skillChecks.filter((r) => r.critical).length;

      if (criticalSuccesses > 0 && successfulChecks === totalChecks) {
        attempt.quality = "masterwork";
      } else if (successfulChecks === totalChecks) {
        attempt.quality = "superior";
      } else if (successfulChecks >= totalChecks * 0.75) {
        attempt.quality = "standard";
      } else {
        attempt.quality = "poor";
      }
    }

    // Move to completed attempts
    this.activeAttempts.delete(attemptId);
    this.completedAttempts.push(attempt);

    return attempt;
  }

  /**
   * Get available recipes for a character
   */
  getAvailableRecipes(
    characterSkills: string[],
    availableTools: string[],
    characterLevel?: number,
  ): CraftingRecipe[] {
    const available: CraftingRecipe[] = [];

    for (const recipe of this.recipes.values()) {
      // Check if character has required skills
      const hasSkills = recipe.skills.every((skill) => characterSkills.includes(skill.skill));

      // Check if character has access to required tools
      const hasTools = recipe.tools.every((toolId) => availableTools.includes(toolId));

      if (hasSkills && hasTools) {
        available.push(recipe);
      }
    }

    return available;
  }

  /**
   * Get recipes by category
   */
  getRecipesByCategory(category: CraftingCategory): CraftingRecipe[] {
    return Array.from(this.recipes.values()).filter((recipe) => recipe.category === category);
  }

  /**
   * Search recipes
   */
  searchRecipes(query: string): CraftingRecipe[] {
    const lowercaseQuery = query.toLowerCase();
    return Array.from(this.recipes.values()).filter(
      (recipe) =>
        recipe.name.toLowerCase().includes(lowercaseQuery) ||
        recipe.description.toLowerCase().includes(lowercaseQuery),
    );
  }

  /**
   * Get active crafting attempts
   */
  getActiveAttempts(crafterId?: string): CraftingAttempt[] {
    const attempts = Array.from(this.activeAttempts.values());
    return crafterId ? attempts.filter((a) => a.crafterId === crafterId) : attempts;
  }

  /**
   * Get completed attempts
   */
  getCompletedAttempts(crafterId?: string, limit?: number): CraftingAttempt[] {
    let attempts = crafterId
      ? this.completedAttempts.filter((a) => a.crafterId === crafterId)
      : this.completedAttempts;

    attempts = attempts.sort((a, b) => (b.endTime?.getTime() || 0) - (a.endTime?.getTime() || 0));

    return limit ? attempts.slice(0, limit) : attempts;
  }

  /**
   * Add custom recipe
   */
  addRecipe(recipe: CraftingRecipe): void {
    this.recipes.set(recipe.id, recipe);
  }

  /**
   * Get recipe by ID
   */
  getRecipe(id: string): CraftingRecipe | undefined {
    return this.recipes.get(id);
  }

  /**
   * Get all workspaces
   */
  getWorkspaces(): CraftingWorkspace[] {
    return Array.from(this.workspaces.values());
  }

  /**
   * Get workspace by ID
   */
  getWorkspace(id: string): CraftingWorkspace | undefined {
    return this.workspaces.get(id);
  }

  private initializeRecipes(): void {
    const recipes: CraftingRecipe[] = [
      {
        id: "healing_potion",
        name: "Potion of Healing",
        description: "Craft a basic healing potion",
        resultItemId: "potion_of_healing",
        resultQuantity: 1,
        materials: [
          { itemId: "herbs_healing", quantity: 2, consumed: true },
          { itemId: "vial_empty", quantity: 1, consumed: true },
          { itemId: "water_pure", quantity: 1, consumed: true },
        ],
        tools: ["alchemist_supplies"],
        skills: [
          { skill: "Medicine", dc: 15, required: true },
          { skill: "Nature", dc: 12, required: false },
        ],
        timeRequired: 4,
        difficulty: "medium",
        category: "alchemy",
      },
      {
        id: "iron_sword",
        name: "Iron Sword",
        description: "Forge a basic iron sword",
        resultItemId: "longsword",
        resultQuantity: 1,
        materials: [
          { itemId: "iron_ingot", quantity: 3, consumed: true },
          { itemId: "leather_strip", quantity: 1, consumed: true },
          { itemId: "wood_handle", quantity: 1, consumed: true },
        ],
        tools: ["smith_tools", "forge"],
        skills: [
          { skill: "Smith's Tools", dc: 18, required: true },
          { skill: "Athletics", dc: 15, required: false },
        ],
        timeRequired: 8,
        difficulty: "hard",
        category: "blacksmithing",
      },
      {
        id: "leather_armor",
        name: "Leather Armor",
        description: "Craft basic leather armor",
        resultItemId: "leather_armor",
        resultQuantity: 1,
        materials: [
          { itemId: "leather_hide", quantity: 4, consumed: true },
          { itemId: "thread_strong", quantity: 1, consumed: true },
        ],
        tools: ["leatherworker_tools"],
        skills: [
          { skill: "Leatherworker's Tools", dc: 16, required: true },
          { skill: "Sleight of Hand", dc: 14, required: false },
        ],
        timeRequired: 6,
        difficulty: "medium",
        category: "leatherworking",
      },
    ];

    recipes.forEach((recipe) => {
      this.recipes.set(recipe.id, recipe);
    });
  }

  private initializeWorkspaces(): void {
    const workspaces: CraftingWorkspace[] = [
      {
        id: "blacksmith_forge",
        name: "Blacksmith's Forge",
        type: "blacksmithing",
        qualityBonus: 2,
        timeMultiplier: 0.75,
        availableTools: ["smith_tools", "forge", "anvil", "bellows"],
        cost: { amount: 5, currency: "gp" },
      },
      {
        id: "alchemist_lab",
        name: "Alchemist's Laboratory",
        type: "alchemy",
        qualityBonus: 3,
        timeMultiplier: 0.5,
        availableTools: ["alchemist_supplies", "distillery", "cauldron"],
        cost: { amount: 10, currency: "gp" },
      },
      {
        id: "leather_workshop",
        name: "Leatherworker's Workshop",
        type: "leatherworking",
        qualityBonus: 1,
        timeMultiplier: 0.8,
        availableTools: ["leatherworker_tools", "tanning_rack", "cutting_tools"],
        cost: { amount: 3, currency: "gp" },
      },
    ];

    workspaces.forEach((workspace) => {
      this.workspaces.set(workspace.id, workspace);
    });
  }
}

export const _craftingSystem = new CraftingSystem();
