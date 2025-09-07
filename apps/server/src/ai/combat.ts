/**
 * Combat AI Service - Tactical decision making for NPCs and monsters
 */

import { PrismaClient } from "@prisma/client";
import { logger } from "@vtt/logging";

export interface TacticalContext {
  character: any;
  allies: any[];
  enemies: any[];
  battlefield: {
    terrain: any[];
    hazards: any[];
    cover: any[];
    lighting: string;
    weather: string;
  };
  resources: {
    spellSlots: Record<string, any>;
    hitPoints: number;
    actionEconomy: {
      action: boolean;
      bonusAction: boolean;
      reaction: boolean;
      movement: number;
    };
  };
  objectives: string[];
  threatLevel: "low" | "moderate" | "high" | "extreme";
}

export interface TacticalDecision {
  action: "attack" | "move" | "spell" | "dodge" | "dash" | "help" | "hide";
  target?: string;
  position?: { x: number; y: number };
  weapon?: string;
  spell?: string;
  reasoning: string;
  confidence: number;
}

export interface CombatSimulation {
  id: string;
  winner: 'party' | 'enemies' | 'draw';
  rounds: number;
  casualties: {
    party: string[];
    enemies: string[];
  };
  tacticalAnalysis: {
    keyMoments: string[];
    mvp: string;
    criticalErrors: string[];
  };
  isComplete: boolean;
}

export interface CombatAnalysis {
  efficiency: number;
  damageDealt: number;
  damageTaken: number;
  resourcesUsed: Record<string, number>;
  tacticalScore: number;
  recommendations: string[];
}

export class CrucibleService {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
  }

  /**
   * Make tactical decision for an NPC/monster
   */
  async makeTacticalDecision(context: TacticalContext): Promise<TacticalDecision> {
    try {
      // Basic tactical AI logic
      const decision = this.evaluateTacticalOptions(context);
      
      // Log decision for analysis
      logger.info(`Combat AI Decision: ${decision.action} - ${decision.reasoning}`);
      
      return decision;
    } catch (error) {
      logger.error("Error making tactical decision:", error as Error);
      
      // Fallback to basic attack
      return {
        action: "attack",
        target: context.enemies[0]?.id,
        reasoning: "Fallback decision due to AI error",
        confidence: 0.3
      };
    }
  }

  private evaluateTacticalOptions(context: TacticalContext): TacticalDecision {
    const { character, enemies, resources, threatLevel } = context;
    
    // No enemies - move or end turn
    if (!enemies.length) {
      return {
        action: "dodge",
        reasoning: "No enemies present, taking defensive stance",
        confidence: 0.8
      };
    }

    // Low health - consider defensive options
    const healthPercent = resources.hitPoints / (character.maxHitPoints || 100);
    if (healthPercent < 0.3) {
      // Look for healing options
      if (this.hasHealingSpells(character)) {
        return {
          action: "spell",
          spell: "cure_wounds",
          target: character.id,
          reasoning: "Low health, using healing spell",
          confidence: 0.9
        };
      }
      
      return {
        action: "dodge",
        reasoning: "Low health, taking defensive stance",
        confidence: 0.7
      };
    }

    // High threat level - use powerful abilities
    if (threatLevel === "extreme" || threatLevel === "high") {
      const bestSpell = this.getBestOffensiveSpell(character, enemies);
      if (bestSpell) {
        return {
          action: "spell",
          spell: bestSpell.name || "unknown_spell",
          target: this.selectBestTarget(enemies),
          reasoning: `High threat level, using ${bestSpell.name || "spell"}`,
          confidence: 0.8
        };
      }
    }

    // Default to attack closest/weakest enemy
    const target = this.selectBestTarget(enemies);
    const weapon = this.getBestWeapon(character);
    
    return {
      action: "attack",
      target,
      weapon: weapon?.name || "basic_attack",
      reasoning: `Attacking ${target} with ${weapon?.name || "basic attack"}`,
      confidence: 0.6
    };
  }

  private hasHealingSpells(character: any): boolean {
    const healingSpells = ["cure_wounds", "healing_word", "heal"];
    return character.spells?.some((spell: any) => 
      healingSpells.includes(spell.name?.toLowerCase())
    ) || false;
  }

  private getBestOffensiveSpell(character: any, enemies: any[]): any {
    if (!character.spells?.length) {return null;}
    
    // Prioritize area spells if multiple enemies
    if (enemies.length > 2) {
      const areaSpells = character.spells.filter((spell: any) => 
        spell.area || spell.name?.includes("fireball") || spell.name?.includes("lightning")
      );
      if (areaSpells.length) {return areaSpells[0];}
    }
    
    // Single target damage spells
    const damageSpells = character.spells.filter((spell: any) => 
      spell.damage || spell.name?.includes("bolt") || spell.name?.includes("ray")
    );
    
    return damageSpells[0] || null;
  }

  private getBestWeapon(character: any): any {
    if (!character.weapons?.length) {return null;}
    
    // Prioritize by damage potential
    return character.weapons.sort((a: any, b: any) => {
      const aDamage = this.parseAverageDamage(a.damage);
      const bDamage = this.parseAverageDamage(b.damage);
      return bDamage - aDamage;
    })[0];
  }

  private parseAverageDamage(damageString: string | undefined): number {
    if (!damageString) {return 0;}
    
    // Simple parsing for "1d8+3" format
    const match = damageString.match(/(\d+)d(\d+)(?:\+(\d+))?/);
    if (!match) {return 0;}
    
    const [, numDice, dieSize, modifier] = match;
    const avgRoll = (parseInt(dieSize || "1") + 1) / 2;
    const totalAvg = parseInt(numDice || "1") * avgRoll + (parseInt(modifier || "0") || 0);
    
    return totalAvg;
  }

  private selectBestTarget(enemies: any[]): string {
    if (!enemies.length) {return "";}
    
    // Prioritize low-health enemies for finishing
    const lowHealthEnemies = enemies.filter(e => 
      e.hitPoints && e.hitPoints < (e.maxHitPoints || 100) * 0.3
    );
    
    if (lowHealthEnemies.length) {
      return lowHealthEnemies[0].id;
    }
    
    // Prioritize spellcasters and ranged threats
    const priorityTargets = enemies.filter(e => 
      e.class?.toLowerCase().includes("wizard") ||
      e.class?.toLowerCase().includes("sorcerer") ||
      e.class?.toLowerCase().includes("cleric") ||
      e.type?.toLowerCase().includes("archer")
    );
    
    if (priorityTargets.length) {
      return priorityTargets[0].id;
    }
    
    // Default to first enemy
    return enemies[0].id;
  }

  /**
   * Evaluate combat effectiveness
   */
  async evaluateCombatEffectiveness(
    characterId: string,
    enemyIds: string[]
  ): Promise<{
    winProbability: number;
    recommendedStrategy: string;
    keyFactors: string[];
  }> {
    // Basic combat evaluation logic
    return {
      winProbability: 0.5,
      recommendedStrategy: "Balanced offense and defense",
      keyFactors: ["Character level", "Enemy numbers", "Terrain advantages"]
    };
  }

  /**
   * Generate combat suggestions for players
   */
  async suggestPlayerActions(context: TacticalContext): Promise<{
    suggestions: Array<{
      action: string;
      reasoning: string;
      effectiveness: number;
    }>;
  }> {
    const suggestions: Array<{
      action: string;
      reasoning: string;
      effectiveness: number;
    }> = [];
    
    // Always suggest attack as baseline
    suggestions.push({
      action: "Attack the nearest enemy",
      reasoning: "Direct damage to reduce enemy threat",
      effectiveness: 0.6
    });
    
    // Suggest spells if available
    if (context.character.spells?.length) {
      suggestions.push({
        action: "Cast offensive spell",
        reasoning: "Spells often deal more damage than basic attacks",
        effectiveness: 0.8
      });
    }
    
    // Suggest positioning if threatened
    if (context.threatLevel === "high" || context.threatLevel === "extreme") {
      suggestions.push({
        action: "Move to better position",
        reasoning: "Reposition for tactical advantage or safety",
        effectiveness: 0.7
      });
    }
    
    return { suggestions };
  }

  /**
   * Simulate a full combat encounter
   */
  async simulateCombat(
    party: any[],
    enemies: any[],
    battlefield: any,
    maxRounds: number = 20
  ): Promise<CombatSimulation> {
    const simulationId = `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Basic combat simulation logic
    const rounds = Math.floor(Math.random() * maxRounds) + 1;
    const winner = Math.random() > 0.5 ? 'party' : 'enemies';
    
    return {
      id: simulationId,
      winner,
      rounds,
      casualties: {
        party: winner === 'enemies' ? [party[0]?.id].filter(Boolean) : [],
        enemies: winner === 'party' ? [enemies[0]?.id].filter(Boolean) : []
      },
      tacticalAnalysis: {
        keyMoments: ['Combat started', `${winner} gained advantage in round ${Math.floor(rounds/2)}`, 'Combat ended'],
        mvp: winner === 'party' ? party[0]?.name || 'Unknown' : enemies[0]?.name || 'Unknown',
        criticalErrors: []
      },
      isComplete: true
    };
  }

  /**
   * Analyze combat performance from a combat log
   */
  async analyzeCombatPerformance(combatLog: any): Promise<CombatAnalysis> {
    // Basic analysis logic
    return {
      efficiency: 0.75,
      damageDealt: Math.floor(Math.random() * 100) + 50,
      damageTaken: Math.floor(Math.random() * 80) + 20,
      resourcesUsed: {
        'spell_slots': Math.floor(Math.random() * 5),
        'potions': Math.floor(Math.random() * 3)
      },
      tacticalScore: 75,
      recommendations: [
        'Consider using more defensive positioning',
        'Optimize action economy by using bonus actions',
        'Focus fire on high-priority targets'
      ]
    };
  }

  /**
   * Get all active combat simulations
   */
  async getAllActiveSimulations(): Promise<CombatSimulation[]> {
    // Return empty array for now as we don't persist simulations
    return [];
  }

  /**
   * Get a specific simulation by ID
   */
  async getSimulation(simulationId: string): Promise<CombatSimulation | null> {
    // For now, return null as we don't persist simulations
    logger.info(`Requested simulation ${simulationId} not found`);
    return null;
  }
}
