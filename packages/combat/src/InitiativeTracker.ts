/**
 * Initiative Tracker
 * Visual and functional component for managing combat initiative order
 */

import { Combatant, CombatState } from "./CombatManager";
import { logger } from "@vtt/logging";

export interface InitiativeEntry {
  id: string;
  combatantId: string;
  name: string;
  initiative: number;
  isActive: boolean;
  isVisible: boolean;
  isPlayer: boolean;
  avatar?: string;
  conditions: string[];
  hitPoints: {
    current: number;
    max: number;
    temp: number;
  };
  actions: {
    action: boolean;
    bonusAction: boolean;
    reaction: boolean;
    movement: number;
    maxMovement: number;
  };
}

export interface InitiativeTrackerSettings {
  showHealthBars: boolean;
  showConditions: boolean;
  showActions: boolean;
  showMovement: boolean;
  allowReordering: boolean;
  showHiddenCombatants: boolean;
  colorCoding: boolean;
}

export class InitiativeTracker {
  private entries: InitiativeEntry[] = [];
  private currentTurn = 0;
  private settings: InitiativeTrackerSettings;
  private changeListeners: Array<(_event: InitiativeTrackerEvent) => void> = [];

  constructor(settings: Partial<InitiativeTrackerSettings> = {}) {
    this.settings = {
      showHealthBars: true,
      showConditions: true,
      showActions: true,
      showMovement: true,
      allowReordering: true,
      showHiddenCombatants: false,
      colorCoding: true,
      ...settings,
    };
  }

  /**
   * Update tracker from combat state
   */
  updateFromCombatState(combatState: CombatState): void {
    this.entries = combatState.combatants.map((combatant, _index) => ({
      id: `entry-${combatant.id}`,
      combatantId: combatant.id,
      name: combatant.name,
      initiative: combatant.initiative,
      isActive: combatant.isActive,
      isVisible: combatant.isVisible,
      isPlayer: combatant.type === "pc",
      conditions: [...combatant.conditions],
      hitPoints: {
        current: combatant.currentHitPoints,
        max: combatant.maxHitPoints,
        temp: combatant.temporaryHitPoints,
      },
      actions: { ...combatant.actions },
    }));

    this.currentTurn = combatState.currentTurn;

    this.emitChange({
      type: "tracker-updated",
      data: { entries: this.getVisibleEntries() },
    });
  }

  /**
   * Get entries visible to current user
   */
  getVisibleEntries(): InitiativeEntry[] {
    return this.entries.filter((entry) => entry.isVisible || this.settings.showHiddenCombatants);
  }

  /**
   * Get current active entry
   */
  getCurrentEntry(): InitiativeEntry | null {
    return this.entries.find((entry) => entry.isActive) || null;
  }

  /**
   * Reorder initiative entries
   */
  reorderEntry(entryId: string, newPosition: number): boolean {
    if (!this.settings.allowReordering) {return false;}

    const entryIndex = this.entries.findIndex((e) => e.id === entryId);
    if (entryIndex === -1 || newPosition < 0 || newPosition >= this.entries.length) {
      return false;
    }

    const [entry] = this.entries.splice(entryIndex, 1);
    if (entry) {
      this.entries.splice(newPosition, 0, entry);
    }

    this.emitChange({
      type: "order-changed",
      data: { entryId, oldPosition: entryIndex, newPosition },
    });

    return true;
  }

  /**
   * Toggle entry visibility
   */
  toggleVisibility(entryId: string): boolean {
    const entry = this.entries.find((e) => e.id === entryId);
    if (!entry) {return false;}

    entry.isVisible = !entry.isVisible;

    this.emitChange({
      type: "visibility-changed",
      data: { entryId, visible: entry.isVisible },
    });

    return true;
  }

  /**
   * Update entry health display
   */
  updateHealth(entryId: string, current: number, max: number, temp: number = 0): void {
    const entry = this.entries.find((e) => e.id === entryId);
    if (!entry) {return;}

    entry.hitPoints = { current, max, temp };

    this.emitChange({
      type: "health-updated",
      data: { entryId, hitPoints: entry.hitPoints },
    });
  }

  /**
   * Update entry conditions
   */
  updateConditions(entryId: string, conditions: string[]): void {
    const entry = this.entries.find((e) => e.id === entryId);
    if (!entry) {return;}

    entry.conditions = [...conditions];

    this.emitChange({
      type: "conditions-updated",
      data: { entryId, conditions: entry.conditions },
    });
  }

  /**
   * Update entry actions
   */
  updateActions(entryId: string, actions: InitiativeEntry["actions"]): void {
    const entry = this.entries.find((e) => e.id === entryId);
    if (!entry) {return;}

    entry.actions = { ...actions };

    this.emitChange({
      type: "actions-updated",
      data: { entryId, actions: entry.actions },
    });
  }

  /**
   * Get entry health percentage
   */
  getHealthPercentage(entryId: string): number {
    const entry = this.entries.find((e) => e.id === entryId);
    if (!entry || entry.hitPoints.max === 0) {return 0;}

    return Math.max(0, (entry.hitPoints.current / entry.hitPoints.max) * 100);
  }

  /**
   * Get entry health status
   */
  getHealthStatus(
    entryId: string,
  ): "healthy" | "injured" | "bloodied" | "critical" | "unconscious" | "dead" {
    const percentage = this.getHealthPercentage(entryId);
    const entry = this.entries.find((e) => e.id === entryId);

    if (!entry) {return "dead";}
    if (entry.hitPoints.current <= 0) {return entry.hitPoints.current < 0 ? "dead" : "unconscious";}
    if (percentage <= 10) {return "critical";}
    if (percentage <= 50) {return "bloodied";}
    if (percentage < 100) {return "injured";}
    return "healthy";
  }

  /**
   * Get condition severity
   */
  getConditionSeverity(entryId: string): "none" | "minor" | "major" | "severe" {
    const entry = this.entries.find((e) => e.id === entryId);
    if (!entry || entry.conditions.length === 0) {return "none";}

    const severeConditions = ["unconscious", "paralyzed", "petrified", "stunned"];
    const majorConditions = ["blinded", "charmed", "frightened", "incapacitated", "restrained"];

    if (entry.conditions.some((c) => severeConditions.includes(c.toLowerCase()))) {return "severe";}
    if (entry.conditions.some((c) => majorConditions.includes(c.toLowerCase()))) {return "major";}
    return "minor";
  }

  /**
   * Calculate initiative statistics
   */
  getInitiativeStats(): {
    highest: number;
    lowest: number;
    average: number;
    playerAverage: number;
    npcAverage: number;
  } {
    if (this.entries.length === 0) {
      return { highest: 0, lowest: 0, average: 0, playerAverage: 0, npcAverage: 0 };
    }

    const initiatives = this.entries.map((e) => e.initiative);
    const playerInitiatives = this.entries.filter((e) => e.isPlayer).map((e) => e.initiative);
    const npcInitiatives = this.entries.filter((e) => !e.isPlayer).map((e) => e.initiative);

    return {
      highest: Math.max(...initiatives),
      lowest: Math.min(...initiatives),
      average: initiatives.reduce((sum, init) => sum + init, 0) / initiatives.length,
      playerAverage:
        playerInitiatives.length > 0
          ? playerInitiatives.reduce((sum, init) => sum + init, 0) / playerInitiatives.length
          : 0,
      npcAverage:
        npcInitiatives.length > 0
          ? npcInitiatives.reduce((sum, init) => sum + init, 0) / npcInitiatives.length
          : 0,
    };
  }

  /**
   * Generate turn summary
   */
  getTurnSummary(): {
    currentEntry: InitiativeEntry | null;
    nextEntry: InitiativeEntry | null;
    roundNumber: number;
    totalCombatants: number;
    activeCombatants: number;
    defeatedCombatants: number;
  } {
    const activeEntries = this.entries.filter((e) => this.getHealthStatus(e.id) !== "dead");
    const defeatedEntries = this.entries.filter((e) => this.getHealthStatus(e.id) === "dead");

    const currentEntry = this.getCurrentEntry();
    let nextEntry: InitiativeEntry | null = null;

    if (currentEntry) {
      const currentIndex = this.entries.findIndex((e) => e.isActive);
      const nextIndex = (currentIndex + 1) % this.entries.length;
      nextEntry = this.entries[nextIndex] || null;
    }

    return {
      currentEntry,
      nextEntry,
      roundNumber: Math.floor(this.currentTurn / this.entries.length) + 1,
      totalCombatants: this.entries.length,
      activeCombatants: activeEntries.length,
      defeatedCombatants: defeatedEntries.length,
    };
  }

  /**
   * Export initiative order
   */
  exportInitiativeOrder(): {
    entries: InitiativeEntry[];
    settings: InitiativeTrackerSettings;
    timestamp: number;
  } {
    return {
      entries: [...this.entries],
      settings: { ...this.settings },
      timestamp: Date.now(),
    };
  }

  /**
   * Import initiative order
   */
  importInitiativeOrder(data: {
    entries: InitiativeEntry[];
    settings?: Partial<InitiativeTrackerSettings>;
  }): void {
    this.entries = [...data.entries];

    if (data.settings) {
      this.settings = { ...this.settings, ...data.settings };
    }

    this.emitChange({
      type: "tracker-imported",
      data: { entries: this.getVisibleEntries() },
    });
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries = [];
    this.currentTurn = 0;

    this.emitChange({
      type: "tracker-cleared",
      data: {},
    });
  }

  /**
   * Update settings
   */
  updateSettings(newSettings: Partial<InitiativeTrackerSettings>): void {
    this.settings = { ...this.settings, ...newSettings };

    this.emitChange({
      type: "settings-updated",
      data: { settings: this.settings },
    });
  }

  /**
   * Get settings
   */
  getSettings(): InitiativeTrackerSettings {
    return { ...this.settings };
  }

  // Event system
  addEventListener(listener: (event: InitiativeTrackerEvent) => void): void {
    this.changeListeners.push(listener);
  }

  removeEventListener(listener: (event: InitiativeTrackerEvent) => void): void {
    const index = this.changeListeners.indexOf(listener);
    if (index > -1) {
      this.changeListeners.splice(index, 1);
    }
  }

  private emitChange(event: InitiativeTrackerEvent): void {
    this.changeListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        logger.error("Initiative tracker event listener error:", { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined });
      }
    });
  }
}

// Event types
export type InitiativeTrackerEvent =
  | { type: "tracker-updated"; data: { entries: InitiativeEntry[] } }
  | { type: "order-changed"; data: { entryId: string; oldPosition: number; newPosition: number } }
  | { type: "visibility-changed"; data: { entryId: string; visible: boolean } }
  | { type: "health-updated"; data: { entryId: string; hitPoints: InitiativeEntry["hitPoints"] } }
  | { type: "conditions-updated"; data: { entryId: string; conditions: string[] } }
  | { type: "actions-updated"; data: { entryId: string; actions: InitiativeEntry["actions"] } }
  | { type: "settings-updated"; data: { settings: InitiativeTrackerSettings } }
  | { type: "tracker-cleared"; data: Record<string, unknown> }
  | { type: "tracker-imported"; data: { entries: InitiativeEntry[] } };
