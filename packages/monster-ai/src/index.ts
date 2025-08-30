/**
 * Monster-Specific AI Personalities and Advanced Behaviors
 * Extends the base AI system with D&D 5e monster-specific intelligence
 */

import { AIEntity, NPCPersonality, _NPCGoal, GameStateSnapshot, AIAction } from '@vtt/ai/src/npc/AIEntity';
import { monsterAbilitiesEngine, MonsterTrait } from '@vtt/monster-abilities';
import { socialEngine } from '@vtt/social-engine';

export interface MonsterAIProfile {
  monsterId: string;
  creatureType: 'aberration' | 'beast' | 'celestial' | 'construct' | 'dragon' | 
                'elemental' | 'fey' | 'fiend' | 'giant' | 'humanoid' | 
                'monstrosity' | 'ooze' | 'plant' | 'undead';
  intelligence: 'mindless' | 'animal' | 'low' | 'average' | 'high' | 'genius';
  alignment: string;
  personalityTraits: MonsterPersonalityTraits;
  tacticalPreferences: TacticalPreferences;
  specialBehaviors: SpecialBehavior[];
  environmentalFactors: EnvironmentalFactors;
}

export interface MonsterPersonalityTraits {
  aggression: number; // 0-1, how likely to attack
  cunning: number; // 0-1, tactical intelligence
  territorial: number; // 0-1, defends area
  packMentality: number; // 0-1, works with others
  selfPreservation: number; // 0-1, retreats when injured
  curiosity: number; // 0-1, investigates unknown
  patience: number; // 0-1, waits for opportunities
  vindictive: number; // 0-1, holds grudges
}

export interface TacticalPreferences {
  preferredRange: 'melee' | 'ranged' | 'mixed';
  fightingStyle: 'aggressive' | 'defensive' | 'hit_and_run' | 'ambush' | 'support';
  targetPriority: Array<'weakest' | 'strongest' | 'spellcaster' | 'healer' | 'nearest' | 'leader'>;
  retreatThreshold: number; // HP percentage when likely to retreat
  usesTerrain: boolean;
  coordinatesWithAllies: boolean;
}

export interface SpecialBehavior {
  id: string;
  name: string;
  trigger: 'combat_start' | 'bloodied' | 'ally_dies' | 'outnumbered' | 'spell_cast_nearby' | 'custom';
  condition?: string;
  action: 'use_ability' | 'change_tactics' | 'call_for_help' | 'retreat' | 'berserk';
  parameters?: any;
}

export interface EnvironmentalFactors {
  preferredTerrain: string[];
  lightSensitivity: 'none' | 'sunlight_sensitivity' | 'prefers_darkness';
  territorialRadius: number; // distance from home they'll pursue
  homeTerrain?: { x: number; y: number; radius: number };
}

export class MonsterAI extends AIEntity {
  private monsterProfile: MonsterAIProfile;
  private availableAbilities: MonsterTrait[] = [];
  private combatState: {
    isBloodied: boolean;
    hasUsedSpecialAbility: boolean;
    roundsInCombat: number;
    lastTargetId?: string;
    grudgeTargets: Set<string>;
  };

  constructor(
    id: string,
    monsterProfile: MonsterAIProfile,
    abilities: MonsterTrait[] = []
  ) {
    // Convert monster personality to base NPCPersonality
    const basePersonality: NPCPersonality = {
      aggression: monsterProfile.personalityTraits.aggression,
      intelligence: MonsterAI.intelligenceToNumeric(monsterProfile.intelligence),
      caution: monsterProfile.personalityTraits.selfPreservation,
      loyalty: monsterProfile.personalityTraits.packMentality
    };

    super(id, basePersonality, [], 500); // Think every 500ms for monsters

    this.monsterProfile = monsterProfile;
    this.availableAbilities = abilities;
    this.combatState = {
      isBloodied: false,
      hasUsedSpecialAbility: false,
      roundsInCombat: 0,
      grudgeTargets: new Set()
    };

    this.initializeMonsterBehaviors();
  }

  private static intelligenceToNumeric(intelligence: MonsterAIProfile['intelligence']): number {
    const mapping = {
      'mindless': 0.1,
      'animal': 0.3,
      'low': 0.4,
      'average': 0.5,
      'high': 0.7,
      'genius': 0.9
    };
    return mapping[intelligence];
  }

  private initializeMonsterBehaviors(): void {
    // Initialize monster abilities engine
    monsterAbilitiesEngine.initializeMonster(
      this.entityId,
      this.availableAbilities,
      this.getLegendaryActionsPerTurn(),
      this.getLairActions()
    );

    // Initialize social engine for relationship tracking
    socialEngine.initializeEntity(this.entityId, this.getReactions());
  }

  /**
   * Enhanced monster decision making
   */
  protected selectAction(gameState: GameStateSnapshot): AIAction | null {
    this.updateCombatState(gameState);
    
    // Check for special behavior triggers
    const specialAction = this.checkSpecialBehaviors(gameState);
    if (specialAction) return specialAction;

    // Use monster-specific tactical AI
    return this.selectTacticalAction(gameState);
  }

  private updateCombatState(gameState: GameStateSnapshot): void {
    // Update bloodied status
    const wasBloodied = this.combatState.isBloodied;
    this.combatState.isBloodied = gameState.healthPercentage <= 0.5;
    
    // Trigger bloodied behavior if just became bloodied
    if (!wasBloodied && this.combatState.isBloodied) {
      this.processSpecialBehavior('bloodied', gameState);
    }

    // Track combat rounds
    if (gameState.nearbyEnemies.length > 0) {
      this.combatState.roundsInCombat++;
    }
  }

  private selectTacticalAction(gameState: GameStateSnapshot): AIAction | null {
    const _preferences = this.monsterProfile.tacticalPreferences;
    
    // Check retreat conditions
    if (this.shouldRetreat(gameState)) {
      return this.createRetreatAction(gameState);
    }

    // Select target based on priorities
    const target = this.selectTarget(gameState);
    if (!target) return this.createPatrolAction();

    // Choose action based on fighting style and available abilities
    return this.selectCombatAction(target, gameState);
  }

  private shouldRetreat(gameState: GameStateSnapshot): boolean {
    const traits = this.monsterProfile.personalityTraits;
    
    // Check HP threshold
    if (gameState.healthPercentage <= this.monsterProfile.tacticalPreferences.retreatThreshold) {
      return traits.selfPreservation > 0.5;
    }

    // Check if severely outnumbered
    const enemyCount = gameState.nearbyEnemies.length;
    const allyCount = gameState.nearbyAllies.length;
    if (enemyCount > allyCount + 2 && traits.selfPreservation > 0.7) {
      return true;
    }

    return false;
  }

  private selectTarget(gameState: GameStateSnapshot): any {
    const enemies = gameState.nearbyEnemies;
    if (enemies.length === 0) return null;

    const priorities = this.monsterProfile.tacticalPreferences.targetPriority;
    
    for (const priority of priorities) {
      const target = this.findTargetByPriority(enemies, priority);
      if (target) return target;
    }

    return enemies[0]; // Fallback to first enemy
  }

  private findTargetByPriority(enemies: any[], priority: string): any {
    switch (priority) {
      case 'weakest':
        return enemies.reduce((_min, _enemy) => 
          enemy.health < min.health ? enemy : min
        );
      
      case 'strongest':
        return enemies.reduce((_max, _enemy) => 
          enemy.health > max.health ? enemy : max
        );
      
      case 'nearest':
        return enemies.reduce((_nearest, _enemy) => 
          enemy.distance < nearest.distance ? enemy : nearest
        );

      case 'spellcaster':
        // Would need additional data to identify spellcasters
        return enemies.find(e => e.class === 'wizard' || e.class === 'sorcerer');

      default:
        return null;
    }
  }

  private selectCombatAction(target: any, gameState: GameStateSnapshot): AIAction {
    const fightingStyle = this.monsterProfile.tacticalPreferences.fightingStyle;
    
    // Check for special ability usage
    const specialAbility = this.selectSpecialAbility(target, gameState);
    if (specialAbility) return specialAbility;

    // Select action based on fighting style
    switch (fightingStyle) {
      case 'aggressive':
        return this.createAggressiveAction(target);
      
      case 'defensive':
        return this.createDefensiveAction(target);
      
      case 'hit_and_run':
        return this.createHitAndRunAction(target, gameState);
      
      case 'ambush':
        return this.createAmbushAction(target, gameState);
      
      case 'support':
        return this.createSupportAction(gameState);
      
      default:
        return this.createBasicAttackAction(target);
    }
  }

  private selectSpecialAbility(target: any, gameState: GameStateSnapshot): AIAction | null {
    const availableAbilities = monsterAbilitiesEngine.getAvailableAbilities(this.entityId);
    
    // Prioritize recharged abilities
    for (const ability of availableAbilities.traits) {
      if (this.shouldUseAbility(ability, target, gameState)) {
        return {
          type: 'attack',
          targetId: target.id,
          priority: 9,
          data: { 
            abilityId: ability.id,
            abilityType: 'special'
          }
        };
      }
    }

    // Check legendary actions if available
    if (availableAbilities.legendaryActionsRemaining > 0) {
      const legendaryAction = this.selectLegendaryAction(availableAbilities.legendary, target);
      if (legendaryAction) return legendaryAction;
    }

    return null;
  }

  private shouldUseAbility(ability: MonsterTrait, target: any, gameState: GameStateSnapshot): boolean {
    // Intelligent monsters use abilities more strategically
    const intelligence = this.monsterProfile.personalityTraits.cunning;
    
    // Always use area abilities when multiple enemies present
    if (ability.area && gameState.nearbyEnemies.length >= 2) {
      return Math.random() < 0.8;
    }

    // Use powerful single-target abilities on strong enemies
    if (ability.mechanicalEffect?.damage && target.health > 50) {
      return Math.random() < intelligence;
    }

    // Save special abilities for when bloodied if intelligent
    if (intelligence > 0.6 && !this.combatState.isBloodied) {
      return Math.random() < 0.3;
    }

    return Math.random() < 0.5;
  }

  private createAggressiveAction(target: any): AIAction {
    return {
      type: 'attack',
      targetId: target.id,
      priority: 8,
      data: { attackType: 'aggressive', modifiers: { damage: 2 } }
    };
  }

  private createHitAndRunAction(target: any, gameState: GameStateSnapshot): AIAction {
    // Attack then move to new position
    return {
      type: 'attack',
      targetId: target.id,
      priority: 7,
      data: { 
        attackType: 'hit_and_run',
        followUpAction: 'move',
        moveTarget: this.findTacticalPosition(gameState)
      }
    };
  }

  private findTacticalPosition(gameState: GameStateSnapshot): { x: number; y: number } {
    // Simple tactical positioning - away from enemies, near allies
    const current = gameState.position;
    let bestPos = current;
    let bestScore = -1000;

    // Check several potential positions
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const distance = 40; // Move 40 units
      const pos = {
        x: current.x + Math.cos(angle) * distance,
        y: current.y + Math.sin(angle) * distance
      };

      const score = this.evaluatePosition(pos, gameState);
      if (score > bestScore) {
        bestScore = score;
        bestPos = pos;
      }
    }

    return bestPos;
  }

  private evaluatePosition(pos: { x: number; y: number }, gameState: GameStateSnapshot): number {
    let score = 0;

    // Prefer positions away from enemies
    for (const enemy of gameState.nearbyEnemies) {
      const distance = Math.sqrt(
        Math.pow(pos.x - enemy.id.x || 0, 2) + 
        Math.pow(pos.y - enemy.id.y || 0, 2)
      );
      score += distance * 0.1; // Farther from enemies is better
    }

    // Prefer positions near allies
    for (const ally of gameState.nearbyAllies) {
      const distance = Math.sqrt(
        Math.pow(pos.x - ally.id.x || 0, 2) + 
        Math.pow(pos.y - ally.id.y || 0, 2)
      );
      score -= distance * 0.05; // Closer to allies is better
    }

    return score;
  }

  private checkSpecialBehaviors(gameState: GameStateSnapshot): AIAction | null {
    for (const behavior of this.monsterProfile.specialBehaviors) {
      if (this.checkBehaviorTrigger(behavior, gameState)) {
        return this.executeBehaviorAction(behavior, gameState);
      }
    }
    return null;
  }

  private checkBehaviorTrigger(behavior: SpecialBehavior, gameState: GameStateSnapshot): boolean {
    switch (behavior.trigger) {
      case 'bloodied':
        return this.combatState.isBloodied && !this.combatState.hasUsedSpecialAbility;
      
      case 'outnumbered':
        return gameState.nearbyEnemies.length > gameState.nearbyAllies.length + 1;
      
      case 'ally_dies':
        // Would need additional context to detect ally deaths
        return false;
      
      default:
        return false;
    }
  }

  private processSpecialBehavior(trigger: string, gameState: GameStateSnapshot): void {
    const behavior = this.monsterProfile.specialBehaviors.find(b => b.trigger === trigger);
    if (behavior) {
      this.executeBehaviorAction(behavior, gameState);
    }
  }

  private executeBehaviorAction(behavior: SpecialBehavior, gameState: GameStateSnapshot): AIAction | null {
    switch (behavior.action) {
      case 'berserk':
        // Increase aggression and ignore defensive considerations
        this.updatePersonality({ aggression: 1.0 });
        return this.createAggressiveAction(gameState.nearbyEnemies[0]);
      
      case 'call_for_help':
        return {
          type: 'interact',
          priority: 10,
          data: { 
            action: 'call_reinforcements',
            range: behavior.parameters?.range || 100
          }
        };
      
      case 'retreat':
        return this.createRetreatAction(gameState);
      
      case 'use_ability': {
        const abilityId = behavior.parameters?.abilityId;
        if (abilityId) {
          return {
            type: 'attack',
            targetId: gameState.nearbyEnemies[0]?.id,
            priority: 10,
            data: { abilityId, abilityType: 'special' }
          };
        }
    }
        break;
    }
    
    return null;
  }

  private createRetreatAction(gameState: GameStateSnapshot): AIAction {
    // Move toward home territory or away from enemies
    const retreatPos = this.monsterProfile.environmentalFactors.homeTerrain || 
      this.findTacticalPosition(gameState);
    
    return {
      type: 'move',
      target: retreatPos,
      priority: 9,
      data: { moveType: 'retreat', speed: 'dash' }
    };
  }

  private createPatrolAction(): AIAction {
    const homeTerritory = this.monsterProfile.environmentalFactors.homeTerrain;
    
    if (homeTerritory) {
      // Patrol around home territory
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * homeTerritory.radius;
      
      return {
        type: 'move',
        target: {
          x: homeTerritory.x + Math.cos(angle) * distance,
          y: homeTerritory.y + Math.sin(angle) * distance
        },
        priority: 2,
        data: { moveType: 'patrol' }
      };
    }
    
    return {
      type: 'move',
      target: { x: Math.random() * 100, y: Math.random() * 100 },
      priority: 1,
      data: { moveType: 'wander' }
    };
  }

  private createBasicAttackAction(target: any): AIAction {
    return {
      type: 'attack',
      targetId: target.id,
      priority: 5,
      data: { attackType: 'basic' }
    };
  }

  private createDefensiveAction(target: any): AIAction {
    return {
      type: 'defend',
      priority: 6,
      data: { 
        targetThreat: target.id,
        defensiveBonus: 2
      }
    };
  }

  private createSupportAction(gameState: GameStateSnapshot): AIAction {
    // Find wounded ally
    const woundedAlly = gameState.nearbyAllies.find(ally => ally.health < 50);
    
    if (woundedAlly) {
      return {
        type: 'support',
        targetId: woundedAlly.id,
        priority: 7,
        data: { supportType: 'heal' }
      };
    }

    // Default to buff nearest ally
    return {
      type: 'support',
      targetId: gameState.nearbyAllies[0]?.id,
      priority: 4,
      data: { supportType: 'buff' }
    };
  }

  private selectLegendaryAction(legendaryActions: MonsterTrait[], target: any): AIAction | null {
    if (legendaryActions.length === 0) return null;

    // Simple selection - prefer attack actions
    const attackAction = legendaryActions.find(action => 
      action.mechanicalEffect?.type === 'damage'
    );

    if (attackAction) {
      return {
        type: 'attack',
        targetId: target.id,
        priority: 8,
        data: { 
          abilityId: attackAction.id,
          abilityType: 'legendary'
        }
      };
    }

    // Use first available legendary action
    return {
      type: 'attack',
      targetId: target.id,
      priority: 6,
      data: { 
        abilityId: legendaryActions[0].id,
        abilityType: 'legendary'
      }
    };
  }

  private getLegendaryActionsPerTurn(): number {
    // Most legendary creatures have 3 actions per turn
    return this.availableAbilities.filter(a => a.type === 'legendary_action').length > 0 ? 3 : 0;
  }

  private getLairActions(): MonsterTrait[] {
    return this.availableAbilities.filter(a => a.type === 'lair_action');
  }

  private getReactions(): any[] {
    // Convert monster traits to social engine reactions
    return this.availableAbilities
      .filter(a => a.type === 'reaction')
      .map(trait => ({
        id: trait.id,
        name: trait.name,
        description: trait.description,
        trigger: { event: 'opportunity_attack' }, // Simplified
        effect: { type: 'attack', target: 'triggering_entity' }
      }));
  }

  /**
   * Add a grudge against a specific target
   */
  addGrudge(targetId: string): void {
    this.combatState.grudgeTargets.add(targetId);
    // Increase focus on this target
    socialEngine.modifyRelationship(this.entityId, targetId, -3, 'combat_grudge');
  }

  /**
   * Get current monster profile
   */
  getMonsterProfile(): MonsterAIProfile {
    return this.monsterProfile;
  }
}

// Monster AI Profile Templates
export const MONSTER_AI_PROFILES: Record<string, MonsterAIProfile> = {
  goblin: {
    monsterId: 'goblin',
    creatureType: 'humanoid',
    intelligence: 'low',
    alignment: 'neutral evil',
    personalityTraits: {
      aggression: 0.6,
      cunning: 0.4,
      territorial: 0.3,
      packMentality: 0.8,
      selfPreservation: 0.7,
      curiosity: 0.5,
      patience: 0.2,
      vindictive: 0.6
    },
    tacticalPreferences: {
      preferredRange: 'ranged',
      fightingStyle: 'hit_and_run',
      targetPriority: ['weakest', 'spellcaster', 'nearest'],
      retreatThreshold: 0.3,
      usesTerrain: true,
      coordinatesWithAllies: true
    },
    specialBehaviors: [
      {
        id: 'mob_tactics',
        name: 'Mob Tactics',
        trigger: 'outnumbered',
        action: 'call_for_help',
        parameters: { range: 60 }
      }
    ],
    environmentalFactors: {
      preferredTerrain: ['forest', 'caves', 'ruins'],
      lightSensitivity: 'none',
      territorialRadius: 200
    }
  },

  dragon: {
    monsterId: 'dragon',
    creatureType: 'dragon',
    intelligence: 'genius',
    alignment: 'chaotic evil',
    personalityTraits: {
      aggression: 0.8,
      cunning: 0.9,
      territorial: 0.9,
      packMentality: 0.2,
      selfPreservation: 0.6,
      curiosity: 0.3,
      patience: 0.8,
      vindictive: 0.9
    },
    tacticalPreferences: {
      preferredRange: 'mixed',
      fightingStyle: 'aggressive',
      targetPriority: ['strongest', 'leader', 'spellcaster'],
      retreatThreshold: 0.15,
      usesTerrain: true,
      coordinatesWithAllies: false
    },
    specialBehaviors: [
      {
        id: 'frightful_presence',
        name: 'Frightful Presence',
        trigger: 'combat_start',
        action: 'use_ability',
        parameters: { abilityId: 'frightful_presence' }
      },
      {
        id: 'desperate_breath',
        name: 'Desperate Breath Weapon',
        trigger: 'bloodied',
        action: 'use_ability',
        parameters: { abilityId: 'breath_weapon' }
      }
    ],
    environmentalFactors: {
      preferredTerrain: ['mountain', 'cave', 'lair'],
      lightSensitivity: 'none',
      territorialRadius: 1000,
      homeTerrain: { x: 0, y: 0, radius: 500 }
    }
  }
};

export const _monsterAI = {
  createMonsterAI: (
    id: string, 
    profileName: keyof typeof MONSTER_AI_PROFILES, 
    abilities: MonsterTrait[] = []
  ): MonsterAI => {
    const profile = MONSTER_AI_PROFILES[profileName];
    if (!profile) {
      throw new Error(`Unknown monster AI profile: ${profileName}`);
    }
    return new MonsterAI(id, profile, abilities);
  }
};
