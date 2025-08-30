/**
 * Advanced Spell Search and Filter Engine
 * Provides comprehensive search, filtering, and sorting capabilities for D&D 5e spells
 */
import type { SRDSpell } from "./spells";
export interface SpellSearchCriteria {
  name?: string;
  description?: string;
  level?: number | number[];
  school?: string | string[];
  classes?: string | string[];
  components?: {
    verbal?: boolean;
    somatic?: boolean;
    material?: boolean;
  };
  concentration?: boolean;
  ritual?: boolean;
  castingTime?: string | string[];
  range?: string | string[];
  duration?: string | string[];
  damageType?: string | string[];
  savingThrow?: string | string[];
  hasHealing?: boolean;
  hasDamage?: boolean;
  tags?: string | string[];
  source?: string | string[];
  upcastable?: boolean;
  customFilter?: (_spell: SRDSpell) => boolean;
}
export interface SpellSortOptions {
  field: "name" | "level" | "school" | "castingTime" | "range" | "duration";
  direction: "asc" | "desc";
}
export interface SpellSearchResult {
  spells: SRDSpell[];
  totalCount: number;
  filters: SpellSearchCriteria;
  facets: {
    levels: Record<number, number>;
    schools: Record<string, number>;
    classes: Record<string, number>;
    tags: Record<string, number>;
    damageTypes: Record<string, number>;
  };
}
export declare class SpellSearchEngine {
  private spells;
  constructor(customSpells?: Record<string, SRDSpell>);
  /**
   * Search spells with comprehensive filtering
   */
  search(criteria: SpellSearchCriteria, sort?: SpellSortOptions, limit?: number): SpellSearchResult;
  /**
   * Quick search by name with fuzzy matching
   */
  quickSearch(query: string, limit?: number): SRDSpell[];
  /**
   * Get spells available to a character class at a specific level
   */
  getSpellsForClass(
    className: string,
    characterLevel: number,
    includeCantrips?: boolean,
  ): SRDSpell[];
  /**
   * Get spell suggestions based on character build
   */
  getSpellSuggestions(
    characterClass: string,
    characterLevel: number,
    preferredSchools?: string[],
    preferredTags?: string[],
  ): SRDSpell[];
  /**
   * Find similar spells based on mechanics and effects
   */
  findSimilarSpells(spellId: string, limit?: number): SRDSpell[];
  private applyFilters;
  private sortSpells;
  private generateFacets;
  private calculateRelevanceScore;
  private calculateSuggestionScore;
  private calculateSimilarityScore;
  private getMaxSpellLevelForCharacter;
}
export declare const spellSearchEngine: SpellSearchEngine;
//# sourceMappingURL=SpellSearchEngine.d.ts.map
