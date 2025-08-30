/**
 * Spell Collection Import/Export Manager
 * Handles saving, loading, and sharing spell collections
 */
import type { SRDSpell } from './spells';
export interface SpellCollection {
    id: string;
    name: string;
    description?: string;
    spellIds: string[];
    characterClass?: string;
    characterLevel?: number;
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
    version: string;
}
export interface ExportedSpellCollection extends SpellCollection {
    spells: SRDSpell[];
}
export interface ImportOptions {
    merge?: boolean;
    validateSpells?: boolean;
    updateExisting?: boolean;
}
export interface ExportOptions {
    format: 'json' | 'csv' | 'txt' | 'foundry' | 'roll20' | 'dndbeyond';
    includeSpellData?: boolean;
    minify?: boolean;
}
export declare class SpellCollectionManager {
    private collections;
    /**
     * Create a new spell collection
     */
    createCollection(data: Omit<SpellCollection, 'id' | 'createdAt' | 'updatedAt' | 'version'>): SpellCollection;
    /**
     * Get all collections
     */
    getAllCollections(): SpellCollection[];
    /**
     * Get collection by ID
     */
    getCollection(id: string): SpellCollection | undefined;
    /**
     * Update a collection
     */
    updateCollection(id: string, updates: Partial<Omit<SpellCollection, 'id' | 'createdAt' | 'version'>>): SpellCollection | undefined;
    /**
     * Delete a collection
     */
    deleteCollection(id: string): boolean;
    /**
     * Add spells to a collection
     */
    addSpellsToCollection(collectionId: string, spellIds: string[]): boolean;
    /**
     * Remove spells from a collection
     */
    removeSpellsFromCollection(collectionId: string, spellIds: string[]): boolean;
    /**
     * Export collection to various formats
     */
    exportCollection(collectionId: string, options: ExportOptions): string;
    /**
     * Import collection from various formats
     */
    importCollection(data: string, format: ExportOptions['format'], options?: ImportOptions): SpellCollection;
    /**
     * Create collection from search results
     */
    createCollectionFromSearch(name: string, searchCriteria: any, options?: {
        description?: string;
        tags?: string[];
    }): SpellCollection;
    /**
     * Create collection for character class and level
     */
    createClassCollection(className: string, level: number): SpellCollection;
    /**
     * Duplicate a collection
     */
    duplicateCollection(collectionId: string, newName?: string): SpellCollection | undefined;
    /**
     * Get spell statistics for a collection
     */
    getCollectionStats(collectionId: string): {
        totalSpells: number;
        byLevel: Record<number, number>;
        bySchool: Record<string, number>;
        byClass: Record<string, number>;
        concentrationSpells: number;
        ritualSpells: number;
        averageLevel: number;
    };
    private getSpellsForCollection;
    private generateId;
    private validateSpellIds;
    private exportAsJson;
    private exportAsCsv;
    private exportAsText;
    private exportAsFoundryVTT;
    private exportAsRoll20;
    private exportAsDnDBeyond;
    private parseJsonImport;
    private parseCsvImport;
    private parseFoundryImport;
}
export declare const spellCollectionManager: SpellCollectionManager;
//# sourceMappingURL=SpellCollectionManager.d.ts.map