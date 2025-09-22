/**
 * Procedural Behavior Generation for AI Entities
 * Automatically generates complex AI behaviors based on character traits and context
 */

import { BehaviorTree, BehaviorTreeBuilder, Blackboard, NodeStatus } from "./BehaviorTree";
// TODO: Re-enable when packages are available
// import { MonsterPersonalityTraits, TacticalPreferences } from "@vtt/monster-ai";
// import { PerlinNoise, NameGenerator } from "@vtt/content-creation/ProceduralGenerators";
// import { globalEventBus, AIEvents } from "@vtt/core/EventBus";

// Temporary interfaces until packages are available
export interface MonsterPersonalityTraits {
  aggression: number;
  selfPreservation: number;
  packMentality: number;
  cunning: number;
  curiosity: number;
  loyalty: number;
  territorial?: number;
  patience?: number;
  vindictive?: number;
}

export interface TacticalPreferences {
  preferredRange: "melee" | "ranged" | "mixed";
  flankingTendency: number;
  retreatThreshold: number;
  fightingStyle?: string;
  targetPriority?: Array<"weakest" | "strongest" | "spellcaster" | "healer" | "nearest" | "leader">;
  usesTerrain?: boolean;
  coordinatesWithAllies?: boolean;
}

export interface SpecialBehavior {
  id: string;
  name: string;
  trigger: string;
  action: string;
  parameters: Record<string, unknown>;
}

export interface GenerationOptions {
  creatureType?: string;
  intelligence?: "mindless" | "animal" | "low" | "average" | "high" | "genius";
  alignment?: string;
  environment?: string;
  role?: "minion" | "elite" | "boss" | "support";
  complexity?: "simple" | "moderate" | "complex";
  seed?: number;
}

// Temporary placeholder classes until packages are available
class NameGenerator {
  constructor(_seed: number) {}
  generateCreatureName(_type: string): string {
    return "Generated Creature";
  }
}

class PerlinNoise {
  constructor(_seed: number) {}
  noise2D(_x: number, _y: number): number {
    return Math.random() * 2 - 1; // Simple random noise placeholder
  }
}

// Temporary placeholder for global event bus
const globalEventBus = {
  emit: async (_event: unknown) => Promise.resolve(),
};

const AIEvents = {
  behaviorChanged: (_id: string, _from: string, _to: string) => ({}),
};

export interface BehaviorTemplate {
  id: string;
  name: string;
  description: string;
  basePersonality: Partial<MonsterPersonalityTraits>;
  conditions: BehaviorCondition[];
  actions: BehaviorAction[];
  complexity: "simple" | "moderate" | "complex";
  tags: string[];
}

export interface BehaviorCondition {
  type: "health" | "distance" | "enemy_count" | "ally_count" | "time" | "resource" | "custom";
  operator: "eq" | "ne" | "gt" | "gte" | "lt" | "lte";
  value: string | number | boolean;
  weight: number;
}

export interface BehaviorAction {
  type:
    | "attack"
    | "defend"
    | "move"
    | "cast_spell"
    | "use_ability"
    | "call_help"
    | "retreat"
    | "patrol";
  priority: number;
  parameters: Record<string, unknown>;
  cooldown?: number;
  requirements?: BehaviorCondition[];
}

export interface GeneratedBehavior {
  id: string;
  name: string;
  behaviorTree: BehaviorTree;
  personality: MonsterPersonalityTraits;
  tacticalPreferences: TacticalPreferences;
  specialBehaviors: SpecialBehavior[];
  metadata: {
    generated: Date;
    seed: number;
    complexity: number;
    templates: string[];
  };
}

export class ProceduralBehaviorGenerator {
  private behaviorTemplates: Map<string, BehaviorTemplate> = new Map();
  private nameGenerator: NameGenerator;
  private personalityNoise: PerlinNoise;
  private behaviorNoise: PerlinNoise;

  constructor(seed: number = Date.now()) {
    this.nameGenerator = new NameGenerator(seed);
    this.personalityNoise = new PerlinNoise(seed);
    this.behaviorNoise = new PerlinNoise(seed + 1000);
    this.initializeTemplates();
  }

  /**
   * Generate a complete AI behavior for an entity
   */
  async generateBehavior(
    options: {
      creatureType?: string;
      intelligence?: "mindless" | "animal" | "low" | "average" | "high" | "genius";
      alignment?: string;
      environment?: string;
      role?: "minion" | "elite" | "boss" | "support";
      complexity?: "simple" | "moderate" | "complex";
      seed?: number;
    } = {},
  ): Promise<GeneratedBehavior> {
    const seed = options.seed || Math.random() * 1000000;
    const complexity = options.complexity || "moderate";

    // Generate base personality using noise functions
    const personality = this.generatePersonality(seed, options);

    // Generate tactical preferences
    const tacticalPreferences = this.generateTacticalPreferences(seed, personality, options);

    // Select and combine behavior templates
    const templates = this.selectBehaviorTemplates(personality, options);

    // Generate behavior tree
    const behaviorTree = await this.generateBehaviorTree(
      personality,
      tacticalPreferences,
      templates,
      seed,
    );

    // Generate special behaviors
    const specialBehaviors = this.generateSpecialBehaviors(personality, options);

    const generatedBehavior: GeneratedBehavior = {
      id: this.generateId(),
      name: this.nameGenerator.generateCreatureName(options.creatureType || "humanoid"),
      behaviorTree,
      personality,
      tacticalPreferences,
      specialBehaviors,
      metadata: {
        generated: new Date(),
        seed,
        complexity: this.complexityToNumber(complexity),
        templates: templates.map((t) => t.id),
      },
    };

    // Emit generation event
    await globalEventBus.emit(AIEvents.behaviorChanged(generatedBehavior.id, "none", "generated"));

    return generatedBehavior;
  }

  /**
   * Generate personality traits using noise functions
   */
  private generatePersonality(seed: number, options: GenerationOptions): MonsterPersonalityTraits {
    const baseX = seed * 0.01;
    const baseY = (seed + 1000) * 0.01;

    // Use noise to generate coherent personality traits
    const aggressionNoise = this.personalityNoise.noise2D(baseX, baseY);
    const cunningNoise = this.personalityNoise.noise2D(baseX + 10, baseY);
    const territorialNoise = this.personalityNoise.noise2D(baseX, baseY + 10);
    const packNoise = this.personalityNoise.noise2D(baseX + 10, baseY + 10);

    // Convert noise (-1 to 1) to personality values (0 to 1)
    let aggression = (aggressionNoise + 1) / 2;
    let cunning = (cunningNoise + 1) / 2;
    let territorial = (territorialNoise + 1) / 2;
    let packMentality = (packNoise + 1) / 2;

    // Adjust based on intelligence level
    const intelligenceMultiplier = this.getIntelligenceMultiplier(options.intelligence);
    cunning = Math.min(1, cunning * intelligenceMultiplier);

    // Adjust based on creature type
    if (options.creatureType === "dragon") {
      aggression = Math.min(1, aggression + 0.3);
      territorial = Math.min(1, territorial + 0.4);
      packMentality = Math.max(0, packMentality - 0.5);
    } else if (options.creatureType === "goblin") {
      packMentality = Math.min(1, packMentality + 0.3);
      aggression = Math.min(1, aggression + 0.2);
    }

    return {
      aggression,
      cunning,
      territorial,
      packMentality,
      selfPreservation: (this.personalityNoise.noise2D(baseX + 20, baseY) + 1) / 2,
      curiosity: (this.personalityNoise.noise2D(baseX, baseY + 20) + 1) / 2,
      loyalty: (this.personalityNoise.noise2D(baseX + 25, baseY) + 1) / 2,
      patience: (this.personalityNoise.noise2D(baseX + 30, baseY) + 1) / 2,
      vindictive: (this.personalityNoise.noise2D(baseX, baseY + 30) + 1) / 2,
    };
  }

  /**
   * Generate tactical preferences based on personality
   */
  private generateTacticalPreferences(
    seed: number,
    personality: MonsterPersonalityTraits,
    _options: GenerationOptions,
  ): TacticalPreferences {
    const _behaviorX = seed * 0.01;
    const _behaviorY = (seed + 2000) * 0.01;

    // Determine preferred range based on personality and creature type
    let preferredRange: "melee" | "ranged" | "mixed" = "melee";
    if (personality.cunning > 0.6 && personality.selfPreservation > 0.5) {
      preferredRange = "ranged";
    } else if (personality.cunning > 0.7) {
      preferredRange = "mixed";
    }

    // Determine fighting style
    let fightingStyle: "aggressive" | "defensive" | "hit_and_run" | "ambush" | "support" =
      "aggressive";
    if (personality.aggression > 0.8) {
      fightingStyle = "aggressive";
    } else if (personality.selfPreservation > 0.7) {
      fightingStyle = "defensive";
    } else if (personality.cunning > 0.7 && personality.selfPreservation > 0.5) {
      fightingStyle = "hit_and_run";
    } else if (personality.cunning > 0.8 && (personality.patience || 0) > 0.6) {
      fightingStyle = "ambush";
    } else if (personality.packMentality > 0.7) {
      fightingStyle = "support";
    }

    // Generate target priorities based on personality
    const targetPriority: Array<
      "weakest" | "strongest" | "spellcaster" | "healer" | "nearest" | "leader"
    > = [];

    if (personality.cunning > 0.6) {
      targetPriority.push("spellcaster", "healer");
    }
    if (personality.aggression > 0.7) {
      targetPriority.push("strongest", "leader");
    }
    if (personality.selfPreservation > 0.6) {
      targetPriority.push("weakest");
    }
    targetPriority.push("nearest"); // Always include as fallback

    return {
      preferredRange,
      flankingTendency: personality.cunning * 0.8,
      fightingStyle,
      targetPriority,
      retreatThreshold: Math.max(0.1, personality.selfPreservation * 0.5),
      usesTerrain: personality.cunning > 0.5,
      coordinatesWithAllies: personality.packMentality > 0.4,
    };
  }

  /**
   * Select appropriate behavior templates
   */
  private selectBehaviorTemplates(
    personality: MonsterPersonalityTraits,
    options: GenerationOptions,
  ): BehaviorTemplate[] {
    const templates: BehaviorTemplate[] = [];
    const availableTemplates = Array.from(this.behaviorTemplates.values());

    // Score templates based on personality match
    const scoredTemplates = availableTemplates.map((template) => ({
      template,
      score: this.scoreBehaviorTemplate(template, personality, options),
    }));

    // Sort by score and select top templates
    scoredTemplates.sort((a, b) => b.score - a.score);

    const complexity = options.complexity || "moderate";
    const templateCount = complexity === "simple" ? 1 : complexity === "moderate" ? 2 : 3;

    const take = Math.min(templateCount, scoredTemplates.length);
    scoredTemplates.slice(0, take).forEach((item) => {
      templates.push(item.template);
    });

    return templates;
  }

  /**
   * Score how well a template matches the personality
   */
  private scoreBehaviorTemplate(
    template: BehaviorTemplate,
    personality: MonsterPersonalityTraits,
    options: GenerationOptions,
  ): number {
    let score = 0;

    // Compare personality traits
    if (template.basePersonality) {
      for (const [trait, value] of Object.entries(template.basePersonality)) {
        if (trait in personality) {
          const personalityValue = (personality as unknown as Record<string, number>)[trait];
          const diff = Math.abs(personalityValue - (value as number));
          score += (1 - diff) * 10; // Higher score for closer match
        }
      }
    }

    // Bonus for matching tags
    if (template.tags.includes(options.creatureType || "")) {
      score += 5;
    }
    if (template.tags.includes(options.role || "")) {
      score += 3;
    }
    if (template.tags.includes(options.environment || "")) {
      score += 2;
    }

    return score;
  }

  /**
   * Generate behavior tree from templates and personality
   */
  private async generateBehaviorTree(
    personality: MonsterPersonalityTraits,
    tactical: TacticalPreferences,
    templates: BehaviorTemplate[],
    seed: number,
  ): Promise<BehaviorTree> {
    const blackboard = new Blackboard();
    const builder = new BehaviorTreeBuilder(blackboard);

    // Set initial blackboard values
    blackboard.set("personality", personality);
    blackboard.set("tactical", tactical);
    blackboard.set("seed", seed);

    // Build main behavior tree structure
    builder
      .selector("Main Behavior")
      // Emergency behaviors (high priority)
      .sequence("Emergency Response")
      .condition(
        "Low Health",
        () => blackboard.get("health_percentage", 1) < tactical.retreatThreshold,
      )
      .selector("Emergency Actions")
      .condition("Can Retreat", () => personality.selfPreservation > 0.5)
      .action("Retreat", () => this.executeRetreat(blackboard))
      .action("Desperate Attack", () => this.executeDesperateAttack(blackboard))
      .end()
      .end()

      // Combat behaviors
      .sequence("Combat Behavior")
      .condition("In Combat", () => blackboard.get("in_combat", false))
      .selector("Combat Actions");

    // Add template-based behaviors while 'Combat Actions' is on top of the builder stack
    this.buildTemplateBehaviors(templates, builder, blackboard);

    builder
      // Fallback basic attack
      .action("Basic Attack", () => this.executeBasicAttack(blackboard))
      .end()
      .end()

      // Exploration/Patrol behaviors
      .sequence("Exploration Behavior")
      .condition("Not In Combat", () => !blackboard.get("in_combat", false))
      .selector("Exploration Actions")
      .action("Patrol Territory", () => this.executePatrol(blackboard))
      .action("Investigate", () => this.executeInvestigate(blackboard))
      .action("Idle", () => this.executeIdle(blackboard))
      .end()
      .end()
      .end();

    const tree = new BehaviorTree();
    const rootNode = builder.build();
    if (rootNode) {
      tree.setRoot(rootNode);
    }

    return tree;
  }

  /**
   * Build behaviors from templates
   */
  private buildTemplateBehaviors(
    templates: BehaviorTemplate[],
    builder: BehaviorTreeBuilder,
    blackboard: Blackboard,
  ): void {
    templates.forEach((template) => {
      template.actions.forEach((action) => {
        const actionBuilder = builder
          .sequence(`Template: ${action.type}`)
          .condition(`Can ${action.type}`, () => this.canExecuteAction(action, blackboard));

        // Add conditions from template
        action.requirements?.forEach((req) => {
          actionBuilder.condition(`Requirement: ${req.type}`, () =>
            this.evaluateCondition(req, blackboard),
          );
        });

        actionBuilder
          .action(`Execute ${action.type}`, () => this.executeTemplateAction(action, blackboard))
          .end();
      });
    });
  }

  /**
   * Generate special behaviors based on personality
   */
  private generateSpecialBehaviors(
    personality: MonsterPersonalityTraits,
    _options: GenerationOptions,
  ): SpecialBehavior[] {
    const behaviors: SpecialBehavior[] = [];

    // Berserker behavior for high aggression
    if (personality.aggression > 0.8 && personality.selfPreservation < 0.3) {
      behaviors.push({
        id: "berserker_rage",
        name: "Berserker Rage",
        trigger: "bloodied",
        action: "berserk",
        parameters: { damage_bonus: 2, defense_penalty: -2 },
      });
    }

    // Pack tactics for high pack mentality
    if (personality.packMentality > 0.7) {
      behaviors.push({
        id: "pack_tactics",
        name: "Pack Tactics",
        trigger: "ally_nearby",
        action: "coordinate_attack",
        parameters: { bonus_per_ally: 1, max_bonus: 3 },
      });
    }

    // Cunning retreat for high cunning and self-preservation
    if (personality.cunning > 0.6 && personality.selfPreservation > 0.6) {
      behaviors.push({
        id: "cunning_retreat",
        name: "Cunning Retreat",
        trigger: "outnumbered",
        action: "tactical_withdrawal",
        parameters: { smoke_screen: true, caltrops: true },
      });
    }

    return behaviors;
  }

  // Behavior execution methods
  private executeRetreat(blackboard: Blackboard): NodeStatus {
    // Implementation would move character away from enemies
    blackboard.set("current_action", "retreating");
    return NodeStatus.SUCCESS;
  }

  private executeDesperateAttack(blackboard: Blackboard): NodeStatus {
    // Implementation would perform high-risk, high-reward attack
    blackboard.set("current_action", "desperate_attack");
    blackboard.set("attack_bonus", 2);
    blackboard.set("defense_penalty", -2);
    return NodeStatus.SUCCESS;
  }

  private executeBasicAttack(blackboard: Blackboard): NodeStatus {
    blackboard.set("current_action", "basic_attack");
    return NodeStatus.SUCCESS;
  }

  private executePatrol(blackboard: Blackboard): NodeStatus {
    blackboard.set("current_action", "patrolling");
    return NodeStatus.SUCCESS;
  }

  private executeInvestigate(blackboard: Blackboard): NodeStatus {
    blackboard.set("current_action", "investigating");
    return NodeStatus.SUCCESS;
  }

  private executeIdle(blackboard: Blackboard): NodeStatus {
    blackboard.set("current_action", "idle");
    return NodeStatus.SUCCESS;
  }

  private canExecuteAction(action: BehaviorAction, blackboard: Blackboard): boolean {
    // Check cooldowns
    const lastUsed = blackboard.get(`${action.type}_last_used`, 0);
    const currentTime = Date.now();
    if (action.cooldown && currentTime - lastUsed < action.cooldown * 1000) {
      return false;
    }

    return true;
  }

  private evaluateCondition(condition: BehaviorCondition, blackboard: Blackboard): boolean {
    const value = blackboard.get(condition.type, 0);
    const numericValue = typeof value === "number" ? value : 0;
    const conditionValue = typeof condition.value === "number" ? condition.value : 0;

    switch (condition.operator) {
      case "eq":
        return value === condition.value;
      case "ne":
        return value !== condition.value;
      case "gt":
        return numericValue > conditionValue;
      case "gte":
        return numericValue >= conditionValue;
      case "lt":
        return numericValue < conditionValue;
      case "lte":
        return numericValue <= conditionValue;
      default:
        return false;
    }
  }

  private executeTemplateAction(action: BehaviorAction, blackboard: Blackboard): NodeStatus {
    blackboard.set("current_action", action.type);
    blackboard.set(`${action.type}_last_used`, Date.now());

    // Apply action parameters to blackboard
    Object.entries(action.parameters).forEach(([key, value]) => {
      blackboard.set(`action_${key}`, value);
    });

    return NodeStatus.SUCCESS;
  }

  private initializeTemplates(): void {
    // Aggressive Combatant Template
    this.behaviorTemplates.set("aggressive_combatant", {
      id: "aggressive_combatant",
      name: "Aggressive Combatant",
      description: "Direct, aggressive fighting style",
      basePersonality: { aggression: 0.8, selfPreservation: 0.3 },
      conditions: [{ type: "enemy_count", operator: "gte", value: 1, weight: 1.0 }],
      actions: [
        {
          type: "attack",
          priority: 8,
          parameters: { style: "aggressive", damage_bonus: 1 },
        },
      ],
      complexity: "simple",
      tags: ["combat", "aggressive", "melee"],
    });

    // Cunning Tactician Template
    this.behaviorTemplates.set("cunning_tactician", {
      id: "cunning_tactician",
      name: "Cunning Tactician",
      description: "Uses terrain and positioning advantageously",
      basePersonality: { cunning: 0.8, patience: 0.6 },
      conditions: [{ type: "health", operator: "gt", value: 0.5, weight: 0.8 }],
      actions: [
        {
          type: "move",
          priority: 7,
          parameters: { style: "tactical", seek_advantage: true },
          cooldown: 2,
        },
        {
          type: "use_ability",
          priority: 9,
          parameters: { type: "tactical" },
          cooldown: 5,
        },
      ],
      complexity: "moderate",
      tags: ["tactical", "cunning", "positioning"],
    });

    // Pack Hunter Template
    this.behaviorTemplates.set("pack_hunter", {
      id: "pack_hunter",
      name: "Pack Hunter",
      description: "Coordinates with allies for group tactics",
      basePersonality: { packMentality: 0.8, cunning: 0.5 },
      conditions: [{ type: "ally_count", operator: "gte", value: 1, weight: 1.0 }],
      actions: [
        {
          type: "attack",
          priority: 8,
          parameters: { coordinate_with_allies: true },
          requirements: [{ type: "ally_count", operator: "gte", value: 1, weight: 1.0 }],
        },
        {
          type: "call_help",
          priority: 6,
          parameters: { range: 60 },
          cooldown: 10,
        },
      ],
      complexity: "moderate",
      tags: ["pack", "coordination", "social"],
    });
  }

  private getIntelligenceMultiplier(intelligence?: string): number {
    switch (intelligence) {
      case "mindless":
        return 0.1;
      case "animal":
        return 0.3;
      case "low":
        return 0.6;
      case "average":
        return 1.0;
      case "high":
        return 1.4;
      case "genius":
        return 1.8;
      default:
        return 1.0;
    }
  }

  private complexityToNumber(complexity: string): number {
    switch (complexity) {
      case "simple":
        return 1;
      case "moderate":
        return 2;
      case "complex":
        return 3;
      default:
        return 2;
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}
