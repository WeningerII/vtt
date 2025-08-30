/**
 * Unified Character Schema - Shared between frontend and backend
 */

export interface Ability {
  name: string;
  value: number;
  modifier: number;
}

export interface Skill {
  name: string;
  ability: string;
  proficient: boolean;
  expertise?: boolean;
  value: number;
  modifier: number;
}

export interface SavingThrow {
  proficient: boolean;
  value: number;
}

export interface HitPoints {
  current: number;
  max: number;
  temporary: number;
}

export interface HitDice {
  total: number;
  current: number;
  type: string; // e.g., "d8", "d10"
}

export interface Currency {
  cp: number; // copper pieces
  sp: number; // silver pieces
  ep: number; // electrum pieces
  gp: number; // gold pieces
  pp: number; // platinum pieces
}

export interface Equipment {
  id: string;
  name: string;
  type: 'weapon' | 'armor' | 'shield' | 'tool' | 'consumable' | 'treasure' | 'other';
  quantity: number;
  weight: number;
  value: number; // in gold pieces
  description: string;
  equipped: boolean;
  properties: string[];
  attackBonus?: number;
  damage?: {
    diceExpression: string;
    damageType: string;
    versatile?: string;
  };
  armorClass?: number;
}

export interface Spell {
  id: string;
  name: string;
  level: number;
  school: string;
  castingTime: string;
  range: string;
  components: string[];
  duration: string;
  description: string;
  prepared: boolean;
  known: boolean;
  ritual?: boolean;
  concentration?: boolean;
}

export interface Spellcasting {
  ability: string; // 'INT', 'WIS', 'CHA'
  spellAttackBonus: number;
  spellSaveDC: number;
  spellSlots: Record<string, { max: number; current: number }>;
  spells: Spell[];
  cantripsKnown: number;
  spellsKnown: number;
  spellsPrepared?: number;
  ritualCasting?: boolean;
}

export interface Feature {
  id: string;
  name: string;
  source: string;
  description: string;
  type: 'class' | 'race' | 'background' | 'feat' | 'other';
  level?: number;
  uses?: {
    current: number;
    max: number;
    resetOn: 'short' | 'long' | 'other';
  };
}

export interface Personality {
  traits: string[];
  ideals: string[];
  bonds: string[];
  flaws: string[];
}

export interface Character {
  // Core Identity
  id: string;
  userId: string;
  campaignId?: string;
  
  // Basic Information
  name: string;
  race: string;
  class: string;
  level: number;
  background: string;
  alignment: string;
  
  // Experience and Progression
  experience: number;
  
  // Core Combat Stats
  hitPoints: HitPoints;
  armorClass: number;
  proficiencyBonus: number;
  speed: number;
  initiative: number;
  
  // Hit Dice for resting
  hitDice: HitDice;
  
  // Core Abilities
  abilities: Record<string, Ability>; // STR, DEX, CON, INT, WIS, CHA
  
  // Skills and Saves
  skills: Record<string, Skill>;
  savingThrows: Record<string, SavingThrow>;
  
  // Equipment and Wealth
  equipment: Equipment[];
  currency: Currency;
  
  // Magic
  spellcasting?: Spellcasting;
  
  // Features and Traits
  features: Feature[];
  traits: string[]; // Racial traits
  
  // Roleplay
  personality: Personality;
  notes: string;
  avatar?: string;
  
  // Meta
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCharacterRequest {
  name: string;
  race: string;
  class: string;
  level?: number;
  background?: string;
  alignment?: string;
  abilities?: Record<string, number>;
  campaignId?: string;
  templateId?: string;
}

export interface UpdateCharacterRequest {
  name?: string;
  level?: number;
  experience?: number;
  hitPoints?: Partial<HitPoints>;
  abilities?: Record<string, Partial<Ability>>;
  equipment?: Equipment[];
  notes?: string;
  personality?: Partial<Personality>;
  spellcasting?: Partial<Spellcasting>;
}

export interface CharacterTemplate {
  id: string;
  name: string;
  description: string;
  race: string;
  class: string;
  level: number;
  abilities: Record<string, number>;
  equipment: Equipment[];
  features: Feature[];
  spellcasting?: Partial<Spellcasting>;
}

// Utility types for character management
export interface CharacterSummary {
  id: string;
  name: string;
  race: string;
  class: string;
  level: number;
  campaignId?: string;
  avatar?: string;
  lastPlayed?: Date;
}

export interface CharacterStats {
  totalCharacters: number;
  byClass: Record<string, number>;
  byRace: Record<string, number>;
  byLevel: Record<number, number>;
  averageLevel: number;
}

// Combat integration types
export interface CombatCharacter {
  id: string;
  name: string;
  hitPoints: HitPoints;
  armorClass: number;
  initiative: number;
  abilities: Record<string, Ability>;
  conditions: string[];
  isPlayer: true;
}

// Type guards
export function isCharacter(obj: any): obj is Character {
  return obj && typeof obj.id === 'string' && typeof obj.name === 'string';
}

export function isCreateCharacterRequest(obj: any): obj is CreateCharacterRequest {
  return obj && typeof obj.name === 'string' && typeof obj.race === 'string' && typeof obj.class === 'string';
}
