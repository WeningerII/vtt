/**
 * Complete D&D 5e SRD Spell Collection
 * All spells from the System Reference Document 5.1
 */
// Import complete spell data from separate files
export * from "./spells/cantrips";
export * from "./spells/level1";
export * from "./spells/level2";
export * from "./spells/level3";
export * from "./spells/level4";
export * from "./spells/level5";
export * from "./spells/level6";
export * from "./spells/level7";
export * from "./spells/level8";
export * from "./spells/level9";
import { CANTRIPS } from "./spells/cantrips";
import { LEVEL_1_SPELLS } from "./spells/level1";
import { LEVEL_2_SPELLS } from "./spells/level2";
import { LEVEL_3_SPELLS } from "./spells/level3";
import { LEVEL_4_SPELLS } from "./spells/level4";
import { LEVEL_5_SPELLS } from "./spells/level5";
import { LEVEL_6_SPELLS } from "./spells/level6";
import { LEVEL_7_SPELLS } from "./spells/level7";
import { LEVEL_8_SPELLS } from "./spells/level8";
import { LEVEL_9_SPELLS } from "./spells/level9";
export const SRD_SPELLS = {
    ...CANTRIPS,
    ...LEVEL_1_SPELLS,
    ...LEVEL_2_SPELLS,
    ...LEVEL_3_SPELLS,
    ...LEVEL_4_SPELLS,
    ...LEVEL_5_SPELLS,
    ...LEVEL_6_SPELLS,
    ...LEVEL_7_SPELLS,
    ...LEVEL_8_SPELLS,
    ...LEVEL_9_SPELLS,
};
export const getAllSpells = () => Object.values(SRD_SPELLS);
export const _getSpellsByLevel = (level) => getAllSpells().filter((spell) => spell.level === level);
export const _getSpellsByClass = (className) => getAllSpells().filter((spell) => spell.classes.includes(className));
export const _getSpellsBySchool = (school) => getAllSpells().filter((spell) => spell.school === school);
//# sourceMappingURL=spells.js.map