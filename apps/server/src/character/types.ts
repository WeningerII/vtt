/**
 * Character system types and interfaces
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
  value: number;
  modifier: number;
}

export interface Equipment {
  id: string;
  name: string;
  type: "weapon" | "armor" | "tool" | "consumable" | "misc";
  description?: string;
  quantity: number;
  weight?: number;
  value?: number;
  equipped?: boolean;
  properties?: Record<string, any>;
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
  prepared?: boolean;
}

export interface ClassFeature {
  id: string;
  name: string;
  level: number;
  description: string;
  uses?: {
    max: number;
    current: number;
    resetOn: "short" | "long" | "none";
  };
}

export interface Character {
  id: string;
  userId: string;
  campaignId?: string | undefined;

  // Basic Info
  name: string;
  race: string;
  class: string;
  level: number;
  background: string;
  alignment: string;

  // Core Stats
  experience: number;
  hitPoints: {
    current: number;
    max: number;
    temporary: number;
  };
  armorClass: number;
  proficiencyBonus: number;
  speed: number;

  // Abilities (STR, DEX, CON, INT, WIS, CHA)
  abilities: Record<string, Ability>;

  // Skills
  skills: Record<string, Skill>;

  // Saves
  savingThrows: Record<
    string,
    {
      proficient: boolean;
      value: number;
    }
  >;

  // Combat
  initiative: number;
  hitDice: {
    total: number;
    current: number;
    type: string; // d6, d8, d10, d12
  };

  // Equipment
  equipment: Equipment[];
  currency: {
    cp: number; // copper
    sp: number; // silver
    ep: number; // electrum
    gp: number; // gold
    pp: number; // platinum
  };

  // Spells (if applicable)
  spellcasting?: {
    ability: string;
    spellAttackBonus: number;
    spellSaveDC: number;
    spellSlots: Record<string, { max: number; current: number }>;
    spells: Spell[];
    cantripsKnown: number;
    spellsKnown: number;
  };

  // Features & Traits
  features: ClassFeature[];
  traits: string[];

  // Roleplay
  personality: {
    traits: string[];
    ideals: string[];
    bonds: string[];
    flaws: string[];
  };

  // Notes
  notes: string;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface CharacterTemplate {
  id: string;
  name: string;
  description: string;
  race: string;
  class: string;
  level: number;
  abilities: Record<string, number>;
  equipment: Omit<Equipment, "id">[];
  spells?: Omit<Spell, "id">[];
  features: Omit<ClassFeature, "id">[];
}

export interface Campaign {
  id: string;
  name: string;
  description: string;
  gameSystem: string; // 'dnd5e', 'pathfinder', 'custom'
  gameMasterId: string;
  players: string[]; // user IDs
  characters: string[]; // character IDs
  sessions: number; // number of sessions played
  totalHours: number; // total hours played
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Character creation request
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

// Character update request
export interface UpdateCharacterRequest {
  name?: string;
  level?: number;
  experience?: number;
  hitPoints?: Partial<Character["hitPoints"]>;
  abilities?: Record<string, Partial<Ability>>;
  equipment?: Equipment[];
  notes?: string;
  personality?: Partial<Character["personality"]>;
}
