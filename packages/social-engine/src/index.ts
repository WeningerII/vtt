/**
 * Social Interaction Engine for D&D 5e
 * Handles social mechanics, reactions, and cross-entity interactions
 */

import { DiceEngine, diceEngine } from "@vtt/dice-engine";
import { ConditionsEngine, conditionsEngine } from "@vtt/conditions-engine";

export interface SocialInteraction {
  id: string;
  type:
    | "persuasion"
    | "deception"
    | "intimidation"
    | "insight"
    | "performance"
    | "reaction"
    | "opportunity_attack";
  initiator: string;
  target: string;
  dc?: number;
  advantage?: boolean;
  disadvantage?: boolean;
  modifiers?: number;
  context?: string;
  result?: InteractionResult;
}

export interface InteractionResult {
  success: boolean;
  roll: {
    total: number;
    dice: number;
    modifier: number;
    advantage?: boolean;
    disadvantage?: boolean;
  };
  effects?: InteractionEffect[];
  relationship?: RelationshipChange;
}

export interface InteractionEffect {
  type: "condition" | "attitude" | "information" | "combat_trigger" | "opportunity_attack";
  target: string;
  value?: any;
  duration?: number;
}

export interface RelationshipChange {
  target: string;
  change: number; // -5 to +5 scale
  newAttitude: "hostile" | "unfriendly" | "neutral" | "friendly" | "helpful";
}

export interface Reaction {
  id: string;
  name: string;
  description: string;
  trigger: ReactionTrigger;
  effect: ReactionEffect;
  range?: number;
  usesPerRound?: number;
  used?: boolean;
}

export interface ReactionTrigger {
  event:
    | "opportunity_attack"
    | "spell_cast"
    | "movement"
    | "attack_made"
    | "damage_taken"
    | "ally_damaged"
    | "custom";
  condition?: string;
  range?: number;
}

export interface ReactionEffect {
  type: "attack" | "spell" | "condition" | "movement" | "damage_reduction" | "advantage_grant";
  target?: "triggering_entity" | "self" | "nearest_ally" | "custom";
  value?: any;
}

export interface EntityRelationships {
  entityId: string;
  relationships: Map<
    string,
    {
      attitude: "hostile" | "unfriendly" | "neutral" | "friendly" | "helpful";
      value: number; // -10 to +10 scale
      history: SocialInteraction[];
    }
  >;
}

export class SocialEngine {
  private dice: DiceEngine;
  private conditions: ConditionsEngine;
  private entityRelationships = new Map<string, EntityRelationships>();
  private entityReactions = new Map<string, Reaction[]>();
  private pendingReactions = new Map<string, { reaction: Reaction; context: any }[]>();

  constructor() {
    this.dice = diceEngine;
    this.conditions = conditionsEngine;
  }

  /**
   * Initialize social data for an entity
   */
  initializeEntity(entityId: string, reactions?: Reaction[]): void {
    this.entityRelationships.set(entityId, {
      entityId,
      relationships: new Map(),
    });

    if (reactions) {
      this.entityReactions.set(entityId, reactions);
    }
  }

  /**
   * Perform a social interaction (skill check)
   */
  performSocialCheck(interaction: Omit<SocialInteraction, "id" | "result">): InteractionResult {
    const interactionId = `social_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // Get character's skill bonus for the interaction type
    const skillBonus = this.getSkillBonus(interaction.initiator, interaction.type);

    // Roll the check
    let roll;
    if (interaction.advantage) {
      roll = this.dice.rollWithAdvantage(20, skillBonus + (interaction.modifiers || 0));
    } else if (interaction.disadvantage) {
      roll = this.dice.rollWithDisadvantage(20, skillBonus + (interaction.modifiers || 0));
    } else {
      roll = this.dice.rollAbilityCheck(skillBonus + (interaction.modifiers || 0));
    }

    const dc = interaction.dc || this.getDefaultDC(interaction.type, interaction.target);
    const success = roll.total >= dc;

    const result: InteractionResult = {
      success,
      roll: {
        total: roll.total,
        dice: roll.rolls[0] || 0,
        modifier: roll.modifier,
        advantage: interaction.advantage,
        disadvantage: interaction.disadvantage,
      },
      effects: [],
    };

    // Apply results based on interaction type and success
    if (success) {
      result.effects = this.getSuccessEffects(interaction);
      result.relationship = this.updateRelationship(interaction, success);
    } else {
      result.effects = this.getFailureEffects(interaction);
      result.relationship = this.updateRelationship(interaction, success);
    }

    // Store the interaction
    const fullInteraction: SocialInteraction = {
      id: interactionId,
      ...interaction,
      result,
    };

    this.addInteractionHistory(interaction.initiator, interaction.target, fullInteraction);

    return result;
  }

  /**
   * Process opportunity attacks when movement triggers them
   */
  processOpportunityAttacks(
    movingEntity: string,
    startPosition: { x: number; y: number },
    endPosition: { x: number; y: number },
    nearbyEntities: Array<{ id: string; position: { x: number; y: number }; reach: number }>,
  ): Array<{ attacker: string; result: any }> {
    const opportunityAttacks: Array<{ attacker: string; result: any }> = [];

    for (const entity of nearbyEntities) {
      if (entity.id === movingEntity) {continue;}

      const reactions = this.entityReactions.get(entity.id) || [];
      const opportunityReaction = reactions.find(
        (r) => r.trigger.event === "opportunity_attack" && !r.used,
      );

      if (opportunityReaction) {
        // Check if movement triggers opportunity attack
        const distance = this.calculateDistance(startPosition, entity.position);
        const newDistance = this.calculateDistance(endPosition, entity.position);

        if (distance <= entity.reach && newDistance > entity.reach) {
          // Movement triggers opportunity attack
          const attackResult = this.executeReaction(entity.id, opportunityReaction, {
            target: movingEntity,
            trigger: "movement_away",
          });

          opportunityAttacks.push({
            attacker: entity.id,
            result: attackResult,
          });

          // Mark reaction as used
          opportunityReaction.used = true;
        }
      }
    }

    return opportunityAttacks;
  }

  /**
   * Process reactions to events
   */
  processReactions(
    event: string,
    context: {
      triggerer?: string;
      target?: string;
      position?: { x: number; y: number };
      spellId?: string;
      damage?: number;
    },
  ): Array<{ reactor: string; result: any }> {
    const reactionResults: Array<{ reactor: string; result: any }> = [];

    // Check all entities for applicable reactions
    for (const [entityId, reactions] of this.entityReactions) {
      for (const reaction of reactions) {
        if (reaction.trigger.event === event && !reaction.used) {
          // Check if reaction conditions are met
          if (this.checkReactionCondition(reaction, context, entityId)) {
            const result = this.executeReaction(entityId, reaction, context);
            reactionResults.push({
              reactor: entityId,
              result,
            });

            reaction.used = true;
          }
        }
      }
    }

    return reactionResults;
  }

  /**
   * Reset reactions at the start of a turn
   */
  resetReactions(entityId: string): void {
    const reactions = this.entityReactions.get(entityId) || [];
    reactions.forEach((reaction) => {
      reaction.used = false;
    });
  }

  /**
   * Get relationship between two entities
   */
  getRelationship(
    entityA: string,
    entityB: string,
  ): {
    attitude: "hostile" | "unfriendly" | "neutral" | "friendly" | "helpful";
    value: number;
  } | null {
    const relationships = this.entityRelationships.get(entityA);
    if (!relationships) {return null;}

    const relationship = relationships.relationships.get(entityB);
    if (!relationship) {return { attitude: "neutral", value: 0 };}

    return {
      attitude: relationship.attitude,
      value: relationship.value,
    };
  }

  /**
   * Set or modify relationship between entities
   */
  modifyRelationship(
    entityA: string,
    entityB: string,
    change: number,
    reason?: string,
  ): RelationshipChange | null {
    const relationships = this.entityRelationships.get(entityA);
    if (!relationships) {return null;}

    const current = relationships.relationships.get(entityB) || {
      attitude: "neutral" as const,
      value: 0,
      history: [],
    };

    const newValue = Math.max(-10, Math.min(10, current.value + change));
    const newAttitude = this.calculateAttitude(newValue);

    relationships.relationships.set(entityB, {
      ...current,
      value: newValue,
      attitude: newAttitude,
    });

    return {
      target: entityB,
      change,
      newAttitude,
    };
  }

  private getSkillBonus(_entityId: string, _skillType: string): number {
    // This would integrate with character system to get actual skill bonuses
    // For now, return a placeholder
    return 5; // Placeholder skill bonus
  }

  private getDefaultDC(interactionType: string, target: string): number {
    // Default DCs based on interaction type and target attitude
    const relationship = this.getRelationship(target, target);
    const _baseDC =
      {
        persuasion: 15,
        deception: 15,
        intimidation: 15,
        insight: 15,
        performance: 15,
      }[interactionType] || 15;

    // Adjust DC based on relationship
    if (relationship) {
      switch (relationship.attitude) {
        case "hostile":
          return baseDE + 5;
        case "unfriendly":
          return baseDE + 2;
        case "neutral":
          return baseDE;
        case "friendly":
          return baseDE - 2;
        case "helpful":
          return baseDE - 5;
      }
    }

    return baseDE;
  }

  private getSuccessEffects(interaction: SocialInteraction): InteractionEffect[] {
    const effects: InteractionEffect[] = [];

    switch (interaction.type) {
      case "intimidation":
        effects.push({
          type: "condition",
          target: interaction.target,
          value: "frightened",
          duration: 1, // 1 round
        });
        break;

      case "persuasion":
        effects.push({
          type: "attitude",
          target: interaction.target,
          value: "improved_cooperation",
        });
        break;

      case "insight":
        effects.push({
          type: "information",
          target: interaction.initiator,
          value: "target_intentions_revealed",
        });
        break;
    }

    return effects;
  }

  private getFailureEffects(interaction: SocialInteraction): InteractionEffect[] {
    const effects: InteractionEffect[] = [];

    // Failed intimidation might anger the target
    if (interaction.type === "intimidation") {
      effects.push({
        type: "attitude",
        target: interaction.target,
        value: "becomes_more_hostile",
      });
    }

    return effects;
  }

  private updateRelationship(
    interaction: SocialInteraction,
    success: boolean,
  ): RelationshipChange | undefined {
    let change = 0;

    if (success) {
      switch (interaction.type) {
        case "persuasion":
        case "performance":
          change = 1;
          break;
        case "intimidation":
          change = -1; // Intimidation damages relationships even when successful
          break;
      }
    } else {
      change = -1; // Failed social interactions generally hurt relationships
    }

    if (change !== 0) {
      return this.modifyRelationship(interaction.target, interaction.initiator, change);
    }

    return undefined;
  }

  private calculateDistance(
    pos1: { x: number; y: number },
    pos2: { x: number; y: number },
  ): number {
    return Math.sqrt(Math.pow(pos2.x - pos1.x, 2) + Math.pow(pos2.y - pos1.y, 2));
  }

  private checkReactionCondition(reaction: Reaction, context: any, reactorId: string): boolean {
    // Check range if applicable
    if (reaction.range && context.position) {
      // Would need to get reactor position and check distance
      // For now, assume in range
    }

    // Check specific conditions
    if (reaction.trigger.condition) {
      switch (reaction.trigger.condition) {
        case "ally_in_danger":
          return context.target !== reactorId && this.isAlly(reactorId, context.target);
        case "spell_targets_self":
          return context.target === reactorId;
        default:
          return true;
      }
    }

    return true;
  }

  private executeReaction(entityId: string, reaction: Reaction, context: any): any {
    switch (reaction.effect.type) {
      case "attack":
        return {
          type: "attack",
          attacker: entityId,
          target: context.target || context.triggerer,
          result: "opportunity_attack_made",
        };

      case "condition":
        this.conditions.applyCondition(
          context.target || context.triggerer,
          reaction.effect.value,
          1,
        );
        return {
          type: "condition_applied",
          target: context.target || context.triggerer,
          condition: reaction.effect.value,
        };

      case "damage_reduction":
        return {
          type: "damage_reduction",
          target: context.target,
          reduction: reaction.effect.value,
        };

      default:
        return {
          type: "reaction_triggered",
          reaction: reaction.name,
        };
    }
  }

  private isAlly(entityA: string, entityB: string): boolean {
    const relationship = this.getRelationship(entityA, entityB);
    return relationship && ["friendly", "helpful"].includes(relationship.attitude);
  }

  private calculateAttitude(
    value: number,
  ): "hostile" | "unfriendly" | "neutral" | "friendly" | "helpful" {
    if (value <= -6) {return "hostile";}
    if (value <= -3) {return "unfriendly";}
    if (value <= 2) {return "neutral";}
    if (value <= 6) {return "friendly";}
    return "helpful";
  }

  private addInteractionHistory(
    initiator: string,
    target: string,
    interaction: SocialInteraction,
  ): void {
    const relationships = this.entityRelationships.get(initiator);
    if (relationships) {
      const relationship = relationships.relationships.get(target);
      if (relationship) {
        relationship.history.push(interaction);
        // Keep only last 10 interactions
        if (relationship.history.length > 10) {
          relationship.history = relationship.history.slice(-10);
        }
      }
    }
  }
}

// Common reaction templates
export const COMMON_REACTIONS: Record<string, Reaction> = {
  opportunityAttack: {
    id: "opportunity_attack",
    name: "Opportunity Attack",
    description: "Make a melee attack against a creature leaving your reach",
    trigger: {
      event: "opportunity_attack",
    },
    effect: {
      type: "attack",
      target: "triggering_entity",
    },
  },

  counterspell: {
    id: "counterspell",
    name: "Counterspell",
    description: "Interrupt a spell being cast within 60 feet",
    trigger: {
      event: "spell_cast",
      range: 60,
    },
    effect: {
      type: "spell",
      target: "triggering_entity",
    },
    range: 60,
  },

  protectiveReaction: {
    id: "protective_reaction",
    name: "Protective Reaction",
    description: "Grant advantage to an ally's saving throw",
    trigger: {
      event: "damage_taken",
      condition: "ally_in_danger",
      range: 30,
    },
    effect: {
      type: "advantage_grant",
      target: "nearest_ally",
    },
  },
};

// Export singleton
export const _socialEngine = new SocialEngine();
