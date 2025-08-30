/**
 * D&D 5e Material Component System
 * Handles spell components, spell foci, and component pouches
 */

import { MaterialComponent, SpellFocus, ItemCost } from "./index.js";
import {
  MATERIAL_COMPONENTS,
  SPELL_MATERIAL_REQUIREMENTS,
  MaterialComponentValidator,
} from "../MaterialComponentDatabase.js";

export interface ComponentPouch {
  id: string;
  name: string;
  cost: ItemCost;
  weight: number;
  canReplace: string[]; // component types it can replace
}

export interface ComponentCheck {
  required: MaterialComponent[];
  available: MaterialComponent[];
  missing: MaterialComponent[];
  canCast: boolean;
  focusCanReplace: boolean;
  pouchCanReplace: boolean;
  totalCost: number;
  affordableCost: number;
  missingCost: number;
}

export class MaterialComponentSystem {
  private components: Map<string, MaterialComponent> = new Map();
  private spellFoci: Map<string, SpellFocus> = new Map();
  private componentPouches: Map<string, ComponentPouch> = new Map();

  constructor() {
    this.initializeComponents();
    this.initializeSpellFoci();
    this.initializeComponentPouches();
  }

  /**
   * Calculate total cost of material components for a spell
   */
  calculateSpellCost(spellId: string): number {
    return MaterialComponentValidator.getComponentCost(spellId);
  }

  /**
   * Check if character can cast a spell based on available components
   */
  checkSpellComponents(
    spellId: string,
    characterComponents: string[],
    characterFoci: string[],
    characterClass: string,
    availableGold: number = 0,
  ): ComponentCheck {
    const requiredComponents = this.getSpellComponents(spellId);
    const availableComponents = characterComponents
      .map((id) => this.components.get(id))
      .filter(Boolean) as MaterialComponent[];

    const missing: MaterialComponent[] = [];
    let focusCanReplace = false;
    let pouchCanReplace = false;

    // Check each required component
    for (const required of requiredComponents) {
      const hasComponent = availableComponents.some((comp) => comp.id === required.id);

      if (!hasComponent) {
        // Check if spell focus can replace it
        const canUseFocus = this.canFocusReplaceComponent(required, characterFoci, characterClass);
        // Check if component pouch can replace it
        const canUsePouch = this.canPouchReplaceComponent(required, characterComponents);

        if (canUseFocus) {
          focusCanReplace = true;
        } else if (canUsePouch) {
          pouchCanReplace = true;
        } else {
          missing.push(required);
        }
      }
    }

    // Calculate costs
    const totalCost = this.calculateSpellCost(spellId);
    const affordableCost = Math.min(totalCost, availableGold);
    const missingCost = Math.max(0, totalCost - availableGold);

    return {
      required: requiredComponents,
      available: availableComponents,
      missing,
      canCast: missing.length === 0 && missingCost === 0,
      focusCanReplace,
      pouchCanReplace,
      totalCost,
      affordableCost,
      missingCost,
    };
  }

  /**
   * Consume components after spell casting
   */
  consumeComponents(
    spellId: string,
    characterComponents: string[],
  ): { consumed: string[]; remaining: string[] } {
    const requiredComponents = this.getSpellComponents(spellId);
    const consumed: string[] = [];
    const remaining = [...characterComponents];

    for (const required of requiredComponents) {
      if (required.consumed) {
        const index = remaining.findIndex((id) => id === required.id);
        if (index !== -1) {
          consumed.push(remaining.splice(index, 1)[0]!);
        }
      }
    }

    return { consumed, remaining };
  }

  /**
   * Get components required for a spell
   */
  getSpellComponents(spellId: string): MaterialComponent[] {
    const components: MaterialComponent[] = [];

    for (const component of this.components.values()) {
      if (component.spells.includes(spellId)) {
        components.push(component);
      }
    }

    return components;
  }

  /**
   * Check if a spell focus can replace a component
   */
  private canFocusReplaceComponent(
    component: MaterialComponent,
    characterFoci: string[],
    characterClass: string,
  ): boolean {
    if (!component.replaceable || component.consumed) {
      return false;
    }

    for (const focusId of characterFoci) {
      const focus = this.spellFoci.get(focusId);
      if (focus && focus.classes.includes(characterClass)) {
        return focus.replaces.includes(component.id) || focus.replaces.includes("material");
      }
    }

    return false;
  }

  /**
   * Check if a component pouch can replace a component
   */
  private canPouchReplaceComponent(
    component: MaterialComponent,
    characterComponents: string[],
  ): boolean {
    if (!component.replaceable || component.consumed) {
      return false;
    }

    // Check if character has component pouch
    const hasPouch = characterComponents.includes("component_pouch");
    if (!hasPouch) {
      return false;
    }

    // Component pouch can replace components under 1gp
    if (component.cost && component.cost.currency === "gp" && component.cost.amount >= 1) {
      return false;
    }

    return true;
  }

  /**
   * Get all material components
   */
  getAllComponents(): MaterialComponent[] {
    return Array.from(this.components.values());
  }

  /**
   * Get all spell foci
   */
  getAllSpellFoci(): SpellFocus[] {
    return Array.from(this.spellFoci.values());
  }

  /**
   * Get spell foci for a specific class
   */
  getSpellFociForClass(characterClass: string): SpellFocus[] {
    return Array.from(this.spellFoci.values()).filter((focus) =>
      focus.classes.includes(characterClass),
    );
  }

  /**
   * Add a new material component
   */
  addComponent(component: MaterialComponent): void {
    this.components.set(component.id, component);
  }

  /**
   * Add a new spell focus
   */
  addSpellFocus(focus: SpellFocus): void {
    this.spellFoci.set(focus.id, focus);
  }

  private initializeComponents(): void {
    // Common spell components
    const components: MaterialComponent[] = [
      {
        id: "diamond_300gp",
        name: "Diamond (300 gp)",
        description: "A clear gemstone worth at least 300 gp",
        cost: { amount: 300, currency: "gp" },
        consumed: true,
        replaceable: false,
        spells: ["revivify"],
        rarity: "rare",
      },
      {
        id: "diamond_1000gp",
        name: "Diamond (1,000 gp)",
        description: "A clear gemstone worth at least 1,000 gp",
        cost: { amount: 1000, currency: "gp" },
        consumed: true,
        replaceable: false,
        spells: ["raise_dead"],
        rarity: "very_rare",
      },
      {
        id: "ruby_1500gp",
        name: "Ruby (1,500 gp)",
        description: "A red gemstone worth at least 1,500 gp",
        cost: { amount: 1500, currency: "gp" },
        consumed: true,
        replaceable: false,
        spells: ["resurrection"],
        rarity: "very_rare",
      },
      {
        id: "diamond_25000gp",
        name: "Diamond (25,000 gp)",
        description: "A flawless diamond worth at least 25,000 gp",
        cost: { amount: 25000, currency: "gp" },
        consumed: true,
        replaceable: false,
        spells: ["true_resurrection"],
        rarity: "very_rare",
      },
      {
        id: "bat_fur",
        name: "Bat Fur",
        description: "A bit of fur from a bat",
        consumed: false,
        replaceable: true,
        spells: ["fireball"],
        rarity: "common",
      },
      {
        id: "sulfur",
        name: "Sulfur",
        description: "A pinch of sulfur",
        consumed: false,
        replaceable: true,
        spells: ["fireball"],
        rarity: "common",
      },
      {
        id: "pearl_100gp",
        name: "Pearl (100 gp)",
        description: "A pearl worth at least 100 gp",
        cost: { amount: 100, currency: "gp" },
        consumed: true,
        replaceable: false,
        spells: ["identify"],
        rarity: "uncommon",
      },
    ];

    components.forEach((component) => {
      this.components.set(component.id, component);
    });
  }

  private initializeSpellFoci(): void {
    const foci: SpellFocus[] = [
      {
        id: "arcane_focus",
        name: "Arcane Focus",
        type: "arcane",
        classes: ["wizard", "sorcerer", "warlock", "eldritch_knight", "arcane_trickster"],
        cost: { amount: 20, currency: "gp" },
        weight: 1,
        replaces: ["material"],
      },
      {
        id: "crystal",
        name: "Crystal",
        type: "arcane",
        classes: ["wizard", "sorcerer", "warlock", "eldritch_knight", "arcane_trickster"],
        cost: { amount: 10, currency: "gp" },
        weight: 1,
        replaces: ["material"],
      },
      {
        id: "orb",
        name: "Orb",
        type: "arcane",
        classes: ["wizard", "sorcerer", "warlock", "eldritch_knight", "arcane_trickster"],
        cost: { amount: 20, currency: "gp" },
        weight: 3,
        replaces: ["material"],
      },
      {
        id: "rod",
        name: "Rod",
        type: "arcane",
        classes: ["wizard", "sorcerer", "warlock", "eldritch_knight", "arcane_trickster"],
        cost: { amount: 10, currency: "gp" },
        weight: 2,
        replaces: ["material"],
      },
      {
        id: "staff",
        name: "Staff",
        type: "arcane",
        classes: ["wizard", "sorcerer", "warlock", "eldritch_knight", "arcane_trickster"],
        cost: { amount: 5, currency: "gp" },
        weight: 4,
        replaces: ["material"],
      },
      {
        id: "wand",
        name: "Wand",
        type: "arcane",
        classes: ["wizard", "sorcerer", "warlock", "eldritch_knight", "arcane_trickster"],
        cost: { amount: 10, currency: "gp" },
        weight: 1,
        replaces: ["material"],
      },
      {
        id: "holy_symbol",
        name: "Holy Symbol",
        type: "divine",
        classes: ["cleric", "paladin"],
        cost: { amount: 5, currency: "gp" },
        weight: 1,
        replaces: ["material"],
      },
      {
        id: "amulet",
        name: "Amulet",
        type: "divine",
        classes: ["cleric", "paladin"],
        cost: { amount: 5, currency: "gp" },
        weight: 1,
        replaces: ["material"],
      },
      {
        id: "emblem",
        name: "Emblem",
        type: "divine",
        classes: ["cleric", "paladin"],
        cost: { amount: 5, currency: "gp" },
        weight: 0,
        replaces: ["material"],
      },
      {
        id: "reliquary",
        name: "Reliquary",
        type: "divine",
        classes: ["cleric", "paladin"],
        cost: { amount: 5, currency: "gp" },
        weight: 2,
        replaces: ["material"],
      },
      {
        id: "druidcraft_focus",
        name: "Druidcraft Focus",
        type: "druidic",
        classes: ["druid", "ranger"],
        cost: { amount: 0, currency: "gp" },
        weight: 0,
        replaces: ["material"],
      },
    ];

    foci.forEach((focus) => {
      this.spellFoci.set(focus.id, focus);
    });
  }

  private initializeComponentPouches(): void {
    const pouches: ComponentPouch[] = [
      {
        id: "component_pouch",
        name: "Component Pouch",
        cost: { amount: 25, currency: "gp" },
        weight: 2,
        canReplace: ["material_common"], // Can replace common material components under 1gp
      },
    ];

    pouches.forEach((pouch) => {
      this.componentPouches.set(pouch.id, pouch);
    });
  }
}

export const _materialComponentSystem = new MaterialComponentSystem();
