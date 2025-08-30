/**
 * D&D 5e Spell System implementation
 */
export type SchoolOfMagic =
  | "abjuration"
  | "conjuration"
  | "divination"
  | "enchantment"
  | "evocation"
  | "illusion"
  | "necromancy"
  | "transmutation";
export type SpellComponent = "V" | "S" | "M";
export interface SpellSlot {
  level: number;
  total: number;
  used: number;
}
export interface Spell {
  id: string;
  name: string;
  level: number;
  school: SchoolOfMagic;
  castingTime: string;
  range: string;
  components: SpellComponent[];
  materialComponent?: string;
  duration: string;
  description: string;
  damage?: {
    diceExpression: string;
    damageType: string;
    scalingDice?: string;
  };
  healing?: {
    diceExpression: string;
    scalingDice?: string;
  };
  savingThrow?: {
    ability: "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA";
    dc: number;
  };
  areaOfEffect?: {
    shape: "sphere" | "cube" | "cylinder" | "cone" | "line";
    radius?: number;
    width?: number;
    height?: number;
    length?: number;
  };
  attackRoll?: boolean;
  concentration: boolean;
  ritual: boolean;
}
export interface SpellcastingAbility {
  ability: "INT" | "WIS" | "CHA";
  modifier: number;
  spellAttackBonus: number;
  spellSaveDC: number;
}
export declare class SpellSystem {
  private spells;
  private spellSlots;
  private knownSpells;
  private preparedSpells;
  private concentratingOn;
  private spellcastingAbilities;
  constructor();
  /**
   * Initialize with basic D&D 5e spells
   */
  private initializeSpells;
  /**
   * Add a spell to the system
   */
  addSpell(spell: Spell): void;
  /**
   * Get spell by ID
   */
  getSpell(spellId: string): Spell | undefined;
  /**
   * Get all spells by level
   */
  getSpellsByLevel(level: number): Spell[];
  /**
   * Get all spells by school
   */
  getSpellsBySchool(school: SchoolOfMagic): Spell[];
  /**
   * Set spellcasting ability for an entity
   */
  setSpellcastingAbility(entityId: string, ability: SpellcastingAbility): void;
  /**
   * Get spellcasting ability for an entity
   */
  getSpellcastingAbility(entityId: string): SpellcastingAbility | undefined;
  /**
   * Initialize spell slots for an entity
   */
  initializeSpellSlots(
    entityId: string,
    slotsByLevel: {
      [level: number]: number;
    },
  ): void;
  /**
   * Get spell slots for an entity
   */
  getSpellSlots(entityId: string): SpellSlot[];
  /**
   * Use a spell slot
   */
  useSpellSlot(entityId: string, level: number): boolean;
  /**
   * Restore spell slots (e.g., on long rest)
   */
  restoreSpellSlots(entityId: string, levels?: number[]): void;
  /**
   * Learn a spell
   */
  learnSpell(entityId: string, spellId: string): boolean;
  /**
   * Forget a spell
   */
  forgetSpell(entityId: string, spellId: string): boolean;
  /**
   * Get known spells for an entity
   */
  getKnownSpells(entityId: string): Spell[];
  /**
   * Prepare a spell
   */
  prepareSpell(entityId: string, spellId: string): boolean;
  /**
   * Unprepare a spell
   */
  unprepareSpell(entityId: string, spellId: string): boolean;
  /**
   * Get prepared spells for an entity
   */
  getPreparedSpells(entityId: string): Spell[];
  /**
   * Cast a spell
   */
  castSpell(
    entityId: string,
    spellId: string,
    slotLevel?: number,
  ): {
    success: boolean;
    result?: any;
    error?: string;
  };
  /**
   * Break concentration on a spell
   */
  breakConcentration(entityId: string): boolean;
  /**
   * Check if entity is concentrating on a spell
   */
  isConcentrating(entityId: string): string | null;
  /**
   * Calculate spell attack bonus
   */
  calculateSpellAttackBonus(entityId: string): number;
  /**
   * Calculate spell save DC
   */
  calculateSpellSaveDC(entityId: string): number;
  /**
   * Get available spell levels for casting
   */
  getAvailableSpellLevels(entityId: string): number[];
  /**
   * Check if spell can be cast
   */
  canCastSpell(entityId: string, spellId: string, slotLevel?: number): boolean;
}
//# sourceMappingURL=SpellSystem.d.ts.map
