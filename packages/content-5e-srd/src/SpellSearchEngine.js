/**
 * Advanced Spell Search and Filter Engine
 * Provides comprehensive search, filtering, and sorting capabilities for D&D 5e spells
 */
import { getAllSpells } from "./spells";
export class SpellSearchEngine {
    constructor(customSpells) {
        this.spells = customSpells ? Object.values(customSpells) : getAllSpells();
    }
    /**
     * Search spells with comprehensive filtering
     */
    search(criteria, sort, limit) {
        let filteredSpells = [...this.spells];
        // Apply filters
        filteredSpells = this.applyFilters(filteredSpells, criteria);
        // Sort results
        if (sort) {
            filteredSpells = this.sortSpells(filteredSpells, sort);
        }
        // Generate facets for UI
        const facets = this.generateFacets(filteredSpells);
        // Apply limit
        const totalCount = filteredSpells.length;
        if (limit && limit > 0) {
            filteredSpells = filteredSpells.slice(0, limit);
        }
        return {
            spells: filteredSpells,
            totalCount,
            filters: criteria,
            facets,
        };
    }
    /**
     * Quick search by name with fuzzy matching
     */
    quickSearch(query, limit = 10) {
        const normalizedQuery = query.toLowerCase().trim();
        return this.spells
            .map((spell) => ({
            spell,
            score: this.calculateRelevanceScore(spell, normalizedQuery),
        }))
            .filter((item) => item.score > 0)
            .sort((_a, _b) => b.score - a.score)
            .slice(0, limit)
            .map((item) => item.spell);
    }
    /**
     * Get spells available to a character class at a specific level
     */
    getSpellsForClass(className, characterLevel, includeCantrips = true) {
        const maxSpellLevel = this.getMaxSpellLevelForCharacter(characterLevel);
        return this.spells.filter((spell) => {
            // Check if class can cast this spell
            if (!spell.classes.includes(className))
                return false;
            // Check spell level limits
            if (spell.level === 0)
                return includeCantrips;
            return spell.level <= maxSpellLevel;
        });
    }
    /**
     * Get spell suggestions based on character build
     */
    getSpellSuggestions(characterClass, characterLevel, preferredSchools, preferredTags) {
        const availableSpells = this.getSpellsForClass(characterClass, characterLevel);
        return availableSpells
            .map((spell) => ({
            spell,
            score: this.calculateSuggestionScore(spell, preferredSchools, preferredTags),
        }))
            .sort((_a, _b) => b.score - a.score)
            .slice(0, 20)
            .map((item) => item.spell);
    }
    /**
     * Find similar spells based on mechanics and effects
     */
    findSimilarSpells(spellId, limit = 5) {
        const targetSpell = this.spells.find((s) => s.id === spellId);
        if (!targetSpell)
            return [];
        return this.spells
            .filter((spell) => spell.id !== spellId)
            .map((spell) => ({
            spell,
            similarity: this.calculateSimilarityScore(targetSpell, spell),
        }))
            .sort((_a, _b) => b.similarity - a.similarity)
            .slice(0, limit)
            .map((item) => item.spell);
    }
    applyFilters(spells, criteria) {
        return spells.filter((spell) => {
            // Text search
            if (criteria.name && !spell.name.toLowerCase().includes(criteria.name.toLowerCase())) {
                return false;
            }
            if (criteria.description &&
                !spell.description.toLowerCase().includes(criteria.description.toLowerCase())) {
                return false;
            }
            // Level filter
            if (criteria.level !== undefined) {
                const levels = Array.isArray(criteria.level) ? criteria.level : [criteria.level];
                if (!levels.includes(spell.level))
                    return false;
            }
            // School filter
            if (criteria.school !== undefined) {
                const schools = Array.isArray(criteria.school) ? criteria.school : [criteria.school];
                if (!schools.includes(spell.school))
                    return false;
            }
            // Class filter
            if (criteria.classes !== undefined) {
                const classes = Array.isArray(criteria.classes) ? criteria.classes : [criteria.classes];
                if (!classes.some((cls) => spell.classes.includes(cls)))
                    return false;
            }
            // Component filters
            if (criteria.components) {
                if (criteria.components.verbal !== undefined) {
                    const hasVerbal = spell.components.includes("V");
                    if (criteria.components.verbal !== hasVerbal)
                        return false;
                }
                if (criteria.components.somatic !== undefined) {
                    const hasSomatic = spell.components.includes("S");
                    if (criteria.components.somatic !== hasSomatic)
                        return false;
                }
                if (criteria.components.material !== undefined) {
                    const hasMaterial = spell.components.includes("M");
                    if (criteria.components.material !== hasMaterial)
                        return false;
                }
            }
            // Concentration filter
            if (criteria.concentration !== undefined && spell.concentration !== criteria.concentration) {
                return false;
            }
            // Ritual filter
            if (criteria.ritual !== undefined && spell.ritual !== criteria.ritual) {
                return false;
            }
            // Damage type filter
            if (criteria.damageType !== undefined && spell.damage) {
                const damageTypes = Array.isArray(criteria.damageType)
                    ? criteria.damageType
                    : [criteria.damageType];
                if (!damageTypes.includes(spell.damage.damageType))
                    return false;
            }
            // Saving throw filter
            if (criteria.savingThrow !== undefined && spell.savingThrow) {
                const saves = Array.isArray(criteria.savingThrow)
                    ? criteria.savingThrow
                    : [criteria.savingThrow];
                if (!saves.includes(spell.savingThrow.ability))
                    return false;
            }
            // Has healing filter
            if (criteria.hasHealing !== undefined) {
                const hasHealing = !!spell.healing;
                if (criteria.hasHealing !== hasHealing)
                    return false;
            }
            // Has damage filter
            if (criteria.hasDamage !== undefined) {
                const hasDamage = !!spell.damage;
                if (criteria.hasDamage !== hasDamage)
                    return false;
            }
            // Tags filter
            if (criteria.tags !== undefined) {
                const tags = Array.isArray(criteria.tags) ? criteria.tags : [criteria.tags];
                if (!tags.some((tag) => spell.tags.includes(tag)))
                    return false;
            }
            // Upcastable filter
            if (criteria.upcastable !== undefined) {
                const isUpcastable = !!spell.upcastDescription;
                if (criteria.upcastable !== isUpcastable)
                    return false;
            }
            // Custom filter
            if (criteria.customFilter && !criteria.customFilter(spell)) {
                return false;
            }
            return true;
        });
    }
    sortSpells(spells, sort) {
        return spells.sort((_a, _b) => {
            let aVal = a[sort.field];
            let bVal = b[sort.field];
            // Handle string comparisons
            if (typeof aVal === "string" && typeof bVal === "string") {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }
            let comparison = 0;
            if (aVal < bVal)
                comparison = -1;
            else if (aVal > bVal)
                comparison = 1;
            return sort.direction === "desc" ? -comparison : comparison;
        });
    }
    generateFacets(spells) {
        const facets = {
            levels: (Record),
            schools: (Record),
            classes: (Record),
            tags: (Record),
            damageTypes: (Record),
        };
        spells.forEach((spell) => {
            // Level facets
            facets.levels[spell.level] = (facets.levels[spell.level] || 0) + 1;
            // School facets
            facets.schools[spell.school] = (facets.schools[spell.school] || 0) + 1;
            // Class facets
            spell.classes.forEach((cls) => {
                facets.classes[cls] = (facets.classes[cls] || 0) + 1;
            });
            // Tag facets
            spell.tags.forEach((tag) => {
                facets.tags[tag] = (facets.tags[tag] || 0) + 1;
            });
            // Damage type facets
            if (spell.damage) {
                const type = spell.damage.damageType;
                facets.damageTypes[type] = (facets.damageTypes[type] || 0) + 1;
            }
        });
        return facets;
    }
    calculateRelevanceScore(spell, query) {
        let score = 0;
        // Exact name match gets highest score
        if (spell.name.toLowerCase() === query)
            score += 100;
        // Name starts with query
        else if (spell.name.toLowerCase().startsWith(query))
            score += 50;
        // Name contains query
        else if (spell.name.toLowerCase().includes(query))
            score += 25;
        // Description contains query
        if (spell.description.toLowerCase().includes(query))
            score += 10;
        // School matches
        if (spell.school.toLowerCase().includes(query))
            score += 15;
        // Class matches
        if (spell.classes.some((cls) => cls.toLowerCase().includes(query)))
            score += 15;
        // Tags match
        if (spell.tags.some((tag) => tag.toLowerCase().includes(query)))
            score += 10;
        return score;
    }
    calculateSuggestionScore(spell, preferredSchools, preferredTags) {
        let score = 0;
        // Base score by utility and popularity
        const utilitySpells = ["shield", "counterspell", "fireball", "healing_word", "misty_step"];
        if (utilitySpells.includes(spell.id))
            score += 20;
        // Preferred school bonus
        if (preferredSchools && preferredSchools.includes(spell.school)) {
            score += 15;
        }
        // Preferred tags bonus
        if (preferredTags) {
            const tagMatches = spell.tags.filter((tag) => preferredTags.includes(tag)).length;
            score += tagMatches * 10;
        }
        // Concentration spells are slightly less preferred for new players
        if (spell.concentration)
            score -= 5;
        // Higher level spells get slight preference (more impactful)
        score += spell.level * 2;
        return score;
    }
    calculateSimilarityScore(spell1, spell2) {
        let similarity = 0;
        // Same school
        if (spell1.school === spell2.school)
            similarity += 20;
        // Same level
        if (spell1.level === spell2.level)
            similarity += 15;
        // Same casting time
        if (spell1.castingTime === spell2.castingTime)
            similarity += 10;
        // Similar damage type
        if (spell1.damage && spell2.damage && spell1.damage.damageType === spell2.damage.damageType) {
            similarity += 25;
        }
        // Similar saving throw
        if (spell1.savingThrow &&
            spell2.savingThrow &&
            spell1.savingThrow.ability === spell2.savingThrow.ability) {
            similarity += 15;
        }
        // Common tags
        const commonTags = spell1.tags.filter((tag) => spell2.tags.includes(tag));
        similarity += commonTags.length * 5;
        // Both concentration or both non-concentration
        if (spell1.concentration === spell2.concentration)
            similarity += 10;
        return similarity;
    }
    getMaxSpellLevelForCharacter(characterLevel) {
        if (characterLevel >= 17)
            return 9;
        if (characterLevel >= 15)
            return 8;
        if (characterLevel >= 13)
            return 7;
        if (characterLevel >= 11)
            return 6;
        if (characterLevel >= 9)
            return 5;
        if (characterLevel >= 7)
            return 4;
        if (characterLevel >= 5)
            return 3;
        if (characterLevel >= 3)
            return 2;
        if (characterLevel >= 1)
            return 1;
        return 0;
    }
}
// Export singleton instance
export const _spellSearchEngine = new SpellSearchEngine();
//# sourceMappingURL=SpellSearchEngine.js.map