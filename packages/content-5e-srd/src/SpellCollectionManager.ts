/**
 * Spell Collection Import/Export Manager
 * Handles saving, loading, and sharing spell collections
 */

import type { SRDSpell } from './spells';
import { logger } from '@vtt/logging';
import { spellSearchEngine } from './SpellSearchEngine';

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
  spells: SRDSpell[]; // Full spell data included for portability
}

export interface ImportOptions {
  merge?: boolean; // Merge with existing collection vs replace
  validateSpells?: boolean; // Validate spell IDs exist
  updateExisting?: boolean; // Update existing collection if ID matches
}

export interface ExportOptions {
  format: 'json' | 'csv' | 'txt' | 'foundry' | 'roll20' | 'dndbeyond';
  includeSpellData?: boolean; // Include full spell definitions
  minify?: boolean; // Minimize file size
}

export class SpellCollectionManager {
  private collections: Map<string, SpellCollection> = new Map();

  /**
   * Create a new spell collection
   */
  createCollection(data: Omit<SpellCollection, 'id' | 'createdAt' | 'updatedAt' | 'version'>): SpellCollection {
    const collection: SpellCollection = {
      ...data,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date(),
      version: '1.0.0'
    };

    this.collections.set(collection.id, collection);
    return collection;
  }

  /**
   * Get all collections
   */
  getAllCollections(): SpellCollection[] {
    return Array.from(this.collections.values());
  }

  /**
   * Get collection by ID
   */
  getCollection(id: string): SpellCollection | undefined {
    return this.collections.get(id);
  }

  /**
   * Update a collection
   */
  updateCollection(id: string, updates: Partial<Omit<SpellCollection, 'id' | 'createdAt' | 'version'>>): SpellCollection | undefined {
    const collection = this.collections.get(id);
    if (!collection) return undefined;

    const updated = {
      ...collection,
      ...updates,
      updatedAt: new Date()
    };

    this.collections.set(id, updated);
    return updated;
  }

  /**
   * Delete a collection
   */
  deleteCollection(id: string): boolean {
    return this.collections.delete(id);
  }

  /**
   * Add spells to a collection
   */
  addSpellsToCollection(collectionId: string, spellIds: string[]): boolean {
    const collection = this.collections.get(collectionId);
    if (!collection) return false;

    const uniqueSpells = new Set([...collection.spellIds, ...spellIds]);
    collection.spellIds = Array.from(uniqueSpells);
    collection.updatedAt = new Date();
    
    return true;
  }

  /**
   * Remove spells from a collection
   */
  removeSpellsFromCollection(collectionId: string, spellIds: string[]): boolean {
    const collection = this.collections.get(collectionId);
    if (!collection) return false;

    collection.spellIds = collection.spellIds.filter(id => !spellIds.includes(id));
    collection.updatedAt = new Date();
    
    return true;
  }

  /**
   * Export collection to various formats
   */
  exportCollection(collectionId: string, options: ExportOptions): string {
    const collection = this.collections.get(collectionId);
    if (!collection) throw new Error('Collection not found');

    const spells = this.getSpellsForCollection(collection);
    const exportData: ExportedSpellCollection = {
      ...collection,
      spells: options.includeSpellData ? spells : []
    };

    switch (options.format) {
      case 'json':
        return this.exportAsJson(exportData, options.minify);
      case 'csv':
        return this.exportAsCsv(spells);
      case 'txt':
        return this.exportAsText(collection, spells);
      case 'foundry':
        return this.exportAsFoundryVTT(collection, spells);
      case 'roll20':
        return this.exportAsRoll20(collection, spells);
      case 'dndbeyond':
        return this.exportAsDnDBeyond(collection, spells);
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  /**
   * Import collection from various formats
   */
  importCollection(data: string, format: ExportOptions['format'], options: ImportOptions = {}): SpellCollection {
    let parsedData: ExportedSpellCollection;

    try {
      switch (format) {
        case 'json':
          parsedData = this.parseJsonImport(data);
          break;
        case 'csv':
          parsedData = this.parseCsvImport(data);
          break;
        case 'foundry':
          parsedData = this.parseFoundryImport(data);
          break;
        default:
          throw new Error(`Unsupported import format: ${format}`);
      }
    } catch (error) {
      throw new Error(`Failed to parse import data: ${error}`);
    }

    // Validate spells if requested
    if (options.validateSpells) {
      const validSpellIds = this.validateSpellIds(parsedData.spellIds);
      if (validSpellIds.length !== parsedData.spellIds.length) {
        const invalidIds = parsedData.spellIds.filter(id => !validSpellIds.includes(id));
        logger.warn(`Invalid spell IDs found: ${invalidIds.join(', ')}`);
        parsedData.spellIds = validSpellIds;
      }
    }

    // Check if collection already exists
    if (options.updateExisting && this.collections.has(parsedData.id)) {
      if (options.merge) {
        // Merge spell lists
        const existing = this.collections.get(parsedData.id)!;
        const mergedSpellIds = new Set([...existing.spellIds, ...parsedData.spellIds]);
        parsedData.spellIds = Array.from(mergedSpellIds);
      }
      
      return this.updateCollection(parsedData.id, {
        name: parsedData.name,
        description: parsedData.description || undefined,
        spellIds: parsedData.spellIds,
        characterClass: parsedData.characterClass || undefined,
        characterLevel: parsedData.characterLevel || undefined,
        tags: parsedData.tags
      })!;
    }

    // Create new collection
    const { _spells,  ...collectionData  } = parsedData;
    return this.createCollection({
      ...collectionData,
      id: options.updateExisting ? parsedData.id : undefined
    } as any);
  }

  /**
   * Create collection from search results
   */
  createCollectionFromSearch(
    name: string,
    searchCriteria: any,
    options?: { description?: string; tags?: string[] }
  ): SpellCollection {
    const results = spellSearchEngine.search(searchCriteria);
    const spellIds = results.spells.map(spell => spell.id);

    return this.createCollection({
      name,
      description: options?.description || `Collection created from search: ${JSON.stringify(searchCriteria)}`,
      spellIds,
      tags: options?.tags || ['search-generated'],
      characterClass: searchCriteria.classes?.[0],
      characterLevel: searchCriteria.level?.[0]
    });
  }

  /**
   * Create collection for character class and level
   */
  createClassCollection(className: string, level: number): SpellCollection {
    const spells = spellSearchEngine.getSpellsForClass(className, level);
    const spellIds = spells.map(spell => spell.id);

    return this.createCollection({
      name: `${className} Spells (Level ${level})`,
      description: `All spells available to a level ${level} ${className}`,
      spellIds,
      characterClass: className,
      characterLevel: level,
      tags: ['class-generated', className.toLowerCase()]
    });
  }

  /**
   * Duplicate a collection
   */
  duplicateCollection(collectionId: string, newName?: string): SpellCollection | undefined {
    const original = this.collections.get(collectionId);
    if (!original) return undefined;

    const duplicate = this.createCollection({
      ...original,
      name: newName || `${original.name} (Copy)`,
      tags: [...original.tags, 'duplicate']
    });

    return duplicate;
  }

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
  } {
    const collection = this.collections.get(collectionId);
    if (!collection) throw new Error('Collection not found');

    const spells = this.getSpellsForCollection(collection);
    
    const stats = {
      totalSpells: spells.length,
      byLevel: {} as Record<number, number>,
      bySchool: {} as Record<string, number>,
      byClass: {} as Record<string, number>,
      concentrationSpells: 0,
      ritualSpells: 0,
      averageLevel: 0
    };

    let totalLevels = 0;

    spells.forEach(spell => {
      // Level distribution
      stats.byLevel[spell.level] = (stats.byLevel[spell.level] || 0) + 1;
      totalLevels += spell.level;

      // School distribution
      stats.bySchool[spell.school] = (stats.bySchool[spell.school] || 0) + 1;

      // Class distribution
      spell.classes.forEach(cls => {
        stats.byClass[cls] = (stats.byClass[cls] || 0) + 1;
      });

      // Special properties
      if (spell.concentration) stats.concentrationSpells++;
    });

    spells.forEach(spell => {
      if (spell.ritual) stats.ritualSpells++;
    });

    stats.averageLevel = spells.length > 0 ? totalLevels / spells.length : 0;

    return stats;
  }

  private getSpellsForCollection(collection: SpellCollection): SRDSpell[] {
    return spellSearchEngine.search({_customFilter: (spell) => collection.spellIds.includes(spell.id)}).spells;
  }

  private generateId(): string {
    return `collection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private validateSpellIds(spellIds: string[]): string[] {
    const allSpells = spellSearchEngine.search({});
    const validIds = new Set(allSpells.spells.map(s => s.id));
    return spellIds.filter(id => validIds.has(id));
  }

  private exportAsJson(data: ExportedSpellCollection, minify?: boolean): string {
    return JSON.stringify(data, null, minify ? 0 : 2);
  }

  private exportAsCsv(spells: SRDSpell[]): string {
    const headers = ['Name', 'Level', 'School', 'Casting Time', 'Range', 'Duration', 'Components', 'Classes', 'Description'];
    const rows = spells.map(spell => [
      spell.name,
      spell.level.toString(),
      spell.school,
      spell.castingTime,
      spell.range,
      spell.duration,
      spell.components.join(', '),
      spell.classes.join(', '),
      spell.description.replace(/"/g, '""')
    ]);

    return [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
  }

  private exportAsText(collection: SpellCollection, spells: SRDSpell[]): string {
    let output = `# ${collection.name}\n\n`;
    
    if (collection.description) {
      output += `${collection.description}\n\n`;
    }

    output += `**Total Spells:** ${spells.length}\n`;
    output += `**Created:** ${collection.createdAt.toLocaleDateString()}\n\n`;

    // Group by level
    const byLevel = spells.reduce((_acc, _spell) => {
      const level = spell.level === 0 ? 'Cantrips' : `Level ${spell.level}`;
      if (!acc[level]) acc[level] = [];
      acc[level].push(spell);
      return acc;
    }, {} as Record<string, SRDSpell[]>);

    for (const [level, levelSpells] of Object.entries(byLevel)) {
      output += `## ${level}\n\n`;
      levelSpells.forEach(spell => {
        output += `**${spell.name}** (${spell.school})\n`;
        output += `*${spell.castingTime} • ${spell.range} • ${spell.duration}*\n`;
        output += `${spell.description}\n\n`;
      });
    }

    return output;
  }

  private exportAsFoundryVTT(collection: SpellCollection, spells: SRDSpell[]): string {
    const foundrySpells = spells.map(spell => ({
      name: spell.name,
      type: 'spell',
      data: {
        level: spell.level,
        school: spell.school,
        components: {
          vocal: spell.components?.includes('V') || false,
          somatic: spell.components?.includes('S') || false,
          material: spell.components?.includes('M') || false,
          materialData: spell.materialComponent || ''
        },
        activation: { type: 'action', cost: 1 },
        duration: { value: null, units: 'inst' },
        target: { value: null, units: '', type: '' },
        range: { value: null, units: 'ft' },
        uses: { value: null, max: '', per: null },
        consume: { type: '', target: null, amount: null },
        ability: null,
        actionType: spell.attackRoll ? 'rsak' : (spell.savingThrow ? 'save' : null),
        chatFlavor: '',
        critical: { threshold: null, damage: null },
        damage: spell.damage ? {
          parts: [[spell.damage.diceExpression, spell.damage.damageType]],
          versatile: ''
        } : { parts: [], versatile: '' },
        formula: '',
        save: spell.savingThrow ? {
          ability: spell.savingThrow.ability.toLowerCase(),
          dc: null,
          scaling: 'spell'
        } : { ability: '', dc: null, scaling: 'spell' },
        description: { value: spell.description }
      }
    }));

    return JSON.stringify({ spells: foundrySpells }, null, 2);
  }

  private exportAsRoll20(collection: SpellCollection, spells: SRDSpell[]): string {
    // Roll20 macro format
    let output = `!spell-import --name "${collection.name}"\n\n`;

    spells.forEach(spell => {
      output += `/w gm &{template:spell} {{name=${spell.name}}} {{level=${spell.level}}} `;
      output += `{{school=${spell.school}}} {{casttime=${spell.castingTime}}} `;
      output += `{{range=${spell.range}}} {{duration=${spell.duration}}} `;
      output += `{{components=${spell.components.join(', ')}}} `;
      output += `{{description=${spell.description}}}\n`;
    });

    return output;
  }

  private exportAsDnDBeyond(collection: SpellCollection, spells: SRDSpell[]): string {
    // D&D Beyond homebrew format (simplified)
    const dndbSpells = spells.map(spell => ({
      name: spell.name,
      level: spell.level,
      school: spell.school,
      castingTime: spell.castingTime,
      range: spell.range,
      duration: spell.duration,
      components: spell.components.join(', '),
      classes: spell.classes,
      description: spell.description,
      source: spell.source || 'Homebrew Collection'
    }));

    return JSON.stringify({
      name: collection.name,
      description: collection.description,
      spells: dndbSpells
    }, null, 2);
  }

  private parseJsonImport(data: string): ExportedSpellCollection {
    return JSON.parse(data);
  }

  private parseCsvImport(data: string): ExportedSpellCollection {
    const lines = data.split('\n');
    const headers = lines[0].split(',').map(h => h.replace(/"/g, ''));
    
    const spells: SRDSpell[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.replace(/"/g, ''));
      if (values.length >= headers.length) {
        // Basic spell creation from CSV (simplified)
        spells.push({
          id: values[0].toLowerCase().replace(/\s+/g, ''),
          name: values[0],
          level: parseInt(values[1]) || 0,
          school: values[2] as any,
          castingTime: values[3],
          range: values[4],
          duration: values[5],
          components: values[6].split(', ') as any,
          description: values[8] || '',
          classes: values[7].split(', '),
          concentration: false,
          ritual: false,
          source: 'Imported',
          tags: ['imported']
        } as SRDSpell);
      }
    }

    return {
      id: this.generateId(),
      name: 'Imported Collection',
      description: 'Collection imported from CSV',
      spellIds: spells.map(s => s.id),
      tags: ['imported'],
      createdAt: new Date(),
      updatedAt: new Date(),
      version: '1.0.0',
      spells
    };
  }

  private parseFoundryImport(data: string): ExportedSpellCollection {
    const foundryData = JSON.parse(data);
    
    const spells: SRDSpell[] = foundryData.spells?.map((spell: any) => ({
      id: spell.name.toLowerCase().replace(/\s+/g, ''),
      name: spell.name,
      level: spell.data.level || 0,
      school: spell.data.school || 'evocation',
      castingTime: '1 action', // Default
      range: '30 feet', // Default
      duration: 'Instantaneous', // Default
      components: [
        spell.data.components?.vocal ? 'V' : '',
        spell.data.components?.somatic ? 'S' : '',
        spell.data.components?.material ? 'M' : ''
      ].filter(Boolean) as any,
      description: spell.data.description?.value || '',
      concentration: false,
      ritual: false,
      classes: [], // Would need to be inferred or provided
      source: 'Foundry VTT Import',
      tags: ['foundry-import']
    } as SRDSpell)) || [];

    return {
      id: this.generateId(),
      name: foundryData.name || 'Foundry Import',
      description: 'Collection imported from Foundry VTT',
      spellIds: spells.map(s => s.id),
      tags: ['foundry-import'],
      createdAt: new Date(),
      updatedAt: new Date(),
      version: '1.0.0',
      spells
    };
  }
}

// Export singleton instance
export const _spellCollectionManager = new SpellCollectionManager();
