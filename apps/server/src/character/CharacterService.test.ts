import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CharacterService } from './CharacterService';
import { Character, CreateCharacterRequest, UpdateCharacterRequest } from './types';

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-' + Math.random().toString(36).substr(2, 9))
}));

describe('CharacterService', () => {
  let service: CharacterService;
  
  const mockUserId = 'user-123';
  const mockCampaignId = 'campaign-456';

  beforeEach(() => {
    service = new CharacterService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default templates', () => {
      const templates = service.getTemplates();
      
      expect(templates).toHaveLength(2);
      expect(templates.find(t => t.id === 'fighter-basic')).toBeDefined();
      expect(templates.find(t => t.id === 'wizard-basic')).toBeDefined();
    });
  });

  describe('createCharacter', () => {
    it('should create a basic fighter character', async () => {
      const request: CreateCharacterRequest = {
        name: 'Aragorn',
        race: 'human',
        class: 'fighter',
        level: 1,
        campaignId: mockCampaignId
      };

      const character = await service.createCharacter(mockUserId, request);

      expect(character).toBeDefined();
      expect(character.name).toBe('Aragorn');
      expect(character.race).toBe('human');
      expect(character.class).toBe('fighter');
      expect(character.level).toBe(1);
      expect(character.userId).toBe(mockUserId);
      expect(character.campaignId).toBe(mockCampaignId);
      
      // Check combat stats
      expect(character.hitPoints.max).toBeGreaterThan(0);
      expect(character.hitPoints.current).toBe(character.hitPoints.max);
      expect(character.armorClass).toBeGreaterThanOrEqual(10);
      expect(character.speed).toBe(30); // Human speed
      expect(character.hitDice.type).toBe('d10'); // Fighter hit die
      
      // Check abilities exist
      expect(character.abilities).toBeDefined();
      expect(character.abilities.STR).toBeDefined();
      expect(character.abilities.STR.modifier).toBeDefined();
      
      // Check skills exist
      expect(character.skills).toBeDefined();
      expect(character.skills['Athletics']).toBeDefined();
      expect(character.skills['Athletics'].proficient).toBe(true); // Fighter proficiency
      
      // Check saving throws
      expect(character.savingThrows).toBeDefined();
      expect(character.savingThrows.STR.proficient).toBe(true); // Fighter proficiency
      expect(character.savingThrows.CON.proficient).toBe(true); // Fighter proficiency
      
      // Check equipment
      expect(character.equipment).toBeDefined();
      expect(character.equipment.length).toBeGreaterThan(0);
      
      // Check features
      expect(character.features).toBeDefined();
      expect(character.features.find(f => f.name === 'Fighting Style')).toBeDefined();
      
      // No spellcasting for fighter
      expect(character.spellcasting).toBeUndefined();
    });

    it('should create a wizard character with spellcasting', async () => {
      const request: CreateCharacterRequest = {
        name: 'Gandalf',
        race: 'elf',
        class: 'wizard',
        level: 3,
        abilities: { STR: 8, DEX: 14, CON: 12, INT: 16, WIS: 13, CHA: 10 }
      };

      const character = await service.createCharacter(mockUserId, request);

      expect(character.name).toBe('Gandalf');
      expect(character.race).toBe('elf');
      expect(character.class).toBe('wizard');
      expect(character.level).toBe(3);
      
      // Check wizard-specific stats
      expect(character.hitDice.type).toBe('d6'); // Wizard hit die
      expect(character.speed).toBe(30); // Elf speed
      
      // Check spellcasting
      expect(character.spellcasting).toBeDefined();
      expect(character.spellcasting.ability).toBe('INT');
      expect(character.spellcasting.spellAttackBonus).toBeGreaterThan(0);
      expect(character.spellcasting.spellSaveDC).toBeGreaterThan(8);
      expect(character.spellcasting.spellSlots['1']).toBeDefined();
      expect(character.spellcasting.spellSlots['2']).toBeDefined();
      expect(character.spellcasting.cantripsKnown).toBe(3);
      expect(character.spellcasting.spellsKnown).toBe(6); // Wizard spellbook
      
      // Check abilities were applied
      expect(character.abilities.INT.value).toBe(16);
      expect(character.abilities.INT.modifier).toBe(3);
      
      // Check wizard features
      expect(character.features.find(f => f.name === 'Arcane Recovery')).toBeDefined();
    });

    it('should apply character template when specified', async () => {
      const request: CreateCharacterRequest = {
        name: 'Template Fighter',
        race: 'human',
        class: 'fighter',
        templateId: 'fighter-basic'
      };

      const character = await service.createCharacter(mockUserId, request);

      expect(character).toBeDefined();
      expect(character.abilities.STR.value).toBe(15);
      expect(character.abilities.CHA.value).toBe(8);
    });

    it('should calculate correct HP based on class and constitution', async () => {
      const request: CreateCharacterRequest = {
        name: 'Tough Guy',
        race: 'dwarf',
        class: 'barbarian',
        level: 5,
        abilities: { STR: 16, DEX: 14, CON: 18, INT: 10, WIS: 12, CHA: 8 }
      };

      const character = await service.createCharacter(mockUserId, request);

      // Barbarian d12 hit die, +4 CON modifier
      // Level 1: 12 + 4 = 16
      // Levels 2-5: 4 * (7 + 4) = 44
      // Total: 60
      expect(character.hitPoints.max).toBe(60);
      expect(character.hitDice.type).toBe('d12');
      expect(character.hitDice.total).toBe(5);
    });

    it('should apply racial bonuses and traits', async () => {
      const request: CreateCharacterRequest = {
        name: 'Legolas',
        race: 'elf',
        class: 'ranger',
        level: 1
      };

      const character = await service.createCharacter(mockUserId, request);

      // Elf gets +2 DEX
      expect(character.abilities.DEX.value).toBe(12);
      expect(character.traits).toContain('Darkvision');
      expect(character.traits).toContain('Fey Ancestry');
      expect(character.traits).toContain('Trance');
      expect(character.speed).toBe(30); // Elf speed
    });

    it('should handle halfling race with reduced speed', async () => {
      const request: CreateCharacterRequest = {
        name: 'Frodo',
        race: 'halfling',
        class: 'rogue',
        level: 1
      };

      const character = await service.createCharacter(mockUserId, request);

      expect(character.speed).toBe(25); // Halfling speed
      expect(character.traits).toContain('Lucky');
      expect(character.traits).toContain('Brave');
      expect(character.traits).toContain('Halfling Nimbleness');
    });

    it('should set default values when not provided', async () => {
      const request: CreateCharacterRequest = {
        name: 'Minimal',
        race: 'human',
        class: 'fighter'
      };

      const character = await service.createCharacter(mockUserId, request);

      expect(character.level).toBe(1);
      expect(character.background).toBe('folk-hero');
      expect(character.alignment).toBe('true-neutral');
      expect(character.experience).toBe(0);
      expect(character.campaignId).toBeUndefined();
    });

    it('should calculate correct proficiency bonus by level', async () => {
      const testCases = [
        { level: 1, expectedBonus: 2 },
        { level: 4, expectedBonus: 2 },
        { level: 5, expectedBonus: 3 },
        { level: 8, expectedBonus: 3 },
        { level: 9, expectedBonus: 4 },
        { level: 12, expectedBonus: 4 },
        { level: 13, expectedBonus: 5 },
        { level: 16, expectedBonus: 5 },
        { level: 17, expectedBonus: 6 },
        { level: 20, expectedBonus: 6 }
      ];

      for (const { level, expectedBonus } of testCases) {
        const character = await service.createCharacter(mockUserId, {
          name: `Level ${level} Character`,
          race: 'human',
          class: 'fighter',
          level
        });
        
        expect(character.proficiencyBonus).toBe(expectedBonus);
      }
    });
  });

  describe('getCharacter', () => {
    it('should return character by ID', async () => {
      const created = await service.createCharacter(mockUserId, {
        name: 'Test Character',
        race: 'human',
        class: 'fighter'
      });

      const retrieved = await service.getCharacter(created.id);

      expect(retrieved).toEqual(created);
    });

    it('should return null for non-existent character', async () => {
      const character = await service.getCharacter('non-existent');
      expect(character).toBeNull();
    });
  });

  describe('getCharactersByUser', () => {
    it('should return all characters for a user', async () => {
      await service.createCharacter(mockUserId, {
        name: 'Character 1',
        race: 'human',
        class: 'fighter'
      });

      await service.createCharacter(mockUserId, {
        name: 'Character 2',
        race: 'elf',
        class: 'wizard'
      });

      await service.createCharacter('other-user', {
        name: 'Other Character',
        race: 'dwarf',
        class: 'cleric'
      });

      const characters = await service.getCharactersByUser(mockUserId);

      expect(characters).toHaveLength(2);
      expect(characters.every(c => c.userId === mockUserId)).toBe(true);
    });

    it('should return empty array for user with no characters', async () => {
      const characters = await service.getCharactersByUser('no-characters-user');
      expect(characters).toEqual([]);
    });
  });

  describe('updateCharacter', () => {
    let character: Character;

    beforeEach(async () => {
      character = await service.createCharacter(mockUserId, {
        name: 'Original Name',
        race: 'human',
        class: 'fighter',
        level: 1
      });
    });

    it('should update character name', async () => {
      const updated = await service.updateCharacter(character.id, mockUserId, {
        name: 'New Name'
      });

      expect(updated).toBeDefined();
      expect(updated?.name).toBe('New Name');
      expect(updated?.race).toBe('human'); // Unchanged
    });

    it('should handle level up correctly', async () => {
      const originalHitDice = character.hitDice.current;
      
      const updated = await service.updateCharacter(character.id, mockUserId, {
        level: 3
      });

      expect(updated?.level).toBe(3);
      expect(updated?.proficiencyBonus).toBe(2); // Still 2 at level 3
      expect(updated?.hitDice.total).toBe(3);
      expect(updated?.hitDice.current).toBe(originalHitDice + 2);
    });

    it('should update hit points', async () => {
      const updated = await service.updateCharacter(character.id, mockUserId, {
        hitPoints: {
          current: 5,
          max: character.hitPoints.max,
          temporary: 3
        }
      });

      expect(updated?.hitPoints.current).toBe(5);
      expect(updated?.hitPoints.temporary).toBe(3);
    });

    it('should update abilities and recalculate modifiers', async () => {
      const updated = await service.updateCharacter(character.id, mockUserId, {
        abilities: {
          STR: { value: 18 }
        }
      });

      expect(updated?.abilities.STR.value).toBe(18);
      expect(updated?.abilities.STR.modifier).toBe(4); // (18-10)/2
    });

    it('should update equipment', async () => {
      const newEquipment = [
        { id: 'item-1', name: 'Magic Sword', type: 'weapon', quantity: 1, weight: 3 }
      ];

      const updated = await service.updateCharacter(character.id, mockUserId, {
        equipment: newEquipment
      });

      expect(updated?.equipment).toEqual(newEquipment);
    });

    it('should update personality traits', async () => {
      const updated = await service.updateCharacter(character.id, mockUserId, {
        personality: {
          traits: ['Brave', 'Loyal'],
          ideals: ['Justice'],
          bonds: ['Family'],
          flaws: ['Stubborn']
        }
      });

      expect(updated?.personality.traits).toEqual(['Brave', 'Loyal']);
      expect(updated?.personality.ideals).toEqual(['Justice']);
    });

    it('should update notes', async () => {
      const updated = await service.updateCharacter(character.id, mockUserId, {
        notes: 'New backstory information'
      });

      expect(updated?.notes).toBe('New backstory information');
    });

    it('should update experience', async () => {
      const updated = await service.updateCharacter(character.id, mockUserId, {
        experience: 300
      });

      expect(updated?.experience).toBe(300);
    });

    it('should return null for unauthorized user', async () => {
      const updated = await service.updateCharacter(character.id, 'other-user', {
        name: 'Hacked Name'
      });

      expect(updated).toBeNull();
    });

    it('should return null for non-existent character', async () => {
      const updated = await service.updateCharacter('non-existent', mockUserId, {
        name: 'New Name'
      });

      expect(updated).toBeNull();
    });

    it('should update the updatedAt timestamp', async () => {
      const originalUpdatedAt = character.updatedAt;
      
      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const updated = await service.updateCharacter(character.id, mockUserId, {
        name: 'Updated Name'
      });

      expect(updated?.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  describe('deleteCharacter', () => {
    it('should delete character for authorized user', async () => {
      const character = await service.createCharacter(mockUserId, {
        name: 'To Delete',
        race: 'human',
        class: 'fighter'
      });

      const result = await service.deleteCharacter(character.id, mockUserId);
      
      expect(result).toBe(true);
      
      const retrieved = await service.getCharacter(character.id);
      expect(retrieved).toBeNull();
    });

    it('should return false for unauthorized user', async () => {
      const character = await service.createCharacter(mockUserId, {
        name: 'Protected',
        race: 'human',
        class: 'fighter'
      });

      const result = await service.deleteCharacter(character.id, 'other-user');
      
      expect(result).toBe(false);
      
      const retrieved = await service.getCharacter(character.id);
      expect(retrieved).toBeDefined();
    });

    it('should return false for non-existent character', async () => {
      const result = await service.deleteCharacter('non-existent', mockUserId);
      expect(result).toBe(false);
    });
  });

  describe('Class-specific features', () => {
    it('should apply correct skills for rogue class', async () => {
      const character = await service.createCharacter(mockUserId, {
        name: 'Sneaky',
        race: 'halfling',
        class: 'rogue',
        level: 1
      });

      // Rogue has many skill proficiencies
      expect(character.skills['Stealth'].proficient).toBe(true);
      expect(character.skills['Acrobatics'].proficient).toBe(true);
      expect(character.skills['Sleight of Hand'].proficient).toBe(true);
      expect(character.features.find(f => f.name === 'Sneak Attack')).toBeDefined();
    });

    it('should apply correct skills for ranger class', async () => {
      const character = await service.createCharacter(mockUserId, {
        name: 'Tracker',
        race: 'elf',
        class: 'ranger',
        level: 2
      });

      expect(character.skills['Survival'].proficient).toBe(true);
      expect(character.skills['Nature'].proficient).toBe(true);
      expect(character.skills['Animal Handling'].proficient).toBe(true);
      
      // Ranger gets spells at level 2
      expect(character.spellcasting).toBeDefined();
      expect(character.spellcasting.ability).toBe('WIS');
    });

    it('should apply correct saving throws for each class', async () => {
      const testCases = [
        { class: 'barbarian', saves: ['STR', 'CON'] },
        { class: 'bard', saves: ['DEX', 'CHA'] },
        { class: 'cleric', saves: ['WIS', 'CHA'] },
        { class: 'druid', saves: ['INT', 'WIS'] },
        { class: 'fighter', saves: ['STR', 'CON'] },
        { class: 'monk', saves: ['STR', 'DEX'] },
        { class: 'paladin', saves: ['WIS', 'CHA'] },
        { class: 'ranger', saves: ['STR', 'DEX'] },
        { class: 'rogue', saves: ['DEX', 'INT'] },
        { class: 'sorcerer', saves: ['CON', 'CHA'] },
        { class: 'warlock', saves: ['WIS', 'CHA'] },
        { class: 'wizard', saves: ['INT', 'WIS'] }
      ];

      for (const { class: charClass, saves } of testCases) {
        const character = await service.createCharacter(mockUserId, {
          name: `${charClass} test`,
          race: 'human',
          class: charClass,
          level: 1
        });

        for (const save of saves) {
          expect(character.savingThrows[save].proficient).toBe(true);
        }
      }
    });
  });

  describe('Spellcasting', () => {
    it('should initialize spellcasting for cleric', async () => {
      const character = await service.createCharacter(mockUserId, {
        name: 'Healer',
        race: 'human',
        class: 'cleric',
        level: 5,
        abilities: { STR: 10, DEX: 10, CON: 14, INT: 12, WIS: 16, CHA: 13 }
      });

      expect(character.spellcasting).toBeDefined();
      expect(character.spellcasting.ability).toBe('WIS');
      expect(character.spellcasting.spellAttackBonus).toBe(6); // +3 WIS mod + 3 prof
      expect(character.spellcasting.spellSaveDC).toBe(14); // 8 + 3 WIS + 3 prof
      expect(character.spellcasting.spellSlots['1']).toBeDefined();
      expect(character.spellcasting.spellSlots['2']).toBeDefined();
      expect(character.spellcasting.spellSlots['3']).toBeDefined();
    });

    it('should initialize spellcasting for sorcerer', async () => {
      const character = await service.createCharacter(mockUserId, {
        name: 'Wild Mage',
        race: 'tiefling',
        class: 'sorcerer',
        level: 3,
        abilities: { STR: 8, DEX: 14, CON: 13, INT: 12, WIS: 10, CHA: 16 }
      });

      expect(character.spellcasting).toBeDefined();
      expect(character.spellcasting.ability).toBe('CHA');
      expect(character.spellcasting.spellAttackBonus).toBe(5); // +3 CHA mod + 2 prof
      expect(character.spellcasting.spellSaveDC).toBe(13); // 8 + 3 CHA + 2 prof
      expect(character.spellcasting.cantripsKnown).toBe(3);
      expect(character.spellcasting.spellsKnown).toBe(4); // level + 1
    });

    it('should not add spellcasting for non-spellcasters', async () => {
      const character = await service.createCharacter(mockUserId, {
        name: 'Pure Fighter',
        race: 'human',
        class: 'fighter',
        level: 5
      });

      expect(character.spellcasting).toBeUndefined();
    });

    it('should handle paladin spellcasting starting at level 2', async () => {
      const level1Paladin = await service.createCharacter(mockUserId, {
        name: 'Holy Warrior 1',
        race: 'human',
        class: 'paladin',
        level: 1
      });

      const level2Paladin = await service.createCharacter(mockUserId, {
        name: 'Holy Warrior 2',
        race: 'human',
        class: 'paladin',
        level: 2
      });

      // Paladins get spells at level 2
      expect(level1Paladin.spellcasting).toBeDefined(); // Basic structure
      expect(level1Paladin.spellcasting.spellsKnown).toBe(0);
      
      expect(level2Paladin.spellcasting).toBeDefined();
      expect(level2Paladin.spellcasting.spellsKnown).toBe(1);
    });
  });

  describe('Templates', () => {
    it('should use fighter template correctly', () => {
      const templates = service.getTemplates();
      const fighterTemplate = templates.find(t => t.id === 'fighter-basic');

      expect(fighterTemplate).toBeDefined();
      expect(fighterTemplate?.name).toBe('Basic Fighter');
      expect(fighterTemplate?.class).toBe('fighter');
      expect(fighterTemplate?.abilities.STR).toBe(15);
      expect(fighterTemplate?.abilities.CHA).toBe(8);
    });

    it('should use wizard template correctly', () => {
      const templates = service.getTemplates();
      const wizardTemplate = templates.find(t => t.id === 'wizard-basic');

      expect(wizardTemplate).toBeDefined();
      expect(wizardTemplate?.name).toBe('Basic Wizard');
      expect(wizardTemplate?.class).toBe('wizard');
      expect(wizardTemplate?.race).toBe('elf');
      expect(wizardTemplate?.abilities.INT).toBe(15);
      expect(wizardTemplate?.abilities.STR).toBe(8);
    });
  });
});
