/**
 * Character management service
 */

import {
  Character,
  CreateCharacterRequest,
  UpdateCharacterRequest,
  CharacterTemplate,
  Ability,
  Skill,
} from "./types";
import { v4 as uuidv4 } from "uuid";

export class CharacterService {
  private characters = new Map<string, Character>();
  private templates = new Map<string, CharacterTemplate>();

  constructor() {
    this.initializeDefaultTemplates();
  }

  /**
   * Create a new character
   */
  async createCharacter(userId: string, request: CreateCharacterRequest): Promise<Character> {
    const characterId = uuidv4();
    const now = new Date();

    // Apply template if specified
    let templateData: Partial<CharacterTemplate> = {};
    if (request.templateId) {
      const template = this.templates.get(request.templateId);
      if (template) {
        templateData = template;
      }
    }

    // Calculate ability modifiers
    const abilities = this.calculateAbilities(
      request.abilities || templateData.abilities || this.getDefaultAbilities(request.race),
    );

    // Calculate skills based on class and abilities
    const skills = this.calculateSkills(request.class, abilities);

    // Calculate saving throws
    const savingThrows = this.calculateSavingThrows(request.class, abilities);

    const character: Character = {
      id: characterId,
      userId,
      campaignId: request.campaignId || undefined,

      // Basic Info
      name: request.name,
      race: request.race,
      class: request.class,
      level: request.level || templateData.level || 1,
      background: request.background || "folk-hero",
      alignment: request.alignment || "true-neutral",

      // Core Stats
      experience: 0,
      hitPoints: {
        current: this.calculateMaxHP(
          request.class,
          request.level || 1,
          abilities.CON?.modifier || 0,
        ),
        max: this.calculateMaxHP(request.class, request.level || 1, abilities.CON?.modifier || 0),
        temporary: 0,
      },
      armorClass: 10 + (abilities.DEX?.modifier || 0),
      proficiencyBonus: this.calculateProficiencyBonus(request.level || 1),
      speed: this.getRaceSpeed(request.race),

      // Abilities, skills, saves
      abilities,
      skills,
      savingThrows,

      // Combat
      initiative: abilities.DEX?.modifier || 0,
      hitDice: {
        total: request.level || 1,
        current: request.level || 1,
        type: this.getClassHitDie(request.class),
      },

      // Equipment
      equipment: this.getStartingEquipment(request.class, request.background || "folk-hero"),
      currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },

      // Features
      features: this.getClassFeatures(request.class, request.level || 1),
      traits: this.getRaceTraits(request.race),

      // Roleplay
      personality: {
        traits: [],
        ideals: [],
        bonds: [],
        flaws: [],
      },

      notes: "",
      createdAt: now,
      updatedAt: now,
    };

    // Add spellcasting if class supports it
    if (this.isSpellcaster(request.class)) {
      character.spellcasting = this.initializeSpellcasting(
        request.class,
        request.level || 1,
        abilities,
      );
    }

    this.characters.set(characterId, character);
    return character;
  }

  /**
   * Get character by ID
   */
  async getCharacter(characterId: string): Promise<Character | null> {
    return this.characters.get(characterId) || null;
  }

  /**
   * Get characters by user ID
   */
  async getCharactersByUser(userId: string): Promise<Character[]> {
    return Array.from(this.characters.values()).filter((char) => char.userId === userId);
  }

  /**
   * Update character
   */
  async updateCharacter(
    characterId: string,
    userId: string,
    update: UpdateCharacterRequest,
  ): Promise<Character | null> {
    const character = this.characters.get(characterId);

    if (!character || character.userId !== userId) {
      return null;
    }

    // Apply updates
    if (update.name) {character.name = update.name;}
    if (update.level) {
      const oldLevel = character.level;
      character.level = update.level;
      character.proficiencyBonus = this.calculateProficiencyBonus(update.level);

      // Update hit dice and potentially hit points on level up
      if (update.level > oldLevel) {
        character.hitDice.total = update.level;
        character.hitDice.current = Math.min(
          character.hitDice.current + (update.level - oldLevel),
          update.level,
        );
      }
    }
    if (update.experience !== undefined) {character.experience = update.experience;}
    if (update.hitPoints) {
      Object.assign(character.hitPoints, update.hitPoints);
    }
    if (update.abilities) {
      for (const [abilityName, abilityUpdate] of Object.entries(update.abilities)) {
        if (character.abilities[abilityName] && abilityUpdate) {
          Object.assign(character.abilities[abilityName], abilityUpdate);
          // Recalculate modifier if value changed
          if (abilityUpdate.value !== undefined) {
            character.abilities[abilityName].modifier = Math.floor((abilityUpdate.value - 10) / 2);
          }
        }
      }
    }
    if (update.equipment) {character.equipment = update.equipment;}
    if (update.notes !== undefined) {character.notes = update.notes;}
    if (update.personality) {
      Object.assign(character.personality, update.personality);
    }

    character.updatedAt = new Date();
    return character;
  }

  /**
   * Delete character
   */
  async deleteCharacter(characterId: string, userId: string): Promise<boolean> {
    const character = this.characters.get(characterId);

    if (!character || character.userId !== userId) {
      return false;
    }

    return this.characters.delete(characterId);
  }

  /**
   * Get available character templates
   */
  getTemplates(): CharacterTemplate[] {
    return Array.from(this.templates.values());
  }

  // Helper methods for character creation
  private calculateAbilities(abilityScores: Record<string, number>): Record<string, Ability> {
    const abilities: Record<string, Ability> = {};

    for (const [name, value] of Object.entries(abilityScores)) {
      abilities[name] = {
        name,
        value,
        modifier: Math.floor((value - 10) / 2),
      };
    }

    return abilities;
  }

  private getDefaultAbilities(race: string): Record<string, number> {
    const base = { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 };

    // Apply racial bonuses
    switch (race.toLowerCase()) {
      case "human":
        return { STR: 11, DEX: 11, CON: 11, INT: 11, WIS: 11, CHA: 11 };
      case "elf":
        return { ...base, DEX: 12 };
      case "dwarf":
        return { ...base, CON: 12 };
      case "halfling":
        return { ...base, DEX: 12 };
      case "dragonborn":
        return { ...base, STR: 12, CHA: 11 };
      case "gnome":
        return { ...base, INT: 12 };
      case "half-elf":
        return { ...base, CHA: 12 };
      case "half-orc":
        return { ...base, STR: 12, CON: 11 };
      case "tiefling":
        return { ...base, CHA: 12 };
      default:
        return base;
    }
  }

  private calculateSkills(
    characterClass: string,
    abilities: Record<string, Ability>,
  ): Record<string, Skill> {
    const skills: Record<string, Skill> = {};
    const proficiencyBonus = 2; // Level 1 proficiency bonus

    // Define all skills
    const skillList = [
      { name: "Acrobatics", ability: "DEX" },
      { name: "Animal Handling", ability: "WIS" },
      { name: "Arcana", ability: "INT" },
      { name: "Athletics", ability: "STR" },
      { name: "Deception", ability: "CHA" },
      { name: "History", ability: "INT" },
      { name: "Insight", ability: "WIS" },
      { name: "Intimidation", ability: "CHA" },
      { name: "Investigation", ability: "INT" },
      { name: "Medicine", ability: "WIS" },
      { name: "Nature", ability: "INT" },
      { name: "Perception", ability: "WIS" },
      { name: "Performance", ability: "CHA" },
      { name: "Persuasion", ability: "CHA" },
      { name: "Religion", ability: "INT" },
      { name: "Sleight of Hand", ability: "DEX" },
      { name: "Stealth", ability: "DEX" },
      { name: "Survival", ability: "WIS" },
    ];

    // Get class proficiencies
    const classProficiencies = this.getClassSkillProficiencies(characterClass);

    for (const skill of skillList) {
      const abilityMod = abilities[skill.ability]?.modifier || 0;
      const proficient = classProficiencies.includes(skill.name);

      skills[skill.name] = {
        name: skill.name,
        ability: skill.ability,
        proficient,
        value: abilityMod + (proficient ? proficiencyBonus : 0),
        modifier: abilityMod,
      };
    }

    return skills;
  }

  private calculateSavingThrows(
    characterClass: string,
    abilities: Record<string, Ability>,
  ): Record<string, { proficient: boolean; value: number }> {
    const saves: Record<string, { proficient: boolean; value: number }> = {};
    const proficiencyBonus = 2;
    const classSaveProficiencies = this.getClassSaveProficiencies(characterClass);

    for (const [abilityName, ability] of Object.entries(abilities)) {
      const proficient = classSaveProficiencies.includes(abilityName);
      saves[abilityName] = {
        proficient,
        value: ability.modifier + (proficient ? proficiencyBonus : 0),
      };
    }

    return saves;
  }

  private calculateMaxHP(characterClass: string, level: number, conMod: number): number {
    const hitDie = this.getClassHitDieValue(characterClass);
    const firstLevelHP = hitDie + conMod;
    const additionalLevels = level - 1;
    const avgRoll = Math.floor(hitDie / 2) + 1;

    return firstLevelHP + additionalLevels * (avgRoll + conMod);
  }

  private calculateProficiencyBonus(level: number): number {
    return Math.ceil(level / 4) + 1;
  }

  private getRaceSpeed(race: string): number {
    switch (race.toLowerCase()) {
      case "dwarf":
      case "halfling":
      case "gnome":
        return 25;
      case "elf":
      case "human":
      case "dragonborn":
      case "half-elf":
      case "half-orc":
      case "tiefling":
      default:
        return 30;
    }
  }

  private getClassHitDie(characterClass: string): string {
    switch (characterClass.toLowerCase()) {
      case "barbarian":
        return "d12";
      case "fighter":
      case "paladin":
      case "ranger":
        return "d10";
      case "bard":
      case "cleric":
      case "druid":
      case "monk":
      case "rogue":
      case "warlock":
        return "d8";
      case "sorcerer":
      case "wizard":
        return "d6";
      default:
        return "d8";
    }
  }

  private getClassHitDieValue(characterClass: string): number {
    switch (characterClass.toLowerCase()) {
      case "barbarian":
        return 12;
      case "fighter":
      case "paladin":
      case "ranger":
        return 10;
      case "bard":
      case "cleric":
      case "druid":
      case "monk":
      case "rogue":
      case "warlock":
        return 8;
      case "sorcerer":
      case "wizard":
        return 6;
      default:
        return 8;
    }
  }

  private getClassSkillProficiencies(characterClass: string): string[] {
    switch (characterClass.toLowerCase()) {
      case "barbarian":
        return ["Animal Handling", "Athletics"];
      case "bard":
        return ["Deception", "History", "Investigation", "Persuasion"];
      case "cleric":
        return ["History", "Medicine"];
      case "druid":
        return ["Arcana", "Medicine"];
      case "fighter":
        return ["Acrobatics", "Athletics"];
      case "monk":
        return ["Acrobatics", "Athletics"];
      case "paladin":
        return ["Athletics", "Religion"];
      case "ranger":
        return [
          "Animal Handling",
          "Athletics",
          "Insight",
          "Investigation",
          "Nature",
          "Perception",
          "Stealth",
          "Survival",
        ];
      case "rogue":
        return [
          "Acrobatics",
          "Athletics",
          "Deception",
          "Insight",
          "Intimidation",
          "Investigation",
          "Perception",
          "Performance",
          "Persuasion",
          "Sleight of Hand",
          "Stealth",
        ];
      case "sorcerer":
        return ["Arcana", "Deception"];
      case "warlock":
        return ["Arcana", "Deception"];
      case "wizard":
        return ["Arcana", "History"];
      default:
        return [];
    }
  }

  private getClassSaveProficiencies(characterClass: string): string[] {
    switch (characterClass.toLowerCase()) {
      case "barbarian":
        return ["STR", "CON"];
      case "bard":
        return ["DEX", "CHA"];
      case "cleric":
        return ["WIS", "CHA"];
      case "druid":
        return ["INT", "WIS"];
      case "fighter":
        return ["STR", "CON"];
      case "monk":
        return ["STR", "DEX"];
      case "paladin":
        return ["WIS", "CHA"];
      case "ranger":
        return ["STR", "DEX"];
      case "rogue":
        return ["DEX", "INT"];
      case "sorcerer":
        return ["CON", "CHA"];
      case "warlock":
        return ["WIS", "CHA"];
      case "wizard":
        return ["INT", "WIS"];
      default:
        return [];
    }
  }

  private getStartingEquipment(characterClass: string, _background: string): any[] {
    const equipment = [
      { id: uuidv4(), name: "Explorer's Pack", type: "misc", quantity: 1, weight: 59 },
      { id: uuidv4(), name: "Clothes, Common", type: "misc", quantity: 1, weight: 3 },
    ];

    // Add class-specific equipment
    switch (characterClass.toLowerCase()) {
      case "fighter":
        equipment.push(
          {
            id: uuidv4(),
            name: "Longsword",
            type: "weapon",
            quantity: 1,
            weight: 3,
            equipped: true,
          } as any,
          {
            id: uuidv4(),
            name: "Shield",
            type: "armor",
            quantity: 1,
            weight: 6,
            equipped: true,
          } as any,
        );
        break;
      case "wizard":
        equipment.push({ id: uuidv4(), name: "Spellbook", type: "misc", quantity: 1, weight: 3 }, {
          id: uuidv4(),
          name: "Quarterstaff",
          type: "weapon",
          quantity: 1,
          weight: 4,
          equipped: true,
        } as any);
        break;
      case "rogue":
        equipment.push(
          {
            id: uuidv4(),
            name: "Shortsword",
            type: "weapon",
            quantity: 1,
            weight: 2,
            equipped: true,
          } as any,
          { id: uuidv4(), name: "Thieves' Tools", type: "tool", quantity: 1, weight: 1 },
        );
        break;
    }

    return equipment;
  }

  private getClassFeatures(characterClass: string, level: number): any[] {
    const features = [];

    // Level 1 features for each class
    switch (characterClass.toLowerCase()) {
      case "fighter":
        features.push({
          id: uuidv4(),
          name: "Fighting Style",
          level: 1,
          description: "Choose a fighting style that reflects your training.",
        });
        if (level >= 2) {
          features.push({
            id: uuidv4(),
            name: "Action Surge",
            level: 2,
            description: "Take an additional action on your turn.",
            uses: { max: 1, current: 1, resetOn: "short" },
          });
        }
        break;
      case "wizard":
        features.push({
          id: uuidv4(),
          name: "Arcane Recovery",
          level: 1,
          description: "Recover spell slots during a short rest.",
          uses: { max: 1, current: 1, resetOn: "long" },
        });
        break;
      case "rogue":
        features.push({
          id: uuidv4(),
          name: "Sneak Attack",
          level: 1,
          description: "Deal extra damage when you have advantage or an ally is near your target.",
        });
        break;
    }

    return features;
  }

  private getRaceTraits(race: string): string[] {
    switch (race.toLowerCase()) {
      case "elf":
        return ["Darkvision", "Fey Ancestry", "Trance"];
      case "dwarf":
        return ["Darkvision", "Dwarven Resilience", "Stonecunning"];
      case "halfling":
        return ["Lucky", "Brave", "Halfling Nimbleness"];
      case "human":
        return ["Versatile"];
      case "dragonborn":
        return ["Draconic Ancestry", "Breath Weapon", "Damage Resistance"];
      default:
        return [];
    }
  }

  private isSpellcaster(characterClass: string): boolean {
    const spellcasters = [
      "wizard",
      "sorcerer",
      "warlock",
      "cleric",
      "druid",
      "bard",
      "paladin",
      "ranger",
    ];
    return spellcasters.includes(characterClass.toLowerCase());
  }

  private initializeSpellcasting(
    characterClass: string,
    level: number,
    abilities: Record<string, Ability>,
  ): any {
    const spellcastingAbility = this.getSpellcastingAbility(characterClass);
    const abilityMod = abilities[spellcastingAbility]?.modifier || 0;
    const proficiencyBonus = this.calculateProficiencyBonus(level);

    return {
      ability: spellcastingAbility,
      spellAttackBonus: abilityMod + proficiencyBonus,
      spellSaveDC: 8 + abilityMod + proficiencyBonus,
      spellSlots: this.getSpellSlots(characterClass, level),
      spells: [],
      cantripsKnown: this.getCantripsKnown(characterClass, level),
      spellsKnown: this.getSpellsKnown(characterClass, level),
    };
  }

  private getSpellcastingAbility(characterClass: string): string {
    switch (characterClass.toLowerCase()) {
      case "wizard":
        return "INT";
      case "cleric":
      case "druid":
      case "ranger":
        return "WIS";
      case "sorcerer":
      case "bard":
      case "paladin":
      case "warlock":
        return "CHA";
      default:
        return "INT";
    }
  }

  private getSpellSlots(
    characterClass: string,
    level: number,
  ): Record<string, { max: number; current: number }> {
    const slots: Record<string, { max: number; current: number }> = {};

    if (level >= 1) {slots["1"] = { max: 2, current: 2 };}
    if (level >= 3) {slots["2"] = { max: 1, current: 1 };}
    if (level >= 5) {slots["3"] = { max: 1, current: 1 };}

    return slots;
  }

  private getCantripsKnown(characterClass: string, level: number): number {
    switch (characterClass.toLowerCase()) {
      case "wizard":
      case "sorcerer":
      case "warlock":
        return level >= 4 ? 4 : 3;
      case "bard":
      case "cleric":
      case "druid":
        return level >= 4 ? 3 : 2;
      default:
        return 0;
    }
  }

  private getSpellsKnown(characterClass: string, level: number): number {
    switch (characterClass.toLowerCase()) {
      case "wizard":
        return 6; // Spellbook starts with 6 spells
      case "sorcerer":
      case "bard":
      case "warlock":
        return level + 1;
      case "ranger":
        return level >= 2 ? Math.floor(level / 2) + 1 : 0;
      case "paladin":
        return level >= 2 ? Math.floor(level / 2) : 0;
      default:
        return 0;
    }
  }

  private initializeDefaultTemplates(): void {
    const fighterTemplate: CharacterTemplate = {
      id: "fighter-basic",
      name: "Basic Fighter",
      description: "A straightforward fighter build",
      race: "human",
      class: "fighter",
      level: 1,
      abilities: { STR: 15, DEX: 13, CON: 14, INT: 10, WIS: 12, CHA: 8 },
      equipment: [],
      features: [],
    };

    const wizardTemplate: CharacterTemplate = {
      id: "wizard-basic",
      name: "Basic Wizard",
      description: "A scholarly wizard build",
      race: "elf",
      class: "wizard",
      level: 1,
      abilities: { STR: 8, DEX: 14, CON: 13, INT: 15, WIS: 12, CHA: 10 },
      equipment: [],
      features: [],
    };

    this.templates.set(fighterTemplate.id, fighterTemplate);
    this.templates.set(wizardTemplate.id, wizardTemplate);
  }
}
