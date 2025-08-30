/**
 * Crucible Combat AI API Routes
 */

import { z } from 'zod';
import { logger } from '@vtt/logging';
import { PrismaClient } from '@prisma/client';
import { CrucibleService } from '../ai/combat';
import { RouteHandler } from '../router/types';
import { parseJsonBody } from '../utils/json';

// Helper functions for combat calculations
function extractSpellSlots(character: any): Record<string, number> {
  if (character.spellSlots) {
    return character.spellSlots;
  }
  
  // Calculate based on class and level
  const spellSlots: Record<string, number> = {};
  const level = character.level || 1;
  const spellcaster = ['wizard', 'sorcerer', 'cleric', 'druid', 'bard', 'warlock'].includes(character.class?.toLowerCase());
  
  if (spellcaster) {
    // Basic spell slot calculation
    if (level >= 1) spellSlots['1'] = Math.min(4, 1 + Math.floor(level / 2));
    if (level >= 3) spellSlots['2'] = Math.min(3, Math.floor((level - 2) / 2));
    if (level >= 5) spellSlots['3'] = Math.min(3, Math.floor((level - 4) / 3));
    if (level >= 7) spellSlots['4'] = Math.min(3, Math.floor((level - 6) / 4));
    if (level >= 9) spellSlots['5'] = Math.min(2, Math.floor((level - 8) / 5));
  }
  
  return spellSlots;
}

function calculateMovementSpeed(character: any): number {
  // Base movement speed
  let speed = 30;
  
  // Adjust based on race
  const race = character.race?.toLowerCase();
  if (race === 'dwarf' || race === 'halfling' || race === 'gnome') {
    speed = 25;
  } else if (race === 'wood elf' || race === 'elf') {
    speed = 35;
  }
  
  // Check for speed modifiers in equipment or abilities
  if (character.abilities?.speed) {
    speed = character.abilities.speed;
  }
  
  return speed;
}

function calculateThreatLevel(enemies: any[]): string {
  if (!enemies || enemies.length === 0) return 'low';
  
  // Calculate total challenge rating
  const totalCR = enemies.reduce((sum, enemy) => {
    const cr = enemy.challengeRating || enemy.cr || 0;
    return sum + (typeof cr === 'string' ? parseFloat(cr) : cr);
  }, 0);
  
  // Determine threat level based on total CR
  if (totalCR < 2) return 'low';
  if (totalCR < 5) return 'moderate';
  if (totalCR < 10) return 'high';
  return 'extreme';
}

// Lazy-load Prisma client to avoid initialization issues during module loading
let prisma: PrismaClient | null = null;
let crucibleService: CrucibleService | null = null;

function getServices() {
  if (!prisma) {
    prisma = new PrismaClient();
    crucibleService = new CrucibleService(prisma);
  }
  return { prisma, crucibleService: crucibleService! };
}

// Validation schemas
const TacticalDecisionSchema = z.object({
  character: z.object({
    id: z.string(),
    name: z.string(),
    class: z.string(),
    level: z.number(),
    hitPoints: z.number(),
    maxHitPoints: z.number(),
    armorClass: z.number(),
    abilities: z.object({
      strength: z.number(),
      dexterity: z.number(),
      constitution: z.number(),
      intelligence: z.number(),
      wisdom: z.number(),
      charisma: z.number()
    }),
    position: z.object({
      x: z.number(),
      y: z.number()
    }),
    spells: z.array(z.string()).optional(),
    equipment: z.array(z.string()).optional()
  }),
  allies: z.array(z.any()),
  enemies: z.array(z.any()),
  battlefield: z.object({
    terrain: z.array(z.string()),
    hazards: z.array(z.any()),
    cover: z.array(z.any()),
    lighting: z.enum(['bright', 'dim', 'dark']),
    weather: z.string().optional()
  }),
  objectives: z.array(z.string()).optional()
});

const CombatSimulationSchema = z.object({
  party: z.array(z.any()),
  enemies: z.array(z.any()),
  battlefield: z.object({
    terrain: z.array(z.string()),
    hazards: z.array(z.any()),
    cover: z.array(z.any()),
    lighting: z.enum(['bright', 'dim', 'dark']),
    weather: z.string().optional()
  }),
  maxRounds: z.number().min(1).max(50).optional()
});

const PositionAnalysisSchema = z.object({
  character: z.object({
    id: z.string(),
    name: z.string(),
    class: z.string(),
    position: z.object({
      x: z.number(),
      y: z.number()
    })
  }),
  battlefield: z.object({
    terrain: z.array(z.string()),
    hazards: z.array(z.any()),
    cover: z.array(z.any()),
    lighting: z.enum(['bright', 'dim', 'dark'])
  }),
  allies: z.array(z.any()),
  enemies: z.array(z.any())
});

/**
 * POST /combat/tactical-decision
 * Get AI tactical recommendation for NPC
 */
export const getTacticalDecisionHandler: RouteHandler = async (ctx) => {
  try {
    // Check authentication
    const user = (ctx.req as any).user;
    if (!user) {
      ctx.res.writeHead(401, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: 'Authentication required' }));
      return;
    }

    // Parse and validate request body
    let body;
    try {
      body = await parseJsonBody(ctx.req);
    } catch (_error) {
      ctx.res.writeHead(400, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      return;
    }

    const validatedData = TacticalDecisionSchema.parse(body);

    // Build tactical context
    const tacticalContext = {
      character: validatedData.character,
      allies: validatedData.allies,
      enemies: validatedData.enemies,
      battlefield: {
        ...validatedData.battlefield,
        weather: validatedData.battlefield.weather || 'clear'
      },
      resources: {
        spellSlots: extractSpellSlots(validatedData.character),
        hitPoints: validatedData.character.hitPoints,
        actionEconomy: {
          action: true,
          bonusAction: true,
          reaction: true,
          movement: calculateMovementSpeed(validatedData.character)
        }
      },
      objectives: validatedData.objectives || ['Defeat enemies'],
      threatLevel: calculateThreatLevel(validatedData.enemies) as 'low' | 'moderate' | 'high' | 'extreme'
    };

    // Get tactical decision from Crucible AI service
    const decision = await crucibleService!.makeTacticalDecision(tacticalContext);

    ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({
      success: true,
      data: decision
    }));

  } catch (error: any) {
    logger.error('Tactical decision failed:', error);
    ctx.res.writeHead(500, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({
      success: false,
      error: 'Failed to generate tactical decision',
      details: error.message
    }));
  }
};

/**
 * POST /combat/simulate
 * Run complete combat simulation
 */
export const simulateCombatHandler: RouteHandler = async (ctx) => {
  try {
    // Check authentication
    const user = (ctx.req as any).user;
    if (!user) {
      ctx.res.writeHead(401, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: 'Authentication required' }));
      return;
    }

    // Parse and validate request body
    let body;
    try {
      body = await parseJsonBody(ctx.req);
    } catch (_error) {
      ctx.res.writeHead(400, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      return;
    }

    const { party,  enemies,  battlefield,  maxRounds = 20  } = CombatSimulationSchema.parse(body);

    // Ensure battlefield has all required properties
    const battlefieldWithDefaults = {
      ...battlefield,
      weather: battlefield.weather || 'clear'
    };

    // Run combat simulation
    const simulation = await crucibleService!.simulateCombat(
      party,
      enemies,
      battlefieldWithDefaults,
      maxRounds
    );
    
    // Return simulation results
    ctx.res.writeHead(201, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({
      success: true,
      data: {
        simulationId: simulation.id,
        winner: simulation.winner,
        rounds: simulation.rounds,
        casualties: simulation.casualties,
        tacticalAnalysis: simulation.tacticalAnalysis,
        isComplete: simulation.isComplete
      }
    }));

  } catch (error: any) {
    logger.error('Combat simulation failed:', error);
    ctx.res.writeHead(500, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({
      success: false,
      error: 'Failed to simulate combat',
      details: error.message
    }));
  }
};

// ... (rest of the code remains the same)

/**
 * POST /combat/analyze
 * Analyze combat performance and provide insights
 */
export const analyzeCombatHandler: RouteHandler = async (ctx) => {
  try {
    // Check authentication
    const user = (ctx.req as any).user;
    if (!user) {
      ctx.res.writeHead(401, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: 'Authentication required' }));
      return;
    }

    // Parse request body
    let body;
    try {
      body = await parseJsonBody(ctx.req);
    } catch (_error) {
      ctx.res.writeHead(400, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      return;
    }

    const { combatLog  } = body;

    if (!combatLog || !Array.isArray(combatLog)) {
      ctx.res.writeHead(400, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: 'Valid combat log required' }));
      return;
    }

    // Analyze combat log using CrucibleService
    const { crucibleService } = getServices();
    const analysis = await crucibleService!.analyzeCombatPerformance(combatLog);

    ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({
      success: true,
      data: analysis
    }));

  } catch (error: any) {
    logger.error('Combat analysis failed:', error);
    ctx.res.writeHead(500, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({
      success: false,
      error: 'Failed to analyze combat',
      details: error.message
    }));
  }
};

/**
 * GET /combat/simulations
 * Get all active combat simulations
 */
export const getActiveSimulationsHandler: RouteHandler = async (ctx) => {
  try {
    // Check authentication
    const user = (ctx.req as any).user;
    if (!user) {
      ctx.res.writeHead(401, { 'Content-Type': 'application/json' });
      ctx.res.end(JSON.stringify({ error: 'Authentication required' }));
      return;
    }

    // Get active simulations from CrucibleService
    const { crucibleService } = getServices();
    const simulations = await crucibleService!.getAllActiveSimulations();

    ctx.res.writeHead(200, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({
      success: true,
      data: simulations.map(sim => ({
        id: sim.id,
        participants: sim.participants.length,
        rounds: sim.rounds,
        currentRound: sim.currentRound,
        winner: sim.winner,
        isComplete: sim.isComplete
      }))
    }));

  } catch (error: any) {
    logger.error('Failed to get active simulations:', error);
    ctx.res.writeHead(500, { 'Content-Type': 'application/json' });
    ctx.res.end(JSON.stringify({
      success: false,
      error: 'Failed to get simulations',
      details: error.message
    }));
  }
};

/**
 * WebSocket events for real-time combat updates
 */
export const _handleCombatWebSocket = async (ws: any, message: any, _userId: string) => {
  switch (message.type) {
    case 'COMBAT_SUBSCRIBE': {
      const { simulationId  } = message.payload;
      
      // Subscribe to combat updates
      ws.combatSubscription = simulationId;
      
      // Send current status
      try {
        const { crucibleService } = getServices();
        const simulation = await crucibleService!.getSimulation(simulationId);
        
        ws.send(JSON.stringify({
          type: 'COMBAT_UPDATE',
          payload: simulation || {
            simulationId,
            currentRound: 0,
            participants: [],
            winner: null,
            isComplete: false,
            message: 'Simulation not found'
          }
        }));
      } catch (error) {
        ws.send(JSON.stringify({
          type: 'COMBAT_ERROR',
          payload: { error: 'Failed to get simulation status' }
        }));
      }
    }
      break;

    case 'COMBAT_UNSUBSCRIBE':
      ws.combatSubscription = null;
      break;

    case 'REQUEST_TACTICAL_DECISION': {
      // Real-time tactical decision request
      const { context } = message.payload;
      
      try {
        const { crucibleService } = getServices();
        const decision = await crucibleService!.makeTacticalDecision(context);
        
        ws.send(JSON.stringify({
          type: 'TACTICAL_DECISION',
          payload: {
            requestId: message.payload.requestId,
            decision
          }
        }));
      } catch (error) {
        ws.send(JSON.stringify({
          type: 'TACTICAL_DECISION_ERROR',
          payload: {
            requestId: message.payload.requestId,
            error: 'Failed to generate tactical decision'
          }
        }));
      }
    }
      break;
  }
};

// Crucible service will be integrated when AI service is available
