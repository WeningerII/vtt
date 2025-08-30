/**
 * D&D 5e Consumable Items System
 * Handles potions, scrolls, ammunition, and other consumable items
 */

import { Consumable, _ConsumableEffect } from "./index.js";

export interface PotionEffect {
  type: "healing" | "buff" | "utility";
  dice?: string;
  fixedValue?: number;
  duration?: number; // in seconds
  description: string;
}

export interface ScrollData {
  spellId: string;
  spellLevel: number;
  castingTime: string;
  spellAttackBonus?: number;
  spellSaveDC?: number;
  casterLevel: number;
}

export interface AmmunitionData {
  weaponTypes: string[]; // weapon IDs this ammo works with
  recoveryRate: number; // percentage chance to recover after combat (0-1)
  specialProperties?: string[];
}

export interface ConsumableUseResult {
  success: boolean;
  effects: string[];
  diceRolls?: { dice: string; result: number }[];
  remainingCharges?: number;
  consumed: boolean;
  error?: string;
}

export class ConsumableSystem {
  private potions: Map<string, Consumable & { potionData: PotionEffect }> = new Map();
  private scrolls: Map<string, Consumable & { scrollData: ScrollData }> = new Map();
  private ammunition: Map<string, Consumable & { ammoData: AmmunitionData }> = new Map();
  private usageHistory: ConsumableUsage[] = [];

  constructor() {
    this.initializePotions();
    this.initializeScrolls();
    this.initializeAmmunition();
  }

  /**
   * Use a consumable item
   */
  useConsumable(
    itemId: string,
    userId: string,
    targetId?: string,
    quantity: number = 1,
  ): ConsumableUseResult {
    // Check potions first
    const potion = this.potions.get(itemId);
    if (potion) {
      return this.usePotion(potion, userId, targetId, quantity);
    }

    // Check scrolls
    const scroll = this.scrolls.get(itemId);
    if (scroll) {
      return this.useScroll(scroll, userId, targetId);
    }

    // Check ammunition
    const ammo = this.ammunition.get(itemId);
    if (ammo) {
      return this.useAmmunition(ammo, userId, quantity);
    }

    return {
      success: false,
      effects: [],
      consumed: false,
      error: `Unknown consumable: ${itemId}`,
    };
  }

  /**
   * Use a potion
   */
  private usePotion(
    potion: Consumable & { potionData: PotionEffect },
    userId: string,
    targetId?: string,
    quantity: number = 1,
  ): ConsumableUseResult {
    const effects: string[] = [];
    const diceRolls: { dice: string; result: number }[] = [];

    for (let i = 0; i < quantity; i++) {
      const effect = potion.potionData;

      if (effect.type === "healing" && effect.dice) {
        const roll = this.rollDice(effect.dice);
        diceRolls.push({ dice: effect.dice, result: roll });
        effects.push(`Healed ${roll} hit points`);
      } else if (effect.fixedValue) {
        effects.push(`${effect.description}: ${effect.fixedValue}`);
      } else {
        effects.push(effect.description);
      }
    }

    this.recordUsage(potion.id, userId, "potion", quantity, effects);
    this.recordUsage(potion.id, userId, "scroll", 1, effects);

    return {
      success: true,
      effects,
      diceRolls,
      consumed: true,
    };
  }

  /**
   * Use a scroll
   */
  private useScroll(
    scroll: Consumable & { scrollData: ScrollData },
    userId: string,
    targetId?: string,
  ): ConsumableUseResult {
    const scrollData = scroll.scrollData;

    // This would integrate with the spell system
    const effects = [
      `Cast ${scrollData.spellId} at level ${scrollData.spellLevel}`,
      `Casting time: ${scrollData.castingTime}`,
      `Caster level: ${scrollData.casterLevel}`,
    ];

    if (scrollData.spellAttackBonus) {
      effects.push(`Spell attack bonus: +${scrollData.spellAttackBonus}`);
    }

    if (scrollData.spellSaveDC) {
      effects.push(`Spell save DC: ${scrollData.spellSaveDC}`);
    }

    this.recordUsage(scroll.id, userId, "scroll", 1, effects);

    return {
      success: true,
      effects,
      consumed: true,
    };
  }

  /**
   * Use ammunition
   */
  private useAmmunition(
    ammo: Consumable & { ammoData: AmmunitionData },
    userId: string,
    quantity: number,
  ): ConsumableUseResult {
    const effects = [`Used ${quantity}x ${ammo.name}`];

    if (ammo.ammoData.specialProperties) {
      effects.push(`Special: ${ammo.ammoData.specialProperties.join(", ")}`);
    }

    this.recordUsage(ammo.id, userId, "ammunition", quantity, effects);

    return {
      success: true,
      effects,
      consumed: true,
    };
  }

  /**
   * Recover ammunition after combat
   */
  recoverAmmunition(ammoId: string, quantityUsed: number): { recovered: number; lost: number } {
    const ammo = this.ammunition.get(ammoId);
    if (!ammo) {
      return { recovered: 0, lost: quantityUsed };
    }

    let recovered = 0;
    const recoveryRate = ammo.ammoData.recoveryRate;

    for (let i = 0; i < quantityUsed; i++) {
      if (Math.random() <= recoveryRate) {
        recovered++;
      }
    }

    const lost = quantityUsed - recovered;

    return { recovered, lost };
  }

  /**
   * Get compatible ammunition for a weapon
   */
  getCompatibleAmmunition(weaponId: string): (Consumable & { ammoData: AmmunitionData })[] {
    const compatible: (Consumable & { ammoData: AmmunitionData })[] = [];

    for (const ammo of this.ammunition.values()) {
      if (ammo.ammoData.weaponTypes.includes(weaponId)) {
        compatible.push(ammo);
      }
    }

    return compatible;
  }

  /**
   * Get all potions
   */
  getAllPotions(): (Consumable & { potionData: PotionEffect })[] {
    return Array.from(this.potions.values());
  }

  /**
   * Get all scrolls
   */
  getAllScrolls(): (Consumable & { scrollData: ScrollData })[] {
    return Array.from(this.scrolls.values());
  }

  /**
   * Get all ammunition
   */
  getAllAmmunition(): (Consumable & { ammoData: AmmunitionData })[] {
    return Array.from(this.ammunition.values());
  }

  /**
   * Get usage history
   */
  getUsageHistory(userId?: string, limit?: number): ConsumableUsage[] {
    let history = userId
      ? this.usageHistory.filter((usage) => usage.userId === userId)
      : this.usageHistory;

    history = history.sort((_a, _b) => b.timestamp.getTime() - a.timestamp.getTime());

    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Add custom consumable
   */
  addPotion(potion: Consumable & { potionData: PotionEffect }): void {
    this.potions.set(potion.id, potion);
  }

  addScroll(scroll: Consumable & { scrollData: ScrollData }): void {
    this.scrolls.set(scroll.id, scroll);
  }

  addAmmunition(ammo: Consumable & { ammoData: AmmunitionData }): void {
    this.ammunition.set(ammo.id, ammo);
  }

  private rollDice(diceString: string): number {
    // Simple dice roller - supports formats like "2d4+2", "1d8", etc.
    const match = diceString.match(/(\d+)d(\d+)(?:\+(\d+))?/);
    if (!match) return 0;

    const numDice = parseInt(match[1]!, 10);
    const dieSize = parseInt(match[2]!, 10);
    const bonus = parseInt(match[3] || "0", 10);

    let total = bonus;
    for (let i = 0; i < numDice; i++) {
      total += Math.floor(Math.random() * dieSize) + 1;
    }

    return total;
  }

  private recordUsage(
    itemId: string,
    userId: string,
    type: "potion" | "scroll" | "ammunition",
    quantity: number,
    effects: string[],
  ): void {
    const usage: ConsumableUsage = {
      id: `usage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      itemId,
      userId,
      type,
      quantity,
      effects,
      timestamp: new Date(),
    };

    this.usageHistory.push(usage);

    // Keep only last 1000 usage records
    if (this.usageHistory.length > 1000) {
      this.usageHistory = this.usageHistory.slice(-1000);
    }
  }

  private initializePotions(): void {
    const potions = [
      {
        id: "potion_of_healing",
        name: "Potion of Healing",
        type: "consumable" as const,
        category: "potion" as const,
        rarity: "common" as const,
        description: "A magical red liquid that restores health when consumed.",
        weight: 0.5,
        cost: { amount: 50, currency: "gp" as const },
        source: "SRD",
        tags: ["healing", "magic", "consumable"],
        consumableType: "potion" as const,
        effects: [
          {
            type: "healing" as const,
            value: "2d4+2",
            target: "self" as const,
          },
        ],
        stackable: true,
        potionData: {
          type: "healing" as const,
          dice: "2d4+2",
          description: "Restores hit points",
        },
      },
      {
        id: "potion_of_greater_healing",
        name: "Potion of Greater Healing",
        type: "consumable" as const,
        category: "potion" as const,
        rarity: "uncommon" as const,
        description: "A magical red liquid that restores significant health.",
        weight: 0.5,
        cost: { amount: 150, currency: "gp" as const },
        source: "SRD",
        tags: ["healing", "magic", "consumable"],
        consumableType: "potion" as const,
        effects: [
          {
            type: "healing" as const,
            value: "4d4+4",
            target: "self" as const,
          },
        ],
        stackable: true,
        potionData: {
          type: "healing" as const,
          dice: "4d4+4",
          description: "Restores hit points",
        },
      },
    ];

    potions.forEach((potion) => {
      this.potions.set(potion.id, potion);
    });
  }

  private initializeScrolls(): void {
    const scrolls = [
      {
        id: "scroll_of_cure_wounds",
        name: "Scroll of Cure Wounds",
        type: "consumable" as const,
        category: "scroll" as const,
        rarity: "common" as const,
        description: "A scroll containing the Cure Wounds spell.",
        weight: 0,
        cost: { amount: 25, currency: "gp" as const },
        source: "SRD",
        tags: ["scroll", "magic", "healing"],
        consumableType: "scroll" as const,
        effects: [
          {
            type: "spell_effect" as const,
            target: "other" as const,
          },
        ],
        stackable: true,
        scrollData: {
          spellId: "cure_wounds",
          spellLevel: 1,
          castingTime: "1 action",
          spellSaveDC: 13,
          casterLevel: 1,
        },
      },
      {
        id: "scroll_of_fireball",
        name: "Scroll of Fireball",
        type: "consumable" as const,
        category: "scroll" as const,
        rarity: "uncommon" as const,
        description: "A scroll containing the Fireball spell.",
        weight: 0,
        cost: { amount: 150, currency: "gp" as const },
        source: "SRD",
        tags: ["scroll", "magic", "damage"],
        consumableType: "scroll" as const,
        effects: [
          {
            type: "spell_effect" as const,
            target: "area" as const,
            savingThrow: {
              ability: "Dexterity",
              dc: 15,
            },
          },
        ],
        stackable: true,
        scrollData: {
          spellId: "fireball",
          spellLevel: 3,
          castingTime: "1 action",
          spellSaveDC: 15,
          casterLevel: 5,
        },
      },
    ];

    scrolls.forEach((scroll) => {
      this.scrolls.set(scroll.id, scroll);
    });
  }

  private initializeAmmunition(): void {
    const ammunition = [
      {
        id: "arrows",
        name: "Arrows",
        type: "consumable" as const,
        category: "ammunition" as const,
        rarity: "common" as const,
        description: "A bundle of arrows for use with bows.",
        weight: 1,
        cost: { amount: 1, currency: "gp" as const },
        source: "SRD",
        tags: ["ammunition", "ranged"],
        consumableType: "ammunition" as const,
        effects: [],
        stackable: true,
        ammoData: {
          weaponTypes: ["shortbow", "longbow"],
          recoveryRate: 0.5,
          specialProperties: [],
        },
      },
      {
        id: "crossbow_bolts",
        name: "Crossbow Bolts",
        type: "consumable" as const,
        category: "ammunition" as const,
        rarity: "common" as const,
        description: "Bolts for use with crossbows.",
        weight: 1.5,
        cost: { amount: 1, currency: "gp" as const },
        source: "SRD",
        tags: ["ammunition", "ranged"],
        consumableType: "ammunition" as const,
        effects: [],
        stackable: true,
        ammoData: {
          weaponTypes: ["crossbow_light", "crossbow_heavy", "crossbow_hand"],
          recoveryRate: 0.5,
          specialProperties: [],
        },
      },
      {
        id: "sling_bullets",
        name: "Sling Bullets",
        type: "consumable" as const,
        category: "ammunition" as const,
        rarity: "common" as const,
        description: "Lead bullets for use with slings.",
        weight: 1.5,
        cost: { amount: 4, currency: "cp" as const },
        source: "SRD",
        tags: ["ammunition", "ranged"],
        consumableType: "ammunition" as const,
        effects: [],
        stackable: true,
        ammoData: {
          weaponTypes: ["sling"],
          recoveryRate: 0.25, // harder to recover bullets
          specialProperties: [],
        },
      },
    ];

    ammunition.forEach((ammo) => {
      this.ammunition.set(ammo.id, ammo);
    });
  }
}

export interface ConsumableUsage {
  id: string;
  itemId: string;
  userId: string;
  type: "potion" | "scroll" | "ammunition";
  quantity: number;
  effects: string[];
  timestamp: Date;
}

export const _consumableSystem = new ConsumableSystem();
