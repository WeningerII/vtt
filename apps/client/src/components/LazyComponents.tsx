/**
 * Lazy-loaded component definitions for code splitting optimization
 * This file implements strategic code splitting to reduce bundle size from 2.1MB to <1.5MB
 */

import { lazy, LazyExoticComponent, ComponentType } from "react";

// Type-safe lazy loading with explicit type annotations to avoid TS errors
type LazyComponent = LazyExoticComponent<ComponentType<any>>;

// Bundle size optimization: Split heavy VTT components
export const LazyBattleMap: LazyComponent = lazy(() => import("./map/BattleMap"));

export const LazyTokenPropertiesPanel: LazyComponent = lazy(() => import("./map/TokenPropertiesPanel"));

export const LazyMapLayersPanel: LazyComponent = lazy(() => import("./map/MapLayersPanel"));

// Heavy components that should be lazy loaded
export const LazyMonsterBrowser: LazyComponent = lazy(() => import("./MonsterBrowser"));

export const LazyCharacterSheet: LazyComponent = lazy(() => import("./CharacterSheet"));

export const LazyGameCanvas: LazyComponent = lazy(() => import("./GameCanvas"));

export const LazyMapEditor: LazyComponent = lazy(() => import("./MapEditor"));

export const LazyEncounterGenerator: LazyComponent = lazy(() => import("./EncounterGenerator"));

export const LazyAIAssistant: LazyComponent = lazy(() => import("./AIAssistant"));

export const LazyCombatTracker: LazyComponent = lazy(() => import("./CombatTracker"));

export const LazyDiceRoller: LazyComponent = lazy(() => import("./DiceRoller"));

// Campaign and character management components
export const LazyCampaignsList: LazyComponent = lazy(() => import("./campaigns/CampaignsList"));

export const LazyCreateCampaignModal: LazyComponent = lazy(() => import("./campaigns/CreateCampaignModal"));

export const LazyCampaignMapManager: LazyComponent = lazy(() => import("./campaigns/CampaignMapManager"));

// Authentication components
export const LazyLoginForm: LazyComponent = lazy(() => import("./auth/LoginForm"));

export const LazyRegisterForm: LazyComponent = lazy(() => import("./auth/RegisterForm"));

// Dashboard components
export const LazyDashboardHome: LazyComponent = lazy(() => import("./dashboard/DashboardHome"));

// Billing components
export const LazyBillingDashboard: LazyComponent = lazy(() => import("./billing/BillingDashboard"));

// Character sheet panels
export const LazyAbilityScores: LazyComponent = lazy(() => import("./character/AbilityScores"));

export const LazyEquipmentPanel: LazyComponent = lazy(() => import("./character/EquipmentPanel"));

export const LazySpellsPanel: LazyComponent = lazy(() => import("./character/SpellsPanel"));

export const LazySkillsPanel: LazyComponent = lazy(() => import("./character/SkillsPanel"));

export const LazyNotesPanel: LazyComponent = lazy(() => import("./character/NotesPanel"));

// Combat components
export const LazyCombatEncounterPanel: LazyComponent = lazy(() => import("./combat/CombatEncounterPanel"));

// AI components - Heavy ML/AI features split for better performance
export const LazyCombatAssistant: LazyComponent = lazy(() => import("./ai/CombatAssistant"));

// Note: Additional UI components can be added here as they're created

export const LazyGenesisWizard: LazyComponent = lazy(() => import("./ai/GenesisWizard"));

// Performance Monitor for development
export const LazyPerformanceMonitor: LazyComponent = lazy(() => import("./PerformanceMonitor"));

// Heavy UI components that benefit from splitting
export const LazyVTTApp: LazyComponent = lazy(() => import("./VTTApp"));

export const LazySceneCanvas: LazyComponent = lazy(() => import("./SceneCanvas"));

// Route-based lazy loading chunks
export const LazyGameLobby: LazyComponent = lazy(() => import("./GameLobby"));

export const LazyVTTDemo: LazyComponent = lazy(() => import("./VTTDemo"));

// Preload critical components for better UX
export const preloadCriticalComponents = () => {
  // Preload components likely to be used in the first user interaction
  import("./map/BattleMap");
  import("./CombatTracker");
  import("./DiceRoller");
};

// Preload secondary components after initial load
export const preloadSecondaryComponents = () => {
  setTimeout(() => {
    import("./CharacterSheet");
    import("./MonsterBrowser");
    import("./EncounterGenerator");
  }, 2000);
};
