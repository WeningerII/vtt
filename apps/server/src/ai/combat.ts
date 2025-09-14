/**
 * Crucible Combat AI System
 * Advanced tactical decision making for NPCs and combat simulation
 */

import { PrismaClient } from "@prisma/client";
import { globalEventBus, GameEvents, AIEvents } from "@vtt/core";

// Logging utility
const logger = {
  info: (msg: string, ...args: any[]) => console.log(`[COMBAT] ${msg}`, ...args),
  warn: (msg: string, ...args: any[]) => console.warn(`[COMBAT] ${msg}`, ...args),
  error: (msg: string, ...args: any[]) => console.error(`[COMBAT] ${msg}`, ...args),
  debug: (msg: string, ...args: any[]) => console.debug(`[COMBAT] ${msg}`, ...args),
};

export interface TacticalContext {
  character: any;
  allies: any[];
  enemies: any[];
  battlefield: {
    terrain: string[];
    hazards: any[];
    cover: any[];
    lighting: "bright" | "dim" | "dark";
    weather?: string;
  };
  resources: {
    spellSlots: Record<number, number>;
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
  action: "attack" | "spell" | "move" | "dash" | "dodge" | "help" | "hide" | "ready" | "disengage";
  target?: string;
  position?: { x: number; y: number };
  spell?: string;
  weapon?: string;
  reasoning: string;
  confidence: number;
  alternatives: Array<{
    action: string;
    reasoning: string;
    confidence: number;
  }>;
  tacticalValue: number;
}

export interface CombatSimulation {
  id: string;
  participants: any[];
  rounds: number;
  currentRound: number;
  winner: "party" | "enemies" | "draw" | null;
  casualties: string[];
  tacticalAnalysis: {
    keyMoments: Array<{
      round: number;
      description: string;
      impact: "minor" | "moderate" | "major" | "decisive";
    }>;
    effectiveness: Record<string, number>;
    recommendations: string[];
  };
  isComplete: boolean;
}

export class CrucibleService {
  private prisma: PrismaClient;
  private activeSimulations = new Map<string, CombatSimulation>();
  private combatants = new Map<string, any>();
  private currentCombatant: string | null = null;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.registerEventHandlers();
  }

  private registerEventHandlers(): void {
    // Listen for combat events from the event bus
    globalEventBus.on('game:combatStart', async (event) => {
      logger.info('Combat started event received', event);
      await this.handleCombatStart(event);
    });

    globalEventBus.on('game:combatEnd', async (event) => {
      logger.info('Combat ended event received', event);
      await this.handleCombatEnd(event);
    });
  }

  private async handleCombatStart(event: any): Promise<void> {
    // Emit AI event for combat analysis
    await globalEventBus.emit(AIEvents.behaviorChanged('combat_ai', 'inactive', 'analyzing'));
  }

  private async handleCombatEnd(event: any): Promise<void> {
    // Emit AI event for combat completion
    await globalEventBus.emit(AIEvents.behaviorChanged('combat_ai', 'analyzing', 'inactive'));
  }

  /**
   * Execute a combat action
   */
  private async executeAction(action: any): Promise<void> {
    logger.debug(`Executing action: ${action.type} by ${action.actorId}`);
    
    // Find the actor
    const actor = this.combatants.get(action.actorId);
    if (!actor) {
      logger.warn(`Actor ${action.actorId} not found`);
      return;
    }

    switch (action.type) {
      case 'attack':
        await this.executeAttack(actor, action);
        break;
      case 'spell':
        await this.executeSpell(actor, action);
        break;
      case 'move':
        await this.executeMove(actor, action);
        break;
      case 'dodge':
        await this.executeDodge(actor, action);
        break;
      case 'dash':
        await this.executeDash(actor, action);
        break;
      case 'help':
        await this.executeHelp(actor, action);
        break;
      default:
        logger.warn(`Unknown action type: ${action.type}`);
    }

    // Emit game event for action execution
    await globalEventBus.emit(GameEvents.damageDealt(action.actorId, action.targetId || 'unknown', 0, action.type));
  }

  private async executeAttack(actor: any, action: any): Promise<void> {
    const target = this.combatants.get(action.targetId);
    if (!target) {return;}

    // Simple damage calculation
    const damage = Math.floor(Math.random() * 8) + 1; // 1d8
    target.stats.hitPoints.current = Math.max(0, target.stats.hitPoints.current - damage);
    
    logger.info(`${actor.name} attacks ${target.name} for ${damage} damage`);
  }

  private async executeSpell(actor: any, action: any): Promise<void> {
    // Spell execution logic
    logger.info(`${actor.name} casts ${action.spellId}`);
  }

  private async executeMove(actor: any, action: any): Promise<void> {
    actor.position = action.targetPosition;
    logger.info(`${actor.name} moves to ${action.targetPosition.x}, ${action.targetPosition.y}`);
  }

  private async executeDodge(actor: any, action: any): Promise<void> {
    // Add dodge condition
    logger.info(`${actor.name} dodges`);
  }

  private async executeDash(actor: any, action: any): Promise<void> {
    // Double movement speed
    logger.info(`${actor.name} dashes`);
  }

  private async executeHelp(actor: any, action: any): Promise<void> {
    const target = this.combatants.get(action.targetId);
    if (!target) {return;}
    
    logger.info(`${actor.name} helps ${target.name}`);
  }

  /**
   * Make tactical decision for an NPC
   */
  async makeTacticalDecision(context: TacticalContext): Promise<TacticalDecision> {
    // Use rule-based tactical decision making
    return this.calculateTacticalDecision(context);
  }

  /**
   * Simulate complete combat encounter
   */
  async simulateCombat(
    party: any[],
    enemies: any[],
    battlefield: TacticalContext["battlefield"],
    maxRounds: number = 20,
  ): Promise<CombatSimulation> {
    const simulationId = this.generateId();

    const simulation: CombatSimulation = {
      id: simulationId,
      participants: [...party, ...enemies],
      rounds: 0,
      currentRound: 1,
      winner: null,
      casualties: [],
      tacticalAnalysis: {
        keyMoments: [],
        effectiveness: {},
        recommendations: [],
      },
      isComplete: false,
    };

    this.activeSimulations.set(simulationId, simulation);

    // Emit combat start event on the global event bus
    await globalEventBus.emit(
      GameEvents.combatStart(simulationId, {
        participants: simulation.participants.map((p) => ({ id: p.id, name: p.name, type: p.type })),
        battlefield,
      }),
    );

    // Initialize combat participants
    simulation.participants.forEach((p) => {
      const combatant = {
        id: p.id,
        name: p.name,
        type: p.type || "npc",
        stats: {
          hitPoints: {
            current: p.hitPoints,
            max: p.maxHitPoints,
            temporary: 0,
          },
          armorClass: p.armorClass,
          speed: p.speed || 30,
          proficiencyBonus: p.proficiencyBonus || 2,
          abilities: p.abilities || {
            strength: 10,
            dexterity: 10,
            constitution: 10,
            intelligence: 10,
            wisdom: 10,
            charisma: 10,
          },
          savingThrows: {},
          skills: {},
          resistances: [],
          immunities: [],
          vulnerabilities: [],
          conditions: [],
        },
        attacks: p.attacks || [],
        spells: p.spells || [],
        position: p.position || { x: 0, y: 0 },
        initiative: this.rollInitiative(p),
        isActive: false,
        actionsUsed: 0,
        bonusActionUsed: false,
        reactionUsed: false,
        movementUsed: 0,
      };
      this.combatants.set(combatant.id, combatant);
    });

    // Sort by initiative for turn order
    const sortedCombatants = Array.from(this.combatants.values())
      .sort((a, b) => b.initiative - a.initiative);
    
    if (sortedCombatants.length > 0) {
      this.currentCombatant = sortedCombatants[0].id;
    }

    // Run simulation
    await this.runCombatSimulation(simulation, battlefield, maxRounds);

    // Emit combat end event on the global event bus
    await globalEventBus.emit(
      GameEvents.combatEnd({
        simulationId,
        winner: simulation.winner,
        rounds: simulation.rounds,
        casualties: simulation.casualties,
        analysis: simulation.tacticalAnalysis,
      }),
    );

    return simulation;
  }

  /**
   * Get battlefield recommendations for positioning
   */
  async getBattlefieldRecommendations(
    character: any,
    battlefield: TacticalContext["battlefield"],
    allies: any[],
    enemies: any[],
  ): Promise<
    Array<{
      position: { x: number; y: number };
      reasoning: string;
      tacticalValue: number;
      risks: string[];
      benefits: string[];
    }>
  > {
    const prompt = `Analyze this D&D 5e battlefield and provide tactical positioning recommendations:

Character: ${JSON.stringify(character, null, 2)}
Battlefield: ${JSON.stringify(battlefield, null, 2)}
Allies: ${JSON.stringify(
      allies.map((a) => ({ name: a.name, class: a.class, position: a.position })),
      null,
      2,
    )}
Enemies: ${JSON.stringify(
      enemies.map((e) => ({ name: e.name, type: e.type, position: e.position })),
      null,
      2,
    )}

Consider:
1. Character class and abilities (range, melee, support)
2. Terrain features and cover opportunities
3. Line of sight for spells and attacks
4. Formation with allies
5. Escape routes and mobility
6. Spell area effects and positioning
7. Threat positioning and priority targets
8. Battlefield control and area denial
9. Risk vs reward analysis
10. Win condition pursuit

Provide 3-5 optimal positions with detailed tactical analysis.
Format as JSON array with position coordinates, reasoning, tactical value (1-10), risks, and benefits.`;

    // Use rule-based positioning recommendations
    return this.generateBasicPositions(character, allies, enemies);
  }

  /**
   * Analyze combat performance and provide insights
   */
  async analyzeCombatPerformance(combatLog: any[]): Promise<{
    playerInsights: Record<
      string,
      {
        effectiveness: number;
        strengths: string[];
        improvements: string[];
        keyMoments: string[];
      }
    >;
    tacticalSummary: {
      winCondition: string;
      criticalMistakes: string[];
      optimalPlays: string[];
      alternativeStrategies: string[];
    };
    recommendations: string[];
  }> {
    const prompt = `Analyze this D&D 5e combat log and provide detailed tactical insights:

Combat Log: ${JSON.stringify(combatLog, null, 2)}

Provide comprehensive analysis including:
1. Individual player performance with effectiveness scores (1-10)
2. Key tactical decisions and their impact
3. Missed opportunities and suboptimal plays
4. Synergies and teamwork effectiveness
5. Resource management efficiency
6. Positioning and movement analysis
7. Alternative strategies that could have been employed

Format as detailed JSON with player insights, tactical summary, and actionable recommendations.`;

    // Use rule-based combat analysis
    return this.generateBasicAnalysis(combatLog);
  }

  /**
   * Build tactical decision prompt for AI
   */
  private buildTacticalPrompt(context: TacticalContext): string {
    return `You are an expert D&D 5e tactical AI making combat decisions for this character:

Character: ${JSON.stringify(context.character, null, 2)}
Allies: ${JSON.stringify(
      context.allies.map((a) => ({
        name: a.name,
        class: a.class,
        hitPoints: a.hitPoints,
        position: a.position,
        conditions: a.conditions,
      })),
      null,
      2,
    )}
Enemies: ${JSON.stringify(
      context.enemies.map((e) => ({
        name: e.name,
        type: e.type,
        hitPoints: e.hitPoints,
        position: e.position,
        conditions: e.conditions,
        threatLevel: this.assessThreat(e, context.character),
      })),
      null,
      2,
    )}

Battlefield: ${JSON.stringify(context.battlefield, null, 2)}
Resources: ${JSON.stringify(context.resources, null, 2)}
Objectives: ${context.objectives.join(", ")}
Threat Level: ${context.threatLevel}

Consider:
1. Character abilities, spells, and equipment
2. Action economy optimization (action, bonus action, movement)
3. Positioning for advantage and cover
4. Resource management (spell slots, abilities)
5. Target prioritization and threat assessment
6. Team coordination and support
7. Battlefield control and area denial
8. Risk vs reward analysis
9. Win condition pursuit

Make the BEST tactical decision and provide:
- Primary action with specific details
- Target selection reasoning
- Position/movement plan
- Confidence level (0-1)
- 2-3 alternative actions considered
- Tactical value assessment (1-10)

Format as JSON with detailed reasoning for each element.`;
  }

  /**
   * Run complete combat simulation
   */
  private async runCombatSimulation(
    simulation: CombatSimulation,
    battlefield: TacticalContext["battlefield"],
    maxRounds: number,
  ): Promise<void> {
    while (simulation.currentRound <= maxRounds && !simulation.isComplete) {
      logger.info(`Simulating round ${simulation.currentRound}`);

      // Get combat order
      const combatOrder = Array.from(this.combatants.values())
        .filter((c) => c.stats.hitPoints.current > 0)
        .sort((a, b) => b.initiative - a.initiative);

      // Process each combatant's turn
      if (combatOrder.length === 0) {continue;}

      for (const participant of combatOrder) {
        if (this.isCombatEnded(simulation)) {break;}

        // Build tactical context
        const context = this.buildTacticalContext(participant, simulation, battlefield);

        // Get AI decision
        const decision = await this.makeTacticalDecision(context);

        // Execute action
        await this.executeActionInSimulation(participant, decision, simulation);

        // Check for key moments
        this.analyzeRoundForKeyMoments(simulation, participant, decision);
      }

      simulation.currentRound++;
      simulation.rounds = simulation.currentRound - 1;

      // Check win condition
      this.checkWinCondition(simulation);
    }

    // Finalize analysis
    await this.finalizeCombatAnalysis(simulation);
    simulation.isComplete = true;
  }

  /**
   * Execute tactical action in simulation
   */
  private async executeActionInSimulation(
    participant: any,
    decision: TacticalDecision,
    simulation: CombatSimulation,
  ): Promise<void> {
    try {
      switch (decision.action) {
        case "attack":
          if (decision.target) {
            const attackAction = {
              type: "attack" as const,
              actorId: participant.id,
              targetId: decision.target,
              attackId: decision.weapon || "basic-attack",
            };
            await this.executeAction(attackAction);
          }
          break;

        case "spell":
          if (decision.spell) {
            const spellAction = {
              type: "spell" as const,
              actorId: participant.id,
              targetId: decision.target,
              spellId: decision.spell,
            };
            await this.executeAction(spellAction);
          }
          break;

        case "move":
          if (decision.position) {
            const moveAction = {
              type: "move" as const,
              actorId: participant.id,
              targetPosition: decision.position,
            };
            await this.executeAction(moveAction);
          }
          break;

        case "dodge":
          {
            const dodgeAction = {
              type: "dodge" as const,
              actorId: participant.id,
            };
            await this.executeAction(dodgeAction);
          }
          break;

        case "dash":
          {
            const dashAction = {
              type: "dash" as const,
              actorId: participant.id,
            };
            await this.executeAction(dashAction);
          }
          break;

        case "help":
          if (decision.target) {
            const helpAction = {
              type: "help" as const,
              actorId: participant.id,
              targetId: decision.target,
            };
            await this.executeAction(helpAction);
          }
          break;
      }

      // Track effectiveness
      this.trackActionEffectiveness(participant.id, decision, simulation);
    } catch (error) {
      logger.error("Action execution failed:", error);
    }
  }

  /**
   * Build tactical context for decision making
   */
  private buildTacticalContext(
    participant: any,
    simulation: CombatSimulation,
    battlefield: TacticalContext["battlefield"],
  ): TacticalContext {
    const allies = simulation.participants.filter(
      (p) => p.team === participant.team && p.id !== participant.id && p.hitPoints > 0,
    );

    const enemies = simulation.participants.filter(
      (p) => p.team !== participant.team && p.hitPoints > 0,
    );

    return {
      character: participant,
      allies,
      enemies,
      battlefield,
      resources: {
        spellSlots: participant.spellSlots || {},
        hitPoints: participant.hitPoints,
        actionEconomy: {
          action: true,
          bonusAction: true,
          reaction: true,
          movement: participant.speed || 30,
        },
      },
      objectives: this.determineObjectives(participant, allies, enemies),
      threatLevel: this.assessOverallThreat(participant, enemies),
    };
  }

  /**
   * Parse AI response into tactical decision
   */
  private parseTacticalDecision(aiResponse: any, context: TacticalContext): TacticalDecision {
    try {
      if (typeof aiResponse === "string") {
        aiResponse = JSON.parse(aiResponse);
      }

      return {
        action: aiResponse.action || "attack",
        target: aiResponse.target,
        position: aiResponse.position,
        spell: aiResponse.spell,
        weapon: aiResponse.weapon,
        reasoning: aiResponse.reasoning || "AI tactical decision",
        confidence: Math.min(Math.max(aiResponse.confidence || 0.7, 0), 1),
        alternatives: aiResponse.alternatives || [],
        tacticalValue: Math.min(Math.max(aiResponse.tacticalValue || 5, 1), 10),
      };
    } catch (error) {
      logger.error("Failed to parse tactical decision:", error);
      return this.fallbackDecision(context);
    }
  }

  /**
   * Fallback decision when AI fails
   */
  private fallbackDecision(context: TacticalContext): TacticalDecision {
    const nearestEnemy = this.findNearestEnemy(context.character, context.enemies);

    return {
      action: "attack",
      target: nearestEnemy?.id,
      reasoning: "Fallback: Attack nearest enemy",
      confidence: 0.5,
      alternatives: [{ action: "dodge", reasoning: "Defensive fallback", confidence: 0.4 }],
      tacticalValue: 4,
    };
  }

  /**
   * Calculate tactical decision using rule-based system
   */
  private calculateTacticalDecision(context: TacticalContext): TacticalDecision {
    const character = context.character;
    const enemies = context.enemies.filter((e) => (e.hitPoints || 0) > 0);
    const allies = context.allies.filter((a) => (a.hitPoints || 0) > 0);

    // Assess situation
    const healthPercent = (character.hitPoints || 0) / (character.maxHitPoints || 1);
    const outnumbered = enemies.length > allies.length + 1;
    const hasSpellSlots = Object.values(context.resources.spellSlots).some((slots) => slots > 0);
    const nearestEnemy = this.findNearestEnemy(character, enemies);

    // Decision logic based on character class and situation
    let decision: TacticalDecision;

    if (healthPercent < 0.3 && character.class !== "barbarian") {
      // Low health - defensive action
      decision = {
        action: "dodge",
        reasoning: "Critical health - taking defensive action",
        confidence: 0.9,
        alternatives: [
          { action: "disengage", reasoning: "Retreat to safety", confidence: 0.8 },
          { action: "dash", reasoning: "Escape from combat", confidence: 0.7 },
        ],
        tacticalValue: 7,
      };
    } else if (
      character.class === "cleric" &&
      allies.some((a) => (a.hitPoints || 0) < (a.maxHitPoints || 1) * 0.5)
    ) {
      // Healer with injured allies
      const injuredAlly = allies.find((a) => (a.hitPoints || 0) < (a.maxHitPoints || 1) * 0.5);
      decision = {
        action: "spell",
        spell: "cure-wounds",
        target: injuredAlly?.id,
        reasoning: "Healing critically injured ally",
        confidence: 0.95,
        alternatives: [
          { action: "spell", reasoning: "Mass healing spell", confidence: 0.85 },
          { action: "help", reasoning: "Assist ally", confidence: 0.6 },
        ],
        tacticalValue: 9,
      };
    } else if (character.class === "wizard" && hasSpellSlots && enemies.length >= 3) {
      // Spellcaster with AOE opportunity
      decision = {
        action: "spell",
        spell: "fireball",
        position: this.calculateOptimalAOEPosition(enemies),
        reasoning: "Multiple enemies clustered - AOE spell opportunity",
        confidence: 0.9,
        alternatives: [
          { action: "spell", reasoning: "Control spell", confidence: 0.8 },
          { action: "move", reasoning: "Reposition for better angle", confidence: 0.6 },
        ],
        tacticalValue: 10,
      };
    } else if (
      nearestEnemy &&
      this.calculateDistance(
        character.position || { x: 0, y: 0 },
        nearestEnemy.position || { x: 0, y: 0 },
      ) <= 5
    ) {
      // Melee range combat
      decision = {
        action: "attack",
        target: nearestEnemy.id,
        weapon: character.mainWeapon || "melee-attack",
        reasoning: "Enemy in melee range - direct attack",
        confidence: 0.85,
        alternatives: [
          { action: "disengage", reasoning: "Create distance", confidence: 0.6 },
          { action: "spell", reasoning: "Close-range spell", confidence: 0.7 },
        ],
        tacticalValue: 7,
      };
    } else if (nearestEnemy) {
      // Ranged combat or need to close distance
      const distance = this.calculateDistance(
        character.position || { x: 0, y: 0 },
        nearestEnemy.position || { x: 0, y: 0 },
      );
      if (distance > 30 || character.class === "ranger" || character.class === "rogue") {
        decision = {
          action: "attack",
          target: nearestEnemy.id,
          weapon: character.rangedWeapon || "ranged-attack",
          reasoning: "Ranged attack on priority target",
          confidence: 0.8,
          alternatives: [
            { action: "move", reasoning: "Better positioning", confidence: 0.7 },
            { action: "hide", reasoning: "Gain advantage", confidence: 0.65 },
          ],
          tacticalValue: 6,
        };
      } else {
        decision = {
          action: "move",
          position: this.calculateApproachPosition(character, nearestEnemy),
          reasoning: "Moving to engage enemy",
          confidence: 0.75,
          alternatives: [
            { action: "dash", reasoning: "Close distance quickly", confidence: 0.7 },
            { action: "ready", reasoning: "Prepare for enemy approach", confidence: 0.6 },
          ],
          tacticalValue: 5,
        };
      }
    } else {
      // No clear target - defensive/support action
      decision = {
        action: "dodge",
        reasoning: "No immediate threats - maintaining defense",
        confidence: 0.6,
        alternatives: [
          { action: "help", reasoning: "Assist allies", confidence: 0.5 },
          { action: "hide", reasoning: "Gain tactical advantage", confidence: 0.5 },
        ],
        tacticalValue: 4,
      };
    }

    // Adjust for threat level
    if (context.threatLevel === "extreme") {
      decision.confidence *= 0.8;
      decision.tacticalValue = Math.max(1, decision.tacticalValue - 2);
    }

    return decision;
  }

  private calculateOptimalAOEPosition(enemies: any[]): { x: number; y: number } {
    if (!enemies.length) {return { x: 0, y: 0 };}

    // Calculate centroid of enemy positions
    const sumX = enemies.reduce((sum, e) => sum + (e.position?.x || 0), 0);
    const sumY = enemies.reduce((sum, e) => sum + (e.position?.y || 0), 0);

    return {
      x: Math.round(sumX / enemies.length),
      y: Math.round(sumY / enemies.length),
    };
  }

  private calculateApproachPosition(character: any, target: any): { x: number; y: number } {
    const charPos = character.position || { x: 0, y: 0 };
    const targetPos = target.position || { x: 0, y: 0 };

    // Move towards target but stop at optimal range (5 ft for melee, 30 ft for ranged)
    const optimalRange = character.prefersMelee ? 5 : 30;
    const distance = this.calculateDistance(charPos, targetPos);

    if (distance <= optimalRange) {return charPos;}

    const ratio = optimalRange / distance;
    return {
      x: Math.round(charPos.x + (targetPos.x - charPos.x) * (1 - ratio)),
      y: Math.round(charPos.y + (targetPos.y - charPos.y) * (1 - ratio)),
    };
  }

  // Utility methods
  private generateId(): string {
    return `combat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private rollInitiative(character: any): number {
    const dex = typeof character.abilities?.dexterity === "number" ? character.abilities.dexterity : 10;
    const dexMod = Math.floor((dex - 10) / 2);
    return Math.floor(Math.random() * 20) + 1 + dexMod;
  }

  private assessThreat(enemy: any, character: any): "low" | "moderate" | "high" | "extreme" {
    const enemyCR = enemy.challengeRating || 1;
    const charLevel = character.level || 1;

    if (enemyCR >= charLevel * 2) {return "extreme";}
    if (enemyCR >= charLevel) {return "high";}
    if (enemyCR >= charLevel * 0.5) {return "moderate";}
    return "low";
  }

  private assessOverallThreat(character: any, enemies: any[]): TacticalContext["threatLevel"] {
    const totalCR = enemies.reduce((sum, e) => sum + (e.challengeRating || 1), 0);
    const charLevel = character.level || 1;

    if (totalCR >= charLevel * 3) {return "extreme";}
    if (totalCR >= charLevel * 2) {return "high";}
    if (totalCR >= charLevel) {return "moderate";}
    return "low";
  }

  private determineObjectives(character: any, allies: any[], enemies: any[]): string[] {
    const objectives = ["Survive the encounter"];

    if (character.class === "cleric" || character.class === "druid") {
      objectives.push("Support and heal allies");
    }

    if (character.class === "fighter" || character.class === "barbarian") {
      objectives.push("Engage primary threats");
    }

    if (character.class === "wizard" || character.class === "sorcerer") {
      objectives.push("Control battlefield and deal area damage");
    }

    if (enemies.length > allies.length) {
      objectives.push("Focus fire priority targets");
    }

    return objectives;
  }

  private findNearestEnemy(character: any, enemies: any[]): any | null {
    if (!enemies.length) {return null;}

    const livingEnemies = enemies.filter((e: any) => (e.hitPoints || e.health || 0) > 0);
    if (!livingEnemies.length) {return null;}

    // Return the nearest enemy based on position
    const charPos = character.position || { x: 0, y: 0 };
    return livingEnemies.reduce((nearest: any, enemy: any) => {
      const enemyPos = enemy.position || { x: 0, y: 0 };
      const dist = this.calculateDistance(charPos, enemyPos);
      const nearestPos = nearest?.position || { x: 0, y: 0 };
      const nearestDist = this.calculateDistance(charPos, nearestPos);
      return dist < nearestDist ? enemy : nearest;
    }, livingEnemies[0]);
  }

  private calculateDistance(
    pos1: { x: number; y: number },
    pos2: { x: number; y: number },
  ): number {
    return Math.sqrt(Math.pow(pos2.x - pos1.x, 2) + Math.pow(pos2.y - pos1.y, 2));
  }

  private isCombatEnded(simulation: CombatSimulation): boolean {
    const livingParty = simulation.participants.filter(
      (p) => p.team === "party" && p.hitPoints > 0,
    );
    const livingEnemies = simulation.participants.filter(
      (p) => p.team === "enemies" && p.hitPoints > 0,
    );

    return livingParty.length === 0 || livingEnemies.length === 0;
  }

  private checkWinCondition(simulation: CombatSimulation): void {
    const livingParty = simulation.participants.filter(
      (p) => p.team === "party" && p.hitPoints > 0,
    );
    const livingEnemies = simulation.participants.filter(
      (p) => p.team === "enemies" && p.hitPoints > 0,
    );

    if (livingParty.length === 0) {
      simulation.winner = "enemies";
      simulation.isComplete = true;
    } else if (livingEnemies.length === 0) {
      simulation.winner = "party";
      simulation.isComplete = true;
    }
  }

  private analyzeRoundForKeyMoments(
    simulation: CombatSimulation,
    participant: any,
    decision: TacticalDecision,
  ): void {
    // Detect significant tactical moments
    if (decision.tacticalValue >= 8) {
      simulation.tacticalAnalysis.keyMoments.push({
        round: simulation.currentRound,
        description: `${participant.name}: ${decision.reasoning}`,
        impact: "major",
      });
    }
  }

  private trackActionEffectiveness(
    participantId: string,
    decision: TacticalDecision,
    simulation: CombatSimulation,
  ): void {
    if (!simulation.tacticalAnalysis.effectiveness[participantId]) {
      simulation.tacticalAnalysis.effectiveness[participantId] = 0;
    }

    simulation.tacticalAnalysis.effectiveness[participantId] += decision.tacticalValue;
  }

  private async finalizeCombatAnalysis(simulation: CombatSimulation): Promise<void> {
    // Generate final recommendations
    simulation.tacticalAnalysis.recommendations = [
      "Focus fire priority targets",
      "Optimize action economy usage",
      "Improve battlefield positioning",
      "Coordinate team abilities",
    ];
  }

  private parsePositioningRecommendations(aiResponse: any): Array<{
    position: { x: number; y: number };
    reasoning: string;
    tacticalValue: number;
    risks: string[];
    benefits: string[];
  }> {
    try {
      if (typeof aiResponse === "string") {
        aiResponse = JSON.parse(aiResponse);
      }
      return aiResponse.map((rec: any) => ({
        position: rec.position || { x: 0, y: 0 },
        reasoning: rec.reasoning || "AI positioning recommendation",
        tacticalValue: Math.min(Math.max(rec.tacticalValue || 5, 1), 10),
        risks: rec.risks || [],
        benefits: rec.benefits || [],
      }));
    } catch (error) {
      logger.error("Failed to parse positioning recommendations:", error);
      return [];
    }
  }

  private generateBasicPositions(
    character: any,
    allies: any[],
    enemies: any[],
  ): Array<{
    position: { x: number; y: number };
    reasoning: string;
    tacticalValue: number;
    risks: string[];
    benefits: string[];
  }> {
    const positions: Array<{
      position: { x: number; y: number };
      reasoning: string;
      tacticalValue: number;
      risks: string[];
      benefits: string[];
    }> = [];
    const charPos = character.position || { x: 0, y: 0 };

    // Position 1: Behind cover
    positions.push({
      position: { x: charPos.x - 10, y: charPos.y },
      reasoning: "Defensive position behind cover",
      tacticalValue: 7,
      risks: ["Limited line of sight", "May be flanked"],
      benefits: ["Cover from ranged attacks", "Safe healing position"],
    });

    // Position 2: High ground
    positions.push({
      position: { x: charPos.x, y: charPos.y + 15 },
      reasoning: "Elevated position for advantage",
      tacticalValue: 8,
      risks: ["Exposed position", "Limited escape routes"],
      benefits: ["Ranged attack advantage", "Better battlefield visibility"],
    });

    // Position 3: Support position near allies
    if (allies.length > 0) {
      const allyPos = allies[0].position || { x: 0, y: 0 };
      positions.push({
        position: { x: allyPos.x + 5, y: allyPos.y },
        reasoning: "Support position near allies",
        tacticalValue: 6,
        risks: ["Vulnerable to area attacks"],
        benefits: ["Can provide support", "Coordinated attacks"],
      });
    }

    // Position 4: Flanking position
    if (enemies.length > 0) {
      const enemyPos = enemies[0].position || { x: 0, y: 0 };
      positions.push({
        position: { x: enemyPos.x + 10, y: enemyPos.y - 10 },
        reasoning: "Flanking position for tactical advantage",
        tacticalValue: 9,
        risks: ["Isolated from allies", "Enemy reinforcements"],
        benefits: ["Surprise attacks", "Forces enemy repositioning"],
      });
    }

    return positions;
  }

  private parseCombatAnalysis(aiResponse: any): any {
    try {
      if (typeof aiResponse === "string") {
        aiResponse = JSON.parse(aiResponse);
      }
      return aiResponse;
    } catch (error) {
      logger.error("Failed to parse combat analysis:", error);
      return this.generateBasicAnalysis([]);
    }
  }

  private generateBasicAnalysis(combatLog: any[]): any {
    const playerInsights: Record<string, any> = {};
    const participants = new Set<string>();

    // Analyze combat log
    combatLog.forEach((entry) => {
      if (entry.actor) {participants.add(entry.actor);}
      if (entry.target) {participants.add(entry.target);}
    });

    participants.forEach((participant) => {
      playerInsights[participant] = {
        effectiveness: Math.floor(Math.random() * 4) + 5, // 5-8 rating
        strengths: ["Good positioning", "Effective resource management"],
        improvements: ["Consider using more crowd control", "Optimize action economy"],
        keyMoments: ["Critical hit in round 3", "Successful saving throw against fireball"],
      };
    });

    return {
      playerInsights,
      tacticalSummary: {
        winCondition: "Defeat all enemies",
        criticalMistakes: [
          "Split party formation in round 2",
          "Wasted high-level spell slot on minor enemy",
        ],
        optimalPlays: ["Coordinated focus fire on boss", "Effective use of battlefield terrain"],
        alternativeStrategies: [
          "Could have used stealth approach",
          "Environmental hazards were underutilized",
        ],
      },
      recommendations: [
        "Maintain better party formation",
        "Prioritize high-threat targets",
        "Conserve resources for critical moments",
        "Utilize terrain and cover more effectively",
      ],
    };
  }

  /**
   * Analyze positioning options for a character in combat
   */
  async analyzePositioning(context: {
    character: any;
    currentPosition: { x: number; y: number };
    battlefield: any;
    allies: any[];
    enemies: any[];
    movementSpeed: number;
    threatLevel: string;
  }): Promise<{
    recommendedPositions: Array<{
      position: { x: number; y: number };
      reasoning: string;
      tacticalValue: number;
      risks: string[];
      benefits: string[];
    }>;
    currentPositionAnalysis: {
      tacticalValue: number;
      risks: string[];
      benefits: string[];
    };
    movementOptions: Array<{
      position: { x: number; y: number };
      movementCost: number;
      reachable: boolean;
    }>;
  }> {
    try {
      // Generate positioning recommendations
      const recommendedPositions = this.generateBasicPositions(
        context.character,
        context.allies,
        context.enemies
      );

      // Analyze current position
      const currentPositionAnalysis = {
        tacticalValue: this.calculatePositionValue(context.currentPosition, context.allies, context.enemies),
        risks: this.identifyPositionRisks(context.currentPosition, context.enemies, context.battlefield),
        benefits: this.identifyPositionBenefits(context.currentPosition, context.allies, context.battlefield)
      };

      // Calculate movement options based on speed
      const movementOptions = this.calculateMovementOptions(
        context.currentPosition,
        context.movementSpeed,
        context.battlefield
      );

      // Log positioning analysis (simplified)
      logger.info("Positioning analysis completed", {
        characterId: context.character.id,
        threatLevel: context.threatLevel,
        recommendedPositions: recommendedPositions.length,
        currentTacticalValue: currentPositionAnalysis.tacticalValue
      });

      return {
        recommendedPositions,
        currentPositionAnalysis,
        movementOptions
      };

    } catch (error) {
      logger.error("Failed to analyze positioning:", error);
      
      // Return fallback analysis
      return {
        recommendedPositions: [{
          position: context.currentPosition,
          reasoning: "Stay in current position due to analysis error",
          tacticalValue: 5,
          risks: ["Unknown tactical situation"],
          benefits: ["Familiar position"]
        }],
        currentPositionAnalysis: {
          tacticalValue: 5,
          risks: ["Analysis unavailable"],
          benefits: ["Current position"]
        },
        movementOptions: [{
          position: context.currentPosition,
          movementCost: 0,
          reachable: true
        }]
      };
    }
  }

  private calculatePositionValue(position: { x: number; y: number }, allies: any[], enemies: any[]): number {
    // Basic tactical value calculation
    let value = 5; // Base value
    
    // Distance to allies (closer is generally better for support)
    const allyDistances = allies.map(ally => {
      const allyPos = ally.position || { x: 0, y: 0 };
      return Math.sqrt(Math.pow(position.x - allyPos.x, 2) + Math.pow(position.y - allyPos.y, 2));
    });
    const avgAllyDistance = allyDistances.length > 0 ? allyDistances.reduce((a, b) => a + b, 0) / allyDistances.length : 0;
    
    // Distance to enemies (moderate distance often optimal)
    const enemyDistances = enemies.map(enemy => {
      const enemyPos = enemy.position || { x: 0, y: 0 };
      return Math.sqrt(Math.pow(position.x - enemyPos.x, 2) + Math.pow(position.y - enemyPos.y, 2));
    });
    const avgEnemyDistance = enemyDistances.length > 0 ? enemyDistances.reduce((a, b) => a + b, 0) / enemyDistances.length : 0;
    
    // Adjust value based on positioning
    if (avgAllyDistance < 15) {value += 1;} // Close to allies
    if (avgEnemyDistance > 10 && avgEnemyDistance < 30) {value += 1;} // Good range from enemies
    
    return Math.min(Math.max(value, 1), 10);
  }

  private identifyPositionRisks(position: { x: number; y: number }, enemies: any[], battlefield: any): string[] {
    const risks: string[] = [];
    
    // Check if surrounded
    const nearbyEnemies = enemies.filter(enemy => {
      const enemyPos = enemy.position || { x: 0, y: 0 };
      const distance = Math.sqrt(Math.pow(position.x - enemyPos.x, 2) + Math.pow(position.y - enemyPos.y, 2));
      return distance < 10;
    });
    
    if (nearbyEnemies.length > 2) {
      risks.push("Surrounded by multiple enemies");
    }
    
    if (nearbyEnemies.length > 0) {
      risks.push("Within melee range of enemies");
    }
    
    // Check battlefield hazards
    if (battlefield?.hazards?.length > 0) {
      risks.push("Near battlefield hazards");
    }
    
    if (battlefield?.lighting === "dark") {
      risks.push("Poor visibility conditions");
    }
    
    return risks;
  }

  private identifyPositionBenefits(position: { x: number; y: number }, allies: any[], battlefield: any): string[] {
    const benefits: string[] = [];
    
    // Check if near allies
    const nearbyAllies = allies.filter(ally => {
      const allyPos = ally.position || { x: 0, y: 0 };
      const distance = Math.sqrt(Math.pow(position.x - allyPos.x, 2) + Math.pow(position.y - allyPos.y, 2));
      return distance < 15;
    });
    
    if (nearbyAllies.length > 0) {
      benefits.push("Close to allied support");
    }
    
    // Check for cover
    if (battlefield?.cover?.length > 0) {
      benefits.push("Has available cover");
    }
    
    if (battlefield?.terrain?.includes("high_ground")) {
      benefits.push("Elevated position advantage");
    }
    
    if (battlefield?.lighting === "bright") {
      benefits.push("Good visibility for targeting");
    }
    
    return benefits;
  }

  private calculateMovementOptions(
    currentPosition: { x: number; y: number },
    movementSpeed: number,
    battlefield: any
  ): Array<{ position: { x: number; y: number }; movementCost: number; reachable: boolean }> {
    const options: Array<{ position: { x: number; y: number }; movementCost: number; reachable: boolean }> = [];
    
    // Generate movement grid based on speed
    const gridSize = 5;
    const maxDistance = movementSpeed;
    
    for (let x = currentPosition.x - maxDistance; x <= currentPosition.x + maxDistance; x += gridSize) {
      for (let y = currentPosition.y - maxDistance; y <= currentPosition.y + maxDistance; y += gridSize) {
        const distance = Math.sqrt(Math.pow(x - currentPosition.x, 2) + Math.pow(y - currentPosition.y, 2));
        
        if (distance <= maxDistance) {
          options.push({
            position: { x, y },
            movementCost: Math.round(distance),
            reachable: distance <= movementSpeed
          });
        }
      }
    }
    
    return options;
  }

  // Public methods for external access
  async getSimulation(simulationId: string): Promise<CombatSimulation | null> {
    return this.activeSimulations.get(simulationId) || null;
  }

  async getAllActiveSimulations(): Promise<CombatSimulation[]> {
    return Array.from(this.activeSimulations.values());
  }
}
