/**
 * D&D 5e Inventory Management System
 * Handles character inventories, encumbrance, containers, and currency
 */

import { _BaseItem, _ItemCost } from "./index.js";

export interface InventoryItem {
  itemId: string;
  quantity: number;
  containerId?: string | undefined; // ID of container holding this item
  equipped?: boolean;
  attuned?: boolean; // for magic items
  charges?: number; // current charges for items with charges
  condition?: ItemCondition;
  notes?: string;
}

export type ItemCondition = "pristine" | "good" | "worn" | "damaged" | "broken";

export interface Container {
  id: string;
  name: string;
  type: "backpack" | "bag" | "pouch" | "chest" | "other";
  capacity: {
    weight: number; // max weight in pounds
    volume?: number; // max volume in cubic feet
    slots?: number; // max number of items
  };
  currentWeight: number;
  items: string[]; // IDs of items in this container
  properties: ContainerProperty[];
}

export type ContainerProperty = "waterproof" | "fireproof" | "magical" | "extradimensional";

export interface Currency {
  cp: number; // copper pieces
  sp: number; // silver pieces
  ep: number; // electrum pieces
  gp: number; // gold pieces
  pp: number; // platinum pieces
}

export interface EncumbranceInfo {
  currentWeight: number;
  lightLoad: number;
  mediumLoad: number;
  heavyLoad: number;
  maxLoad: number;
  encumbranceLevel: "unencumbered" | "lightly_encumbered" | "heavily_encumbered" | "overloaded";
  speedPenalty: number;
  hasDisadvantage: boolean;
}

export interface InventoryTransaction {
  id: string;
  timestamp: Date;
  type: "add" | "remove" | "move" | "equip" | "unequip" | "consume" | "craft" | "trade";
  itemId: string;
  quantity: number;
  fromContainer?: string | undefined;
  toContainer?: string | undefined;
  description: string;
}

export class InventorySystem {
  private items: Map<string, InventoryItem> = new Map();
  private containers: Map<string, Container> = new Map();
  private currency: Currency = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
  private transactions: InventoryTransaction[] = [];
  private characterStrength: number = 10;

  constructor(strength: number = 10) {
    this.characterStrength = strength;
    this.initializeDefaultContainers();
  }

  /**
   * Add item to inventory
   */
  addItem(
    itemId: string,
    quantity: number = 1,
    containerId?: string,
    condition: ItemCondition = "good",
  ): boolean {
    const existingItem = this.items.get(itemId);

    if (existingItem && !containerId) {
      // Stack with existing item if no specific container
      existingItem.quantity += quantity;
    } else {
      // Create new inventory entry
      const inventoryItem: InventoryItem = {
        itemId,
        quantity,
        containerId,
        condition,
        equipped: false,
      };

      const key = containerId ? `${itemId}_${containerId}` : itemId;
      this.items.set(key, inventoryItem);
    }

    // Add to container if specified
    if (containerId) {
      const container = this.containers.get(containerId);
      if (container) {
        const itemKey = containerId ? `${itemId}_${containerId}` : itemId;
        if (!container.items.includes(itemKey)) {
          container.items.push(itemKey);
        }
        this.updateContainerWeight(containerId);
      }
    }

    this.addTransaction(
      "add",
      itemId,
      quantity,
      undefined,
      containerId,
      `Added ${quantity}x ${itemId}`,
    );
    return true;
  }

  /**
   * Remove item from inventory
   */
  removeItem(itemId: string, quantity: number = 1, containerId?: string): boolean {
    const key = containerId ? `${itemId}_${containerId}` : itemId;
    const item = this.items.get(key);

    if (!item || item.quantity < quantity) {
      return false;
    }

    item.quantity -= quantity;

    if (item.quantity <= 0) {
      this.items.delete(key);

      // Remove from container
      if (containerId) {
        const container = this.containers.get(containerId);
        if (container) {
          const index = container.items.indexOf(key);
          if (index !== -1) {
            container.items.splice(index, 1);
          }
          this.updateContainerWeight(containerId);
        }
      }
    }

    this.addTransaction(
      "remove",
      itemId,
      quantity,
      containerId,
      undefined,
      `Removed ${quantity}x ${itemId}`,
    );
    return true;
  }

  /**
   * Move item between containers
   */
  moveItem(
    itemId: string,
    fromContainer?: string,
    toContainer?: string,
    quantity?: number,
  ): boolean {
    const fromKey = fromContainer ? `${itemId}_${fromContainer}` : itemId;
    const item = this.items.get(fromKey);

    if (!item) return false;

    const moveQuantity = quantity || item.quantity;
    if (item.quantity < moveQuantity) return false;

    // Remove from source
    if (!this.removeItem(itemId, moveQuantity, fromContainer)) {
      return false;
    }

    // Add to destination
    if (!this.addItem(itemId, moveQuantity, toContainer, item.condition)) {
      // Rollback if failed
      this.addItem(itemId, moveQuantity, fromContainer, item.condition);
      return false;
    }

    this.addTransaction(
      "move",
      itemId,
      moveQuantity,
      fromContainer,
      toContainer,
      `Moved ${moveQuantity}x ${itemId} from ${fromContainer || "inventory"} to ${toContainer || "inventory"}`,
    );

    return true;
  }

  /**
   * Equip/unequip item
   */
  equipItem(itemId: string, containerId?: string): boolean {
    const key = containerId ? `${itemId}_${containerId}` : itemId;
    const item = this.items.get(key);

    if (!item) return false;

    item.equipped = !item.equipped;

    this.addTransaction(
      item.equipped ? "equip" : "unequip",
      itemId,
      1,
      containerId,
      containerId,
      `${item.equipped ? "Equipped" : "Unequipped"} ${itemId}`,
    );

    return true;
  }

  /**
   * Get all items in inventory
   */
  getAllItems(): InventoryItem[] {
    return Array.from(this.items.values());
  }

  /**
   * Get items in specific container
   */
  getItemsInContainer(containerId: string): InventoryItem[] {
    const container = this.containers.get(containerId);
    if (!container) return [];

    return container.items
      .map((itemKey) => this.items.get(itemKey))
      .filter(Boolean) as InventoryItem[];
  }

  /**
   * Get equipped items
   */
  getEquippedItems(): InventoryItem[] {
    return Array.from(this.items.values()).filter((item) => item.equipped);
  }

  /**
   * Calculate encumbrance
   */
  calculateEncumbrance(itemDatabase: any): EncumbranceInfo {
    let totalWeight = 0;

    // Calculate weight of all items
    for (const item of this.items.values()) {
      const baseItem = itemDatabase.getItem(item.itemId);
      if (baseItem && baseItem.weight) {
        totalWeight += baseItem.weight * item.quantity;
      }
    }

    // Add currency weight (50 coins = 1 pound)
    const currencyWeight =
      (this.currency.cp +
        this.currency.sp +
        this.currency.ep +
        this.currency.gp +
        this.currency.pp) /
      50;
    totalWeight += currencyWeight;

    // Calculate encumbrance thresholds
    const strength = this.characterStrength;
    const lightLoad = strength * 5;
    const mediumLoad = strength * 10;
    const heavyLoad = strength * 15;
    const maxLoad = strength * 30;

    let encumbranceLevel: EncumbranceInfo["encumbranceLevel"] = "unencumbered";
    let speedPenalty = 0;
    let hasDisadvantage = false;

    if (totalWeight > maxLoad) {
      encumbranceLevel = "overloaded";
      speedPenalty = -20;
      hasDisadvantage = true;
    } else if (totalWeight > heavyLoad) {
      encumbranceLevel = "heavily_encumbered";
      speedPenalty = -20;
      hasDisadvantage = true;
    } else if (totalWeight > mediumLoad) {
      encumbranceLevel = "lightly_encumbered";
      speedPenalty = -10;
    }

    return {
      currentWeight: totalWeight,
      lightLoad,
      mediumLoad,
      heavyLoad,
      maxLoad,
      encumbranceLevel,
      speedPenalty,
      hasDisadvantage,
    };
  }

  /**
   * Manage currency
   */
  addCurrency(currency: Partial<Currency>): void {
    this.currency.cp += currency.cp || 0;
    this.currency.sp += currency.sp || 0;
    this.currency.ep += currency.ep || 0;
    this.currency.gp += currency.gp || 0;
    this.currency.pp += currency.pp || 0;
  }

  removeCurrency(currency: Partial<Currency>): boolean {
    // Convert to copper for easier calculation
    const totalCopperNeeded = this.convertToCopper(currency);
    const totalCopperAvailable = this.convertToCopper(this.currency);

    if (totalCopperAvailable < totalCopperNeeded) {
      return false;
    }

    // Remove currency (simple implementation - could be optimized)
    let remaining = totalCopperNeeded;

    // Remove from highest denomination first
    const ppToRemove = Math.min(Math.floor(remaining / 1000), this.currency.pp);
    this.currency.pp -= ppToRemove;
    remaining -= ppToRemove * 1000;

    const gpToRemove = Math.min(Math.floor(remaining / 100), this.currency.gp);
    this.currency.gp -= gpToRemove;
    remaining -= gpToRemove * 100;

    const epToRemove = Math.min(Math.floor(remaining / 50), this.currency.ep);
    this.currency.ep -= epToRemove;
    remaining -= epToRemove * 50;

    const spToRemove = Math.min(Math.floor(remaining / 10), this.currency.sp);
    this.currency.sp -= spToRemove;
    remaining -= spToRemove * 10;

    this.currency.cp -= remaining;

    return true;
  }

  getCurrency(): Currency {
    return { ...this.currency };
  }

  /**
   * Search items
   */
  searchItems(query: string, itemDatabase: any): InventoryItem[] {
    const lowercaseQuery = query.toLowerCase();
    const results: InventoryItem[] = [];

    for (const item of this.items.values()) {
      const baseItem = itemDatabase.getItem(item.itemId);
      if (
        baseItem &&
        (baseItem.name.toLowerCase().includes(lowercaseQuery) ||
          baseItem.description.toLowerCase().includes(lowercaseQuery) ||
          baseItem.tags.some((_tag: string) => tag.toLowerCase().includes(lowercaseQuery)))
      ) {
        results.push(item);
      }
    }

    return results;
  }

  /**
   * Get transaction history
   */
  getTransactionHistory(limit?: number): InventoryTransaction[] {
    const sorted = [...this.transactions].sort(
      (_a, _b) => b.timestamp.getTime() - a.timestamp.getTime(),
    );
    return limit ? sorted.slice(0, limit) : sorted;
  }

  private convertToCopper(currency: Partial<Currency>): number {
    return (
      (currency.cp || 0) +
      (currency.sp || 0) * 10 +
      (currency.ep || 0) * 50 +
      (currency.gp || 0) * 100 +
      (currency.pp || 0) * 1000
    );
  }

  private updateContainerWeight(containerId: string): void {
    const container = this.containers.get(containerId);
    if (!container) return;

    // This would need item database access to calculate actual weight
    // For now, just mark that it needs updating
    container.currentWeight = 0; // Placeholder
  }

  private addTransaction(
    type: InventoryTransaction["type"],
    itemId: string,
    quantity: number,
    fromContainer?: string,
    toContainer?: string,
    description?: string,
  ): void {
    const transaction: InventoryTransaction = {
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      type,
      itemId,
      quantity,
      fromContainer,
      toContainer,
      description: description || `${type} ${quantity}x ${itemId}`,
    };

    this.transactions.push(transaction);

    // Keep only last 1000 transactions
    if (this.transactions.length > 1000) {
      this.transactions = this.transactions.slice(-1000);
    }
  }

  private initializeDefaultContainers(): void {
    // Default backpack
    const backpack: Container = {
      id: "backpack",
      name: "Backpack",
      type: "backpack",
      capacity: { weight: 30, volume: 1 },
      currentWeight: 0,
      items: [],
      properties: [],
    };

    this.containers.set("backpack", backpack);
  }

  /**
   * Add container to inventory
   */
  addContainer(container: Container): void {
    this.containers.set(container.id, container);
  }

  /**
   * Get all containers
   */
  getContainers(): Container[] {
    return Array.from(this.containers.values());
  }

  /**
   * Get container by ID
   */
  getContainer(id: string): Container | undefined {
    return this.containers.get(id);
  }
}
