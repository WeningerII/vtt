/**
 * Properly structured Monster AI implementation
 * Extends AIEntity with D&D 5e monster-specific intelligence
 */

import { AIEntity, NPCPersonality, NPCGoal, AIAction, GameStateSnapshot } from "@vtt/ai";

// Enemy interface for type safety
export interface Enemy {
  id: string;
  health: number;
  distance: number;
  class?: string;
}

// Special ability interface for type safety
export interface SpecialAbility {
  id: string;
  name: string;
  type: "passive" | "action" | "legendary" | "lair";
  cooldown?: number;
  uses?: number;
}

export interface MonsterPersonality extends NPCPersonality {
  // Monster-specific traits beyond base NPCPersonality
  territorialism: number; // 0-1, how territorial
  cunning: number; // 0-1, tactical intelligence
  brutality: number; // 0-1, preference for violence
  packMentality: number; // 0-1, tendency to work with others
}

export interface MonsterProfile {
  monsterId: string;
  creatureType:
    | "aberration"
    | "beast"
    | "celestial"
    | "construct"
    | "dragon"
    | "elemental"
    | "fey"
    | "fiend"
    | "giant"
    | "humanoid"
    | "monstrosity"
    | "ooze"
    | "plant"
    | "undead";
  intelligence: "mindless" | "animal" | "low" | "average" | "high" | "genius";
  alignment: string;
  personalityTraits: MonsterPersonality;
  tacticalPreferences: {
    preferredRange: "melee" | "ranged" | "mixed";
    fightingStyle: "aggressive" | "defensive" | "hit_and_run" | "ambush" | "support";
    targetPriority: Array<
      "weakest" | "strongest" | "spellcaster" | "healer" | "nearest" | "leader"
    >;
  };
  specialAbilities: SpecialAbility[];
}

export class MonsterAI extends AIEntity {
  private monsterProfile: MonsterProfile;

  constructor(
    id: string,
    monsterProfile: MonsterProfile,
    initialGoals: NPCGoal[] = [],
    thinkInterval: number = 1000,
  ) {
    super(id, monsterProfile.personalityTraits, initialGoals, thinkInterval);
    this.monsterProfile = monsterProfile;
  }

  override update(gameState: GameStateSnapshot, deltaTime: number): void {
    // Monster-specific pre-processing
    this.processMonsterBehaviors(gameState);

    // Call parent update
    super.update(gameState, deltaTime);
  }

  private processMonsterBehaviors(gameState: GameStateSnapshot): void {
    // Handle pack behavior
    if (this.monsterProfile.personalityTraits.packMentality > 0.7) {
      this.handlePackBehavior(gameState);
    }

    // Handle territorial behavior
    if (this.monsterProfile.personalityTraits.territorialism > 0.5) {
      this.handleTerritorialBehavior(gameState);
    }
  }

  private handlePackBehavior(gameState: GameStateSnapshot): void {
    // Look for allies and coordinate
    const nearbyAllies = gameState.nearbyAllies;
    if (nearbyAllies.length > 0) {
      // Adjust aggression based on pack size
      const _packBonus = Math.min(nearbyAllies.length * 0.1, 0.3);
      // Would modify behavior based on pack presence
    }
  }

  private handleTerritorialBehavior(gameState: GameStateSnapshot): void {
    // Check if enemies are in territory
    if (gameState.nearbyEnemies.length > 0) {
      // Increase aggression when territory is threatened
      this.setGoal({
        id: `defend-territory-${Date.now()}`,
        type: "defend",
        priority: 8,
        target: "territory",
        isActive: true,
        isComplete: false,
      });
    }
  }

  protected selectMonsterAction(gameState: GameStateSnapshot): AIAction | null {
    // Monster-specific action selection logic
    const intelligence = this.monsterProfile.intelligence;

    // Mindless creatures have very simple behavior
    if (intelligence === "mindless") {
      return this.selectMindlessAction(gameState);
    }

    // Animal intelligence - basic threat response
    if (intelligence === "animal") {
      return this.selectAnimalAction(gameState);
    }

    // Higher intelligence uses tactical preferences
    return this.selectTacticalAction(gameState);
  }

  private selectMindlessAction(gameState: GameStateSnapshot): AIAction | null {
    // Very simple: attack nearest enemy or move randomly
    if (gameState.nearbyEnemies.length > 0 && gameState.canAttack) {
      const target = gameState.nearbyEnemies[0];
      if (target?.id) {
        return {
          type: "attack",
          targetId: target.id,
          priority: 5,
        };
      }
    }

    return {
      type: "move",
      target: { x: Math.random() * 100, y: Math.random() * 100 },
      priority: 1,
    };
  }

  private selectAnimalAction(gameState: GameStateSnapshot): AIAction | null {
    // Fight or flight based on health and threat level
    const healthRatio = gameState.healthPercentage;
    const threatLevel = gameState.nearbyEnemies.length;

    if (healthRatio < 0.3 && threatLevel > 1) {
      // Flee when heavily outnumbered and injured
      return {
        type: "move",
        target: { x: Math.random() * 200, y: Math.random() * 200 },
        priority: 9,
      };
    }

    if (gameState.nearbyEnemies.length > 0 && gameState.canAttack) {
      const target = gameState.nearbyEnemies[0];
      if (target?.id) {
        return {
          type: "attack",
          targetId: target.id,
          priority: 6,
        };
      }
    }

    return null;
  }

  private selectTacticalAction(gameState: GameStateSnapshot): AIAction | null {
    const tactics = this.monsterProfile.tacticalPreferences;

    // Use target priority to select best target
    if (gameState.nearbyEnemies.length > 0) {
      const target = this.selectTargetByPriority(gameState.nearbyEnemies, tactics.targetPriority);

      if (target && gameState.canAttack) {
        // Check for special abilities
        const specialAction = this.trySpecialAbility(target, gameState);
        if (specialAction) {
          return specialAction;
        }

        // Default attack
        return {
          type: "attack",
          targetId: target.id,
          priority: 7,
        };
      }
    }

    return null;
  }

  private selectTargetByPriority(enemies: Enemy[], priorities: string[]): Enemy | null {
    for (const priority of priorities) {
      const target = this.findTargetByPriority(enemies, priority);
      if (target) {
        return target;
      }
    }
    return enemies[0] || null; // Fallback
  }

  private findTargetByPriority(enemies: Enemy[], priority: string): Enemy | null {
    if (enemies.length === 0) {
      return null;
    }

    switch (priority) {
      case "weakest":
        return enemies.reduce((min, enemy) => (enemy.health < min.health ? enemy : min));
      case "strongest":
        return enemies.reduce((max, enemy) => (enemy.health > max.health ? enemy : max));
      case "nearest":
        return enemies.reduce((nearest, enemy) =>
          enemy.distance < nearest.distance ? enemy : nearest,
        );
      case "spellcaster":
        return enemies.find((e) => e.class === "wizard" || e.class === "sorcerer") || null;
      default:
        return null;
    }
  }

  private trySpecialAbility(target: Enemy, _gameState: GameStateSnapshot): AIAction | null {
    // Check available special abilities
    const availableAbilities = this.monsterProfile.specialAbilities.filter(
      (ability) => ability.type === "action" && this.canUseAbility(ability),
    );

    if (availableAbilities.length > 0) {
      const ability = availableAbilities[0]; // Use first available
      if (ability?.id && target?.id) {
        return {
          type: "attack",
          targetId: target.id,
          priority: 8,
          data: {
            abilityId: ability.id,
            abilityType: "special",
          },
        };
      }
    }

    return null;
  }

  private canUseAbility(_ability: SpecialAbility): boolean {
    // Check cooldowns, uses, etc.
    // Simplified for now
    return true;
  }

  // Public methods for game integration
  getMonsterProfile(): MonsterProfile {
    return this.monsterProfile;
  }

  updateMonsterPersonality(updates: Partial<MonsterPersonality>): void {
    this.monsterProfile.personalityTraits = {
      ...this.monsterProfile.personalityTraits,
      ...updates,
    };
    this.updatePersonality(updates);
  }
}

// Factory for creating common monster archetypes
export class MonsterArchetypes {
  static createGoblin(): MonsterProfile {
    return {
      monsterId: "goblin",
      creatureType: "humanoid",
      intelligence: "low",
      alignment: "neutral evil",
      personalityTraits: {
        id: "goblin-personality",
        name: "Goblin",
        aggression: 0.7,
        intelligence: 0.3,
        caution: 0.8,
        traits: {
          curiosity: 0.4,
          loyalty: 0.6,
          courage: 0.3,
          empathy: 0.1,
        },
        motivations: ["survival", "treasure"],
        fears: ["death", "stronger enemies"],
        goals: [],
        relationships: new Map(),
        territorialism: 0.6,
        cunning: 0.5,
        brutality: 0.4,
        packMentality: 0.8,
      },
      tacticalPreferences: {
        preferredRange: "ranged",
        fightingStyle: "hit_and_run",
        targetPriority: ["weakest", "spellcaster", "nearest"],
      },
      specialAbilities: [],
    };
  }

  static createDragon(): MonsterProfile {
    return {
      monsterId: "dragon",
      creatureType: "dragon",
      intelligence: "genius",
      alignment: "chaotic evil",
      personalityTraits: {
        id: "dragon-personality",
        name: "Dragon",
        aggression: 0.9,
        intelligence: 0.9,
        caution: 0.3,
        traits: {
          curiosity: 0.7,
          loyalty: 0.2,
          courage: 0.9,
          empathy: 0.1,
        },
        motivations: ["power", "treasure", "dominance"],
        fears: ["humiliation"],
        goals: [],
        relationships: new Map(),
        territorialism: 0.9,
        cunning: 0.8,
        brutality: 0.8,
        packMentality: 0.1,
      },
      tacticalPreferences: {
        preferredRange: "mixed",
        fightingStyle: "aggressive",
        targetPriority: ["strongest", "leader", "spellcaster"],
      },
      specialAbilities: [
        {
          id: "breath-weapon",
          name: "Breath Weapon",
          type: "action",
          cooldown: 3,
        },
      ],
    };
  }
}
