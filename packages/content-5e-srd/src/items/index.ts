/**
 * D&D 5e SRD Item Database
 * Comprehensive item system with weapons, armor, gear, consumables, and magic items
 */

export interface BaseItem {
  id: string;
  name: string;
  type: ItemType;
  category: ItemCategory;
  rarity: ItemRarity;
  description: string;
  weight?: number; // in pounds
  cost?: ItemCost;
  source: string; // SRD, PHB, etc.
  tags: string[];
}

export type ItemType =
  | "weapon"
  | "armor"
  | "shield"
  | "tool"
  | "gear"
  | "consumable"
  | "magic_item"
  | "treasure"
  | "mount"
  | "vehicle"
  | "ammunition";

export type ItemCategory =
  // Weapons
  | "simple_melee"
  | "martial_melee"
  | "simple_ranged"
  | "martial_ranged"
  // Armor
  | "light_armor"
  | "medium_armor"
  | "heavy_armor"
  // Tools
  | "artisan_tools"
  | "gaming_set"
  | "musical_instrument"
  | "other_tools"
  // Gear
  | "adventuring_gear"
  | "equipment_pack"
  | "container"
  | "trade_good"
  // Consumables
  | "potion"
  | "scroll"
  | "wand"
  | "ammunition"
  | "explosive"
  // Magic Items
  | "wondrous_item"
  | "ring"
  | "rod"
  | "staff"
  | "weapon_magic"
  | "armor_magic";

export type ItemRarity = "common" | "uncommon" | "rare" | "very_rare" | "legendary" | "artifact";

export interface ItemCost {
  amount: number;
  currency: "cp" | "sp" | "ep" | "gp" | "pp";
}

export interface Weapon extends BaseItem {
  type: "weapon";
  weaponType: "simple" | "martial";
  meleeRanged: "melee" | "ranged" | "versatile";
  damage: {
    dice: string;
    type: DamageType;
    versatile?: string; // for versatile weapons
  };
  properties: WeaponProperty[];
  range?: {
    normal: number;
    long?: number;
  };
  ammunition?: string; // type of ammunition required
}

export interface Armor extends BaseItem {
  type: "armor" | "shield";
  armorType: "light" | "medium" | "heavy" | "shield";
  ac: {
    base: number;
    dexModifier?: "full" | "max2" | "none";
  };
  strengthRequirement?: number;
  stealthDisadvantage?: boolean;
}

export interface Tool extends BaseItem {
  type: "tool";
  toolType: "artisan" | "gaming" | "musical" | "other";
  relatedSkill?: string;
  craftingCategory?: string[];
}

export interface Consumable extends BaseItem {
  type: "consumable";
  consumableType: "potion" | "scroll" | "ammunition" | "explosive" | "other";
  effects: ConsumableEffect[];
  charges?: number;
  stackable: boolean;
}

export interface MagicItem extends BaseItem {
  type: "magic_item";
  requiresAttunement: boolean;
  attunementRestriction?: string;
  charges?: {
    max: number;
    rechargeRate: string;
  };
  effects: MagicItemEffect[];
  baseItem?: string; // ID of base item if enhanced version
}

export type DamageType =
  | "acid"
  | "bludgeoning"
  | "cold"
  | "fire"
  | "force"
  | "lightning"
  | "necrotic"
  | "piercing"
  | "poison"
  | "psychic"
  | "radiant"
  | "slashing"
  | "thunder";

export type WeaponProperty =
  | "ammunition"
  | "finesse"
  | "heavy"
  | "light"
  | "loading"
  | "range"
  | "reach"
  | "special"
  | "thrown"
  | "two_handed"
  | "versatile";

export interface ConsumableEffect {
  type: "healing" | "damage" | "buff" | "utility" | "spell_effect";
  value?: string; // dice or fixed value
  duration?: number; // in seconds
  target: "self" | "other" | "area";
  savingThrow?: {
    ability: string;
    dc: number;
  };
}

export interface MagicItemEffect {
  type: "passive" | "active" | "triggered" | "charges";
  name: string;
  description: string;
  mechanical: string; // mechanical effect description
  trigger?: string;
  cost?: {
    type: "charge" | "attunement" | "action";
    amount?: number;
  };
}

// Material Component specific interfaces
export interface MaterialComponent {
  id: string;
  name: string;
  description: string;
  cost?: ItemCost;
  consumed: boolean;
  replaceable: boolean; // can be replaced by component pouch or spell focus
  spells: string[]; // spell IDs that use this component
  rarity: "common" | "uncommon" | "rare" | "very_rare";
}

export interface SpellFocus {
  id: string;
  name: string;
  type: "arcane" | "divine" | "druidic" | "component_pouch";
  classes: string[]; // which classes can use this focus
  cost: ItemCost;
  weight: number;
  replaces: string[]; // what components it can replace
}

// Main item database
export class ItemDatabase {
  private items: Map<string, BaseItem> = new Map();
  private itemsByType: Map<ItemType, Set<string>> = new Map();
  private itemsByCategory: Map<ItemCategory, Set<string>> = new Map();
  private materialComponents: Map<string, MaterialComponent> = new Map();
  private spellFoci: Map<string, SpellFocus> = new Map();

  constructor() {
    this.initializeDatabase();
  }

  /**
   * Get item by ID
   */
  getItem(id: string): BaseItem | undefined {
    return this.items.get(id);
  }

  /**
   * Get items by type
   */
  getItemsByType(type: ItemType): BaseItem[] {
    const itemIds = this.itemsByType.get(type) || new Set();
    return Array.from(itemIds)
      .map((id) => this.items.get(id)!)
      .filter(Boolean);
  }

  /**
   * Get items by category
   */
  getItemsByCategory(category: ItemCategory): BaseItem[] {
    const itemIds = this.itemsByCategory.get(category) || new Set();
    return Array.from(itemIds)
      .map((id) => this.items.get(id)!)
      .filter(Boolean);
  }

  /**
   * Search items by name or description
   */
  searchItems(query: string): BaseItem[] {
    const lowercaseQuery = query.toLowerCase();
    const results: BaseItem[] = [];

    for (const item of this.items.values()) {
      if (
        item.name.toLowerCase().includes(lowercaseQuery) ||
        item.description.toLowerCase().includes(lowercaseQuery) ||
        item.tags.some((tag) => tag.toLowerCase().includes(lowercaseQuery))
      ) {
        results.push(item);
      }
    }

    return results;
  }

  /**
   * Get material component by ID
   */
  getMaterialComponent(id: string): MaterialComponent | undefined {
    return this.materialComponents.get(id);
  }

  /**
   * Get spell focus by ID
   */
  getSpellFocus(id: string): SpellFocus | undefined {
    return this.spellFoci.get(id);
  }

  /**
   * Get components for a spell
   */
  getSpellComponents(spellId: string): MaterialComponent[] {
    const components: MaterialComponent[] = [];

    for (const component of this.materialComponents.values()) {
      if (component.spells.includes(spellId)) {
        components.push(component);
      }
    }

    return components;
  }

  /**
   * Add item to database
   */
  addItem(item: BaseItem): void {
    this.items.set(item.id, item);

    // Index by type
    if (!this.itemsByType.has(item.type)) {
      this.itemsByType.set(item.type, new Set());
    }
    this.itemsByType.get(item.type)!.add(item.id);

    // Index by category
    if (!this.itemsByCategory.has(item.category)) {
      this.itemsByCategory.set(item.category, new Set());
    }
    this.itemsByCategory.get(item.category)!.add(item.id);
  }

  /**
   * Add material component
   */
  addMaterialComponent(component: MaterialComponent): void {
    this.materialComponents.set(component.id, component);
  }

  /**
   * Add spell focus
   */
  addSpellFocus(focus: SpellFocus): void {
    this.spellFoci.set(focus.id, focus);
  }

  /**
   * Initialize database with SRD items
   */
  private initializeDatabase(): void {
    // This will be populated with actual SRD data
    this.loadSRDItems();
    this.loadMaterialComponents();
    this.loadSpellFoci();
  }

  private loadSRDItems(): void {
    // Placeholder - will be implemented with actual SRD data
  }

  private loadMaterialComponents(): void {
    // Placeholder - will be implemented with actual component data
  }

  private loadSpellFoci(): void {
    // Placeholder - will be implemented with actual focus data
  }

  /**
   * Get all items (for admin/debugging)
   */
  getAllItems(): BaseItem[] {
    return Array.from(this.items.values());
  }

  /**
   * Get database statistics
   */
  getStatistics(): {
    totalItems: number;
    itemsByType: Record<string, number>;
    materialComponents: number;
    spellFoci: number;
  } {
    const itemsByType: Record<string, number> = {};

    for (const [type, itemSet] of this.itemsByType.entries()) {
      itemsByType[type] = itemSet.size;
    }

    return {
      totalItems: this.items.size,
      itemsByType,
      materialComponents: this.materialComponents.size,
      spellFoci: this.spellFoci.size,
    };
  }
}

export const _itemDatabase = new ItemDatabase();
