/**
 * D&D 5e SRD Content Package
 * Complete System Reference Document content including monsters and spells
 */
// === MONSTERS ===
export const Goblin = {
  id: "srd-goblin",
  name: "Goblin",
  size: "SMALL",
  type: "HUMANOID",
  alignment: "neutral evil",
  ac: { value: 15, type: "leather armor, shield" },
  hp: { average: 7, formula: "2d6" },
  speed: { walk: 30 },
  abilities: { STR: 8, DEX: 14, CON: 10, INT: 10, WIS: 8, CHA: 8 },
  skills: { STEALTH: 6 },
  senses: [{ type: "DARKVISION", rangeFt: 60 }],
  passivePerception: 9,
  languages: ["Common", "Goblin"],
  challengeRating: "1/4",
  xp: 50,
  proficiencyBonus: 2,
  traits: [
    {
      name: "Nimble Escape",
      kind: "TEXT",
      description:
        "The goblin can take the Disengage or Hide action as a bonus action on each of its turns.",
    },
  ],
  actions: [
    {
      name: "Scimitar",
      kind: "ATTACK",
      attackType: "MELEE_WEAPON",
      toHitBonus: 4,
      reachFt: 5,
      target: "one target",
      onHit: [{ average: 5, formula: "1d6+2", type: "SLASHING" }],
    },
    {
      name: "Shortbow",
      kind: "ATTACK",
      attackType: "RANGED_WEAPON",
      toHitBonus: 4,
      rangeFt: [80, 320],
      target: "one target",
      onHit: [{ average: 5, formula: "1d6+2", type: "PIERCING" }],
    },
  ],
  bonusActions: [],
  reactions: [],
  legendaryActions: [],
  legendaryActionsPerRound: 0,
  source: "SRD 5.1",
  tags: ["GOBLINOID"],
};
export const Orc = {
  id: "srd-orc",
  name: "Orc",
  size: "MEDIUM",
  type: "HUMANOID",
  alignment: "chaotic evil",
  ac: { value: 13, type: "hide armor" },
  hp: { average: 15, formula: "2d8+6" },
  speed: { walk: 30 },
  abilities: { STR: 16, DEX: 12, CON: 16, INT: 7, WIS: 11, CHA: 10 },
  skills: { INTIMIDATION: 2 },
  senses: [{ type: "DARKVISION", rangeFt: 60 }],
  passivePerception: 10,
  languages: ["Common", "Orc"],
  challengeRating: "1/2",
  xp: 100,
  proficiencyBonus: 2,
  traits: [
    {
      name: "Aggressive",
      kind: "TEXT",
      description:
        "As a bonus action, the orc can move up to its speed toward a hostile creature that it can see.",
    },
  ],
  actions: [
    {
      name: "Greataxe",
      kind: "ATTACK",
      attackType: "MELEE_WEAPON",
      toHitBonus: 5,
      reachFt: 5,
      target: "one target",
      onHit: [{ average: 9, formula: "1d12+3", type: "SLASHING" }],
    },
    {
      name: "Javelin",
      kind: "ATTACK",
      attackType: "MELEE_WEAPON",
      toHitBonus: 5,
      reachFt: 5,
      target: "one target",
      onHit: [{ average: 6, formula: "1d6+3", type: "PIERCING" }],
    },
    {
      name: "Javelin (Ranged)",
      kind: "ATTACK",
      attackType: "RANGED_WEAPON",
      toHitBonus: 5,
      rangeFt: [30, 120],
      target: "one target",
      onHit: [{ average: 6, formula: "1d6+3", type: "PIERCING" }],
    },
  ],
  bonusActions: [],
  reactions: [],
  legendaryActions: [],
  legendaryActionsPerRound: 0,
  source: "SRD 5.1",
  tags: [],
};
export const Skeleton = {
  id: "srd-skeleton",
  name: "Skeleton",
  size: "MEDIUM",
  type: "UNDEAD",
  alignment: "lawful evil",
  ac: { value: 13, type: "armor scraps" },
  hp: { average: 13, formula: "2d8+4" },
  speed: { walk: 30 },
  abilities: { STR: 10, DEX: 14, CON: 15, INT: 6, WIS: 8, CHA: 5 },
  damageVulnerabilities: ["bludgeoning"],
  damageImmunities: ["poison"],
  conditionImmunities: ["poisoned", "exhaustion"],
  senses: [{ type: "DARKVISION", rangeFt: 60 }],
  passivePerception: 9,
  languages: [],
  languageNote: "Understands the languages it knew in life but can't speak",
  challengeRating: "1/4",
  xp: 50,
  proficiencyBonus: 2,
  traits: [],
  actions: [
    {
      name: "Shortsword",
      kind: "ATTACK",
      attackType: "MELEE_WEAPON",
      toHitBonus: 4,
      reachFt: 5,
      target: "one target",
      onHit: [{ average: 5, formula: "1d6+2", type: "PIERCING" }],
    },
    {
      name: "Shortbow",
      kind: "ATTACK",
      attackType: "RANGED_WEAPON",
      toHitBonus: 4,
      rangeFt: [80, 320],
      target: "one target",
      onHit: [{ average: 5, formula: "1d6+2", type: "PIERCING" }],
    },
  ],
  bonusActions: [],
  reactions: [],
  legendaryActions: [],
  legendaryActionsPerRound: 0,
  source: "SRD 5.1",
  tags: [],
};
export const Wolf = {
  id: "srd-wolf",
  name: "Wolf",
  size: "MEDIUM",
  type: "BEAST",
  alignment: "unaligned",
  ac: { value: 13, type: "natural armor" },
  hp: { average: 11, formula: "2d8+2" },
  speed: { walk: 40 },
  abilities: { STR: 12, DEX: 15, CON: 12, INT: 3, WIS: 12, CHA: 6 },
  skills: { PERCEPTION: 3, STEALTH: 4 },
  senses: [],
  passivePerception: 13,
  languages: [],
  challengeRating: "1/4",
  xp: 50,
  proficiencyBonus: 2,
  traits: [
    {
      name: "Keen Hearing and Smell",
      kind: "TEXT",
      description:
        "The wolf has advantage on Wisdom (Perception) checks that rely on hearing or smell.",
    },
    {
      name: "Pack Tactics",
      kind: "TEXT",
      description:
        "The wolf has advantage on an attack roll against a creature if at least one of the wolf's allies is within 5 feet of the creature and the ally isn't incapacitated.",
    },
  ],
  actions: [
    {
      name: "Bite",
      kind: "ATTACK",
      attackType: "MELEE_WEAPON",
      toHitBonus: 4,
      reachFt: 5,
      target: "one target",
      onHit: [{ average: 7, formula: "2d4+2", type: "PIERCING" }],
      onHitText:
        "If the target is a creature, it must succeed on a DC 11 Strength saving throw or be knocked prone.",
    },
  ],
  bonusActions: [],
  reactions: [],
  legendaryActions: [],
  legendaryActionsPerRound: 0,
  source: "SRD 5.1",
  tags: [],
};
export const SRDMonsters = [Goblin, Orc, Skeleton, Wolf];
// === SPELLS ===
// Legacy spell system exports (human-readable)
export * from "./spells";
export * from "./SpellSearchEngine";
export * from "./SpellcastingClasses";
export * from "./SpellScalingEngine";
export * from "./SpellCollectionManager";
// Computational spell system exports (machine-executable)
export * from "./ComputationalSpellSystem";
export * from "./ComputationalSpells";
export * from "./SpellRuleEngine";
export * from "./SpellPhysicsIntegration";
// Convenience exports for most common use cases
export {
  SRD_SPELLS,
  getAllSpells,
  getSpellsByLevel,
  getSpellsByClass,
  getSpellsBySchool,
} from "./spells";
export { spellSearchEngine } from "./SpellSearchEngine";
export {
  SPELLCASTING_CLASSES,
  getSpellSlotsForClass,
  getCantripsKnown,
  getSpellsKnown,
  getMaxSpellLevel,
  getSpellcastingModifier,
} from "./SpellcastingClasses";
export { spellScalingEngine } from "./SpellScalingEngine";
export { spellCollectionManager } from "./SpellCollectionManager";
// Default export remains monsters for backward compatibility
export default SRDMonsters;
//# sourceMappingURL=index.js.map
