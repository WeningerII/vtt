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
  level: number; // 0 = cantrip, 1-9 = spell levels
  school: SchoolOfMagic;
  castingTime: string; // e.g., "1 action", "1 bonus action", "1 minute"
  range: string; // e.g., "30 feet", "Self", "Touch"
  components: SpellComponent[];
  materialComponent?: string;
  duration: string; // e.g., "Instantaneous", "Concentration, up to 1 minute"
  description: string;
  damage?: {
    diceExpression: string;
    damageType: string;
    scalingDice?: string; // Additional dice per slot level above base
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

export class SpellSystem {
  private spells: Map<string, Spell> = new Map();
  private spellSlots: Map<string, SpellSlot[]> = new Map(); // entityId -> spell slots
  private knownSpells: Map<string, Set<string>> = new Map(); // entityId -> spell ids
  private preparedSpells: Map<string, Set<string>> = new Map(); // entityId -> spell ids
  private concentratingOn: Map<string, string> = new Map(); // entityId -> spell id
  private spellcastingAbilities: Map<string, SpellcastingAbility> = new Map();

  constructor() {
    this.initializeSpells();
  }

  /**
   * Initialize with basic D&D 5e spells
   */
  private initializeSpells(): void {
    // Cantrips (Level 0)
    this.addSpell({
      id: "firebolt",
      name: "Fire Bolt",
      level: 0,
      school: "evocation",
      castingTime: "1 action",
      range: "120 feet",
      components: ["V", "S"],
      duration: "Instantaneous",
      description: "You hurl a mote of fire at a creature or object within range.",
      damage: {
        diceExpression: "1d10",
        damageType: "fire",
        scalingDice: "1d10", // Scales with character level, not spell slot
      },
      attackRoll: true,
      concentration: false,
      ritual: false,
    });

    this.addSpell({
      id: "mending",
      name: "Mending",
      level: 0,
      school: "transmutation",
      castingTime: "1 minute",
      range: "Touch",
      components: ["V", "S", "M"],
      materialComponent: "two lodestones",
      duration: "Instantaneous",
      description: "This spell repairs a single break or tear in an object you touch.",
      concentration: false,
      ritual: false,
    });

    // 1st Level Spells
    this.addSpell({
      id: "magicmissile",
      name: "Magic Missile",
      level: 1,
      school: "evocation",
      castingTime: "1 action",
      range: "120 feet",
      components: ["V", "S"],
      duration: "Instantaneous",
      description: "You create three glowing darts of magical force.",
      damage: {
        diceExpression: "3d4+3",
        damageType: "force",
        scalingDice: "1d4+1",
      },
      concentration: false,
      ritual: false,
    });

    this.addSpell({
      id: "shield",
      name: "Shield",
      level: 1,
      school: "abjuration",
      castingTime: "1 reaction",
      range: "Self",
      components: ["V", "S"],
      duration: "1 round",
      description: "+5 bonus to AC, including against the triggering attack.",
      concentration: false,
      ritual: false,
    });

    this.addSpell({
      id: "curelight",
      name: "Cure Light Wounds",
      level: 1,
      school: "evocation",
      castingTime: "1 action",
      range: "Touch",
      components: ["V", "S"],
      duration: "Instantaneous",
      description: "A creature you touch regains hit points.",
      healing: {
        diceExpression: "1d8",
        scalingDice: "1d8",
      },
      concentration: false,
      ritual: false,
    });

    // 2nd Level Spells
    this.addSpell({
      id: "fireball",
      name: "Fireball",
      level: 3,
      school: "evocation",
      castingTime: "1 action",
      range: "150 feet",
      components: ["V", "S", "M"],
      materialComponent: "a tiny ball of bat guano and sulfur",
      duration: "Instantaneous",
      description: "A bright flash of light streaks toward a point you choose within range.",
      damage: {
        diceExpression: "8d6",
        damageType: "fire",
        scalingDice: "1d6",
      },
      savingThrow: {
        ability: "DEX",
        dc: 15,
      },
      concentration: false,
      ritual: false,
    });
  }

  /**
   * Add a spell to the system
   */
  addSpell(spell: Spell): void {
    this.spells.set(spell.id, spell);
  }

  /**
   * Get spell by ID
   */
  getSpell(spellId: string): Spell | undefined {
    return this.spells.get(spellId);
  }

  /**
   * Get all spells by level
   */
  getSpellsByLevel(level: number): Spell[] {
    return Array.from(this.spells.values()).filter((spell) => spell.level === level);
  }

  /**
   * Get all spells by school
   */
  getSpellsBySchool(school: SchoolOfMagic): Spell[] {
    return Array.from(this.spells.values()).filter((spell) => spell.school === school);
  }

  /**
   * Set spellcasting ability for an entity
   */
  setSpellcastingAbility(entityId: string, ability: SpellcastingAbility): void {
    this.spellcastingAbilities.set(entityId, ability);
  }

  /**
   * Get spellcasting ability for an entity
   */
  getSpellcastingAbility(entityId: string): SpellcastingAbility | undefined {
    return this.spellcastingAbilities.get(entityId);
  }

  /**
   * Initialize spell slots for an entity
   */
  initializeSpellSlots(entityId: string, slotsByLevel: { [level: number]: number }): void {
    const slots: SpellSlot[] = [];
    for (let level = 1; level <= 9; level++) {
      const slotCount = slotsByLevel[level];
      if (slotCount !== undefined) {
        slots.push({
          level,
          total: slotCount,
          used: 0,
        });
      }
    }
    this.spellSlots.set(entityId, slots);
  }

  /**
   * Get spell slots for an entity
   */
  getSpellSlots(entityId: string): SpellSlot[] {
    return this.spellSlots.get(entityId) || [];
  }

  /**
   * Use a spell slot
   */
  useSpellSlot(entityId: string, level: number): boolean {
    const slots = this.spellSlots.get(entityId);
    if (!slots) {return false;}

    const slot = slots.find((s) => s.level === level);
    if (!slot || slot.used >= slot.total) {return false;}

    slot.used++;
    return true;
  }

  /**
   * Restore spell slots (e.g., on long rest)
   */
  restoreSpellSlots(entityId: string, levels?: number[]): void {
    const slots = this.spellSlots.get(entityId);
    if (!slots) {return;}

    for (const slot of slots) {
      if (!levels || levels.includes(slot.level)) {
        slot.used = 0;
      }
    }
  }

  /**
   * Learn a spell
   */
  learnSpell(entityId: string, spellId: string): boolean {
    const spell = this.spells.get(spellId);
    if (!spell) {return false;}

    let knownSpells = this.knownSpells.get(entityId);
    if (!knownSpells) {
      knownSpells = new Set();
      this.knownSpells.set(entityId, knownSpells);
    }

    knownSpells.add(spellId);
    return true;
  }

  /**
   * Forget a spell
   */
  forgetSpell(entityId: string, spellId: string): boolean {
    const knownSpells = this.knownSpells.get(entityId);
    if (!knownSpells) {return false;}

    return knownSpells.delete(spellId);
  }

  /**
   * Get known spells for an entity
   */
  getKnownSpells(entityId: string): Spell[] {
    const knownSpellIds = this.knownSpells.get(entityId);
    if (!knownSpellIds) {return [];}

    return Array.from(knownSpellIds)
      .map((id) => this.spells.get(id))
      .filter((spell): spell is Spell => spell !== undefined);
  }

  /**
   * Prepare a spell
   */
  prepareSpell(entityId: string, spellId: string): boolean {
    const knownSpells = this.knownSpells.get(entityId);
    if (!knownSpells || !knownSpells.has(spellId)) {return false;}

    let preparedSpells = this.preparedSpells.get(entityId);
    if (!preparedSpells) {
      preparedSpells = new Set();
      this.preparedSpells.set(entityId, preparedSpells);
    }

    preparedSpells.add(spellId);
    return true;
  }

  /**
   * Unprepare a spell
   */
  unprepareSpell(entityId: string, spellId: string): boolean {
    const preparedSpells = this.preparedSpells.get(entityId);
    if (!preparedSpells) {return false;}

    return preparedSpells.delete(spellId);
  }

  /**
   * Get prepared spells for an entity
   */
  getPreparedSpells(entityId: string): Spell[] {
    const preparedSpellIds = this.preparedSpells.get(entityId);
    if (!preparedSpellIds) {return [];}

    return Array.from(preparedSpellIds)
      .map((id) => this.spells.get(id))
      .filter((spell): spell is Spell => spell !== undefined);
  }

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
  } {
    const spell = this.spells.get(spellId);
    if (!spell) {
      return { success: false, error: "Spell not found" };
    }

    // Check if spell is prepared (or is a cantrip)
    if (spell.level > 0) {
      const preparedSpells = this.preparedSpells.get(entityId);
      if (!preparedSpells || !preparedSpells.has(spellId)) {
        return { success: false, error: "Spell not prepared" };
      }
    }

    // Check concentration
    if (spell.concentration && this.concentratingOn.has(entityId)) {
      // Break previous concentration
      this.breakConcentration(entityId);
    }

    // Use spell slot (if not cantrip)
    if (spell.level > 0) {
      const useLevel = slotLevel || spell.level;
      if (!this.useSpellSlot(entityId, useLevel)) {
        return { success: false, error: "No spell slots available" };
      }
    }

    // Set concentration
    if (spell.concentration) {
      this.concentratingOn.set(entityId, spellId);
    }

    return {
      success: true,
      result: {
        spell,
        slotLevel: slotLevel || spell.level,
        timestamp: Date.now(),
      },
    };
  }

  /**
   * Break concentration on a spell
   */
  breakConcentration(entityId: string): boolean {
    return this.concentratingOn.delete(entityId);
  }

  /**
   * Check if entity is concentrating on a spell
   */
  isConcentrating(entityId: string): string | null {
    return this.concentratingOn.get(entityId) || null;
  }

  /**
   * Calculate spell attack bonus
   */
  calculateSpellAttackBonus(entityId: string): number {
    const ability = this.spellcastingAbilities.get(entityId);
    return ability?.spellAttackBonus || 0;
  }

  /**
   * Calculate spell save DC
   */
  calculateSpellSaveDC(entityId: string): number {
    const ability = this.spellcastingAbilities.get(entityId);
    return ability?.spellSaveDC || 8;
  }

  /**
   * Get available spell levels for casting
   */
  getAvailableSpellLevels(entityId: string): number[] {
    const slots = this.spellSlots.get(entityId);
    if (!slots) {return [];}

    return slots.filter((slot) => slot.used < slot.total).map((slot) => slot.level);
  }

  /**
   * Check if spell can be cast
   */
  canCastSpell(entityId: string, spellId: string, slotLevel?: number): boolean {
    const spell = this.spells.get(spellId);
    if (!spell) {return false;}

    // Cantrips can always be cast
    if (spell.level === 0) {return true;}

    // Check if spell is prepared
    const preparedSpells = this.preparedSpells.get(entityId);
    if (!preparedSpells || !preparedSpells.has(spellId)) {return false;}

    // Check spell slot availability
    const useLevel = slotLevel || spell.level;
    const slots = this.spellSlots.get(entityId);
    if (!slots) {return false;}

    const slot = slots.find((s) => s.level === useLevel);
    return slot ? slot.used < slot.total : false;
  }
}
