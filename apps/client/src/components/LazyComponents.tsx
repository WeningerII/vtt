/**
 * Lazy-loaded component definitions for code splitting optimization
 */

import { lazy } from 'react';

// Heavy components that should be lazy loaded
export const LazyMonsterBrowser = lazy(() => 
  import('./MonsterBrowser').then(module => ({ default: module.MonsterBrowser }))
);

export const LazyCharacterSheet = lazy(() => 
  import('./CharacterSheet').then(module => ({ default: module.CharacterSheet }))
);

export const LazyGameCanvas = lazy(() => 
  import('./GameCanvas').then(module => ({ default: module.GameCanvas }))
);

export const LazyMapEditor = lazy(() => 
  import('./MapEditor').then(module => ({ default: module.MapEditor }))
);

export const LazyEncounterGenerator = lazy(() => 
  import('./EncounterGenerator').then(module => ({ default: module.EncounterGenerator }))
);

export const LazyAIAssistant = lazy(() => 
  import('./AIAssistant').then(module => ({ default: module.AIAssistant }))
);

export const LazyCombatTracker = lazy(() => 
  import('./CombatTracker').then(module => ({ default: module.CombatTracker }))
);

export const LazyDiceRoller = lazy(() => 
  import('./DiceRoller').then(module => ({ default: module.DiceRoller }))
);

// Campaign and character management components
export const LazyCampaignsList = lazy(() => 
  import('./campaigns/CampaignsList').then(module => ({ default: module.CampaignsList }))
);

export const LazyCreateCampaignModal = lazy(() => 
  import('./campaigns/CreateCampaignModal').then(module => ({ default: module.CreateCampaignModal }))
);

export const LazyCampaignMapManager = lazy(() => 
  import('./campaigns/CampaignMapManager').then(module => ({ default: module.CampaignMapManager }))
);

// Authentication components
export const LazyLoginForm = lazy(() => 
  import('./auth/LoginForm').then(module => ({ default: module.LoginForm }))
);

export const LazyRegisterForm = lazy(() => 
  import('./auth/RegisterForm').then(module => ({ default: module.RegisterForm }))
);

// Dashboard components
export const LazyDashboardHome = lazy(() => 
  import('./dashboard/DashboardHome').then(module => ({ default: module.DashboardHome }))
);

// Billing components
export const LazyBillingDashboard = lazy(() => 
  import('./billing/BillingDashboard').then(module => ({ default: module.BillingDashboard }))
);

// Character sheet panels
export const LazyAbilityScores = lazy(() => 
  import('./character/AbilityScores').then(module => ({ default: module.AbilityScores }))
);

export const LazyEquipmentPanel = lazy(() => 
  import('./character/EquipmentPanel').then(module => ({ default: module.EquipmentPanel }))
);

export const LazySpellsPanel = lazy(() => 
  import('./character/SpellsPanel').then(module => ({ default: module.SpellsPanel }))
);

export const LazySkillsPanel = lazy(() => 
  import('./character/SkillsPanel').then(module => ({ default: module.SkillsPanel }))
);

export const LazyNotesPanel = lazy(() => 
  import('./character/NotesPanel').then(module => ({ default: module.NotesPanel }))
);

// Combat components
export const LazyCombatEncounterPanel = lazy(() => 
  import('./combat/CombatEncounterPanel').then(module => ({ default: module.CombatEncounterPanel }))
);

// AI components
export const LazyCombatAssistant = lazy(() => 
  import('./ai/CombatAssistant').then(module => ({ default: module.CombatAssistant }))
);

export const LazyGenesisWizard = lazy(() => 
  import('./ai/GenesisWizard').then(module => ({ default: module.LazyGenesisWizard }))
);
