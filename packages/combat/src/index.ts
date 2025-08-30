/**
 * Combat Package Entry Point
 * Exports all combat-related components
 */

export * from './CombatManager';
export * from './InitiativeTracker';
export * from './DamageCalculator';

// Re-export commonly used types for convenience
export type {
  Combatant,
  CombatState,
  CombatRound,
  CombatEvent,
  CombatSettings,
  CombatManagerEvent
} from './CombatManager';

export type {
  InitiativeEntry,
  InitiativeTrackerSettings,
  InitiativeTrackerEvent
} from './InitiativeTracker';

export type {
  DamageInstance,
  DamageResult,
  DamageResistance,
  DamageModification,
  CreatureDefenses
} from './DamageCalculator';
