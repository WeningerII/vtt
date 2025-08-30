/**
 * Tests for CrucibleService - Combat AI and Tactical Decision Making
 */
import { CrucibleService } from './combat';
import { PrismaClient } from '@prisma/client';
import { jest } from '@jest/globals';

// Mock PrismaClient
jest.mock('@prisma/client');

describe('CrucibleService', () => {
  let service: CrucibleService;
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;
    service = new CrucibleService(mockPrisma);
  });

  describe('makeTacticalDecision', () => {
    const createTestContext = (overrides = {}) => ({
      character: {
        id: 'char-1',
        name: 'Warrior',
        class: 'fighter',
        level: 5,
        hp: { current: 30, max: 50 },
        position: { x: 0, y: 0 },
        abilities: [
          { id: 'attack', name: 'Attack', type: 'action', damage: '1d8+3' },
          { id: 'second-wind', name: 'Second Wind', type: 'bonus_action', healing: '1d10+5' }
        ],
        conditions: [],
        resources: {
          actionSurge: 1,
          secondWind: 1,
          spellSlots: { 1: 0, 2: 0, 3: 0 }
        }
      },
      allies: [
        {
          id: 'ally-1',
          name: 'Cleric',
          class: 'cleric',
          hp: { current: 20, max: 40 },
          position: { x: 5, y: 0 },
          conditions: []
        }
      ],
      enemies: [
        {
          id: 'enemy-1',
          name: 'Goblin',
          type: 'goblin',
          hp: { current: 10, max: 10 },
          position: { x: 10, y: 0 },
          ac: 15,
          threat: 'low'
        }
      ],
      battlefield: {
        terrain: ['grass'],
        hazards: [],
        cover: [],
        lighting: 'bright' as const,
        weather: 'clear'
      },
      objectives: ['defeat_all_enemies'],
      previousActions: [],
      ...overrides
    });

    it('should prioritize healing when character is low on health', async () => {
      const context = createTestContext({
        character: {
          ...createTestContext().character,
          hp: { current: 10, max: 50 },
          class: 'cleric',
          abilities: [
            { id: 'cure-wounds', name: 'Cure Wounds', type: 'action', healing: '1d8+3' }
          ],
          resources: {
            spellSlots: { 1: 2, 2: 1, 3: 0 }
          }
        }
      });

      const decision = await service.makeTacticalDecision(context);
      
      expect(decision.action).toBe('cast_spell');
      expect(decision.target).toBe('self');
      expect(decision.details?.spell).toBe('cure-wounds');
      expect(decision.reasoning).toContain('health');
    });

    it('should suggest attacking when enemies are in range', async () => {
      const context = createTestContext();
      const decision = await service.makeTacticalDecision(context);
      
      expect(decision.action).toBe('attack');
      expect(decision.target).toBe('enemy-1');
      expect(decision.reasoning).toContain('enemy');
    });

    it('should recommend AOE spells when multiple enemies are clustered', async () => {
      const context = createTestContext({
        character: {
          ...createTestContext().character,
          class: 'wizard',
          abilities: [
            { id: 'fireball', name: 'Fireball', type: 'action', damage: '8d6', aoe: true }
          ],
          resources: {
            spellSlots: { 1: 3, 2: 2, 3: 1 }
          }
        },
        enemies: [
          { id: 'enemy-1', name: 'Goblin 1', hp: { current: 10, max: 10 }, position: { x: 10, y: 0 }, ac: 15, threat: 'low' },
          { id: 'enemy-2', name: 'Goblin 2', hp: { current: 10, max: 10 }, position: { x: 11, y: 0 }, ac: 15, threat: 'low' },
          { id: 'enemy-3', name: 'Goblin 3', hp: { current: 10, max: 10 }, position: { x: 10, y: 1 }, ac: 15, threat: 'low' }
        ]
      });

      const decision = await service.makeTacticalDecision(context);
      
      expect(decision.action).toBe('cast_spell');
      expect(decision.details?.spell).toContain('fireball');
      expect(decision.details?.aoeCenter).toBeDefined();
    });

    it('should suggest defensive positioning when outnumbered', async () => {
      const context = createTestContext({
        enemies: [
          { id: 'enemy-1', name: 'Orc 1', hp: { current: 30, max: 30 }, position: { x: 10, y: 0 }, ac: 16, threat: 'high' },
          { id: 'enemy-2', name: 'Orc 2', hp: { current: 30, max: 30 }, position: { x: -10, y: 0 }, ac: 16, threat: 'high' },
          { id: 'enemy-3', name: 'Orc 3', hp: { current: 30, max: 30 }, position: { x: 0, y: 10 }, ac: 16, threat: 'high' }
        ]
      });

      const decision = await service.makeTacticalDecision(context);
      
      expect(decision.positioning?.stance).toBe('defensive');
      expect(decision.positioning?.suggestedMove).toBeDefined();
    });

    it('should prioritize high-threat enemies', async () => {
      const context = createTestContext({
        enemies: [
          { id: 'enemy-1', name: 'Goblin', hp: { current: 10, max: 10 }, position: { x: 10, y: 0 }, ac: 15, threat: 'low' },
          { id: 'enemy-2', name: 'Ogre', hp: { current: 50, max: 50 }, position: { x: 15, y: 0 }, ac: 18, threat: 'high' }
        ]
      });

      const decision = await service.makeTacticalDecision(context);
      
      expect(decision.target).toBe('enemy-2');
      expect(decision.reasoning).toContain('threat');
    });

    it('should suggest healing allies when they are critically injured', async () => {
      const context = createTestContext({
        character: {
          ...createTestContext().character,
          class: 'cleric',
          hp: { current: 35, max: 40 },
          abilities: [
            { id: 'healing-word', name: 'Healing Word', type: 'bonus_action', healing: '1d4+3', range: 60 }
          ],
          resources: {
            spellSlots: { 1: 2, 2: 1, 3: 0 }
          }
        },
        allies: [
          {
            id: 'ally-1',
            name: 'Fighter',
            class: 'fighter',
            hp: { current: 5, max: 60 },
            position: { x: 5, y: 0 },
            conditions: []
          }
        ]
      });

      const decision = await service.makeTacticalDecision(context);
      
      expect(decision.action).toBe('cast_spell');
      expect(decision.target).toBe('ally-1');
      expect(decision.details?.spell).toContain('heal');
    });

    it('should recommend taking cover when under ranged attack', async () => {
      const context = createTestContext({
        battlefield: {
          terrain: ['grass'],
          hazards: [],
          cover: [
            { position: { x: -5, y: 0 }, type: 'full', size: 'medium' }
          ],
          lighting: 'bright' as const,
          weather: 'clear'
        },
        enemies: [
          { id: 'enemy-1', name: 'Archer', hp: { current: 20, max: 20 }, position: { x: 20, y: 0 }, ac: 15, threat: 'medium' }
        ]
      });

      const decision = await service.makeTacticalDecision(context);
      
      expect(decision.positioning?.suggestedMove).toBeDefined();
      expect(decision.positioning?.targetCover).toBe(true);
    });
  });

  describe('simulateCombat', () => {
    it('should return a valid combat simulation result', async () => {
      const party = [
        { id: 'char-1', name: 'Fighter', hp: 50, ac: 18, initiative: 10 }
      ];
      const enemies = [
        { id: 'enemy-1', name: 'Goblin', hp: 10, ac: 15, initiative: 8 }
      ];
      const battlefield = {
        terrain: ['grass'],
        hazards: [],
        cover: [],
        lighting: 'bright' as const,
        weather: 'clear'
      };

      const result = await service.simulateCombat(party, enemies, battlefield, 10);
      
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('winner');
      expect(result).toHaveProperty('rounds');
      expect(result).toHaveProperty('casualties');
      expect(result).toHaveProperty('tacticalAnalysis');
      expect(result).toHaveProperty('isComplete');
    });
  });

  describe('analyzeCharacterRole', () => {
    it('should identify tank role for high AC fighters', () => {
      const character = {
        class: 'fighter',
        level: 5,
        hp: { current: 50, max: 50 },
        ac: 20,
        abilities: []
      };

      const role = service.analyzeCharacterRole(character);
      
      expect(role.primary).toBe('tank');
      expect(role.capabilities).toContain('damage_mitigation');
    });

    it('should identify healer role for clerics', () => {
      const character = {
        class: 'cleric',
        level: 5,
        hp: { current: 40, max: 40 },
        ac: 16,
        abilities: [
          { id: 'cure-wounds', name: 'Cure Wounds', type: 'action' }
        ]
      };

      const role = service.analyzeCharacterRole(character);
      
      expect(role.primary).toBe('support');
      expect(role.capabilities).toContain('healing');
    });

    it('should identify damage dealer role for rogues', () => {
      const character = {
        class: 'rogue',
        level: 5,
        hp: { current: 30, max: 30 },
        ac: 15,
        abilities: [
          { id: 'sneak-attack', name: 'Sneak Attack', type: 'action' }
        ]
      };

      const role = service.analyzeCharacterRole(character);
      
      expect(role.primary).toBe('striker');
      expect(role.capabilities).toContain('burst_damage');
    });
  });

  describe('calculateOptimalAOEPosition', () => {
    it('should find optimal position for AOE spell', () => {
      const enemies = [
        { id: 'e1', position: { x: 10, y: 10 } },
        { id: 'e2', position: { x: 12, y: 10 } },
        { id: 'e3', position: { x: 11, y: 12 } }
      ];
      const allies = [
        { id: 'a1', position: { x: 0, y: 0 } }
      ];

      const position = service.calculateOptimalAOEPosition(enemies, allies, 20);
      
      expect(position).toBeDefined();
      expect(position.x).toBeCloseTo(11, 0);
      expect(position.y).toBeCloseTo(10.67, 0);
    });

    it('should avoid allies when calculating AOE position', () => {
      const enemies = [
        { id: 'e1', position: { x: 10, y: 10 } },
        { id: 'e2', position: { x: 12, y: 10 } }
      ];
      const allies = [
        { id: 'a1', position: { x: 11, y: 10 } }
      ];

      const position = service.calculateOptimalAOEPosition(enemies, allies, 15);
      
      expect(position).toBeDefined();
      // Position should be adjusted to avoid the ally
      const distToAlly = Math.sqrt(
        Math.pow(position.x - 11, 2) + Math.pow(position.y - 10, 2)
      );
      expect(distToAlly).toBeGreaterThan(5); // Assuming 15ft radius = 5 units
    });
  });
});
