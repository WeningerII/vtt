/**
 * Complete D&D 5e SRD Spell Collection
 * All spells from the System Reference Document 5.1
 */
import type { Spell } from '@vtt/rules-5e';
export interface SRDSpell extends Spell {
    classes: string[];
    source: string;
    tags: string[];
    upcastDescription?: string;
}
export * from './spells/cantrips';
export * from './spells/level1';
export * from './spells/level2';
export * from './spells/level3';
export * from './spells/level4';
export * from './spells/level5';
export * from './spells/level6';
export * from './spells/level7';
export * from './spells/level8';
export * from './spells/level9';
export declare const SRD_SPELLS: Record<string, SRDSpell>;
export declare const getAllSpells: () => SRDSpell[];
export declare const getSpellsByLevel: (_level: number) => SRDSpell[];
export declare const getSpellsByClass: (_className: string) => SRDSpell[];
export declare const getSpellsBySchool: (_school: string) => SRDSpell[];
//# sourceMappingURL=spells.d.ts.map