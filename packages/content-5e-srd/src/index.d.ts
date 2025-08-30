/**
 * D&D 5e SRD Content Package
 * Complete System Reference Document content including monsters and spells
 */
import { Monster } from "@vtt/core-schemas";
export declare const Goblin: Monster;
export declare const Orc: Monster;
export declare const Skeleton: Monster;
export declare const Wolf: Monster;
export declare const SRDMonsters: Monster[];
export * from "./spells";
export * from "./SpellSearchEngine";
export * from "./SpellcastingClasses";
export * from "./SpellScalingEngine";
export * from "./SpellCollectionManager";
export * from "./ComputationalSpellSystem";
export * from "./ComputationalSpells";
export * from "./SpellRuleEngine";
export * from "./SpellPhysicsIntegration";
export {
  SRD_SPELLS,
  getAllSpells,
  getSpellsByLevel,
  getSpellsByClass,
  getSpellsBySchool,
} from "./spells";
export {
  spellSearchEngine,
  type SpellSearchCriteria,
  type SpellSearchResult,
} from "./SpellSearchEngine";
export {
  SPELLCASTING_CLASSES,
  getSpellSlotsForClass,
  getCantripsKnown,
  getSpellsKnown,
  getMaxSpellLevel,
  getSpellcastingModifier,
} from "./SpellcastingClasses";
export {
  spellScalingEngine,
  type ScaledSpellEffect,
  type SpellUpcastOptions,
} from "./SpellScalingEngine";
export {
  spellCollectionManager,
  type SpellCollection,
  type ExportedSpellCollection,
} from "./SpellCollectionManager";
export default SRDMonsters;
//# sourceMappingURL=index.d.ts.map
