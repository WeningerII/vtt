/**
 * Modular Class Registry - 5e SRD Complete Implementation
 * Avoids monolithic structure while ensuring machine-readable parity
 */

import { BaseClass, ClassFeature } from './base/BaseClass';
import { BarbarianClass } from './Barbarian';
import { BardClass } from './Bard';
import { ClericClass } from './Cleric';
import { DruidClass } from './Druid';
import { FighterClass } from './Fighter';
import { MonkClass } from './Monk';
import { PaladinClass } from './Paladin';
import { RangerClass } from './Ranger';
import { RogueClass } from './Rogue';
import { SorcererClass } from './Sorcerer';
import { WarlockClass } from './Warlock';
import { WizardClass } from './Wizard';

// Import existing classes (to be refactored)
import { ClassFeaturesEngine } from '../index';

export interface ClassRegistry {
  [className: string]: BaseClass;
}

export interface ClassMetadata {
  name: string;
  hitDie: number;
  primaryAbility: string[];
  savingThrows: string[];
  skillChoices: string[];
  subclassName: string;
  subclassLevel: number;
  srdSubclass: string;
  implemented: boolean;
}

export const SRD_CLASSES: Record<string, ClassMetadata> = {
  barbarian: {
    name: "Barbarian",
    hitDie: 12,
    primaryAbility: ["strength"],
    savingThrows: ["strength", "constitution"],
    skillChoices: ["animal_handling", "athletics", "intimidation", "nature", "perception", "survival"],
    subclassName: "Primal Path",
    subclassLevel: 3,
    srdSubclass: "berserker",
    implemented: true // Legacy implementation
  },
  bard: {
    name: "Bard",
    hitDie: 8,
    primaryAbility: ["charisma"],
    savingThrows: ["dexterity", "charisma"],
    skillChoices: ["any"],
    subclassName: "College",
    subclassLevel: 3,
    srdSubclass: "lore",
    implemented: true
  },
  cleric: {
    name: "Cleric",
    hitDie: 8,
    primaryAbility: ["wisdom"],
    savingThrows: ["wisdom", "charisma"],
    skillChoices: ["history", "insight", "medicine", "persuasion", "religion"],
    subclassName: "Divine Domain",
    subclassLevel: 1,
    srdSubclass: "life",
    implemented: true // Legacy implementation
  },
  druid: {
    name: "Druid",
    hitDie: 8,
    primaryAbility: ["wisdom"],
    savingThrows: ["intelligence", "wisdom"],
    skillChoices: ["arcana", "animal_handling", "insight", "medicine", "nature", "perception", "religion", "survival"],
    subclassName: "Circle",
    subclassLevel: 2,
    srdSubclass: "land",
    implemented: true
  },
  fighter: {
    name: "Fighter",
    hitDie: 10,
    primaryAbility: ["strength", "dexterity"],
    savingThrows: ["strength", "constitution"],
    skillChoices: ["acrobatics", "animal_handling", "athletics", "history", "insight", "intimidation", "perception", "survival"],
    subclassName: "Martial Archetype",
    subclassLevel: 3,
    srdSubclass: "champion",
    implemented: true // Legacy implementation
  },
  monk: {
    name: "Monk",
    hitDie: 8,
    primaryAbility: ["dexterity", "wisdom"],
    savingThrows: ["strength", "dexterity"],
    skillChoices: ["acrobatics", "athletics", "history", "insight", "religion", "stealth"],
    subclassName: "Monastic Tradition",
    subclassLevel: 3,
    srdSubclass: "open_hand",
    implemented: true
  },
  paladin: {
    name: "Paladin",
    hitDie: 10,
    primaryAbility: ["strength", "charisma"],
    savingThrows: ["wisdom", "charisma"],
    skillChoices: ["athletics", "insight", "intimidation", "medicine", "persuasion", "religion"],
    subclassName: "Sacred Oath",
    subclassLevel: 3,
    srdSubclass: "devotion",
    implemented: true
  },
  ranger: {
    name: "Ranger",
    hitDie: 10,
    primaryAbility: ["dexterity", "wisdom"],
    savingThrows: ["strength", "dexterity"],
    skillChoices: ["animal_handling", "athletics", "insight", "investigation", "nature", "perception", "stealth", "survival"],
    subclassName: "Ranger Archetype",
    subclassLevel: 3,
    srdSubclass: "hunter",
    implemented: true
  },
  rogue: {
    name: "Rogue",
    hitDie: 8,
    primaryAbility: ["dexterity"],
    savingThrows: ["dexterity", "intelligence"],
    skillChoices: ["acrobatics", "athletics", "deception", "insight", "intimidation", "investigation", "perception", "performance", "persuasion", "sleight_of_hand", "stealth"],
    subclassName: "Roguish Archetype",
    subclassLevel: 3,
    srdSubclass: "thief",
    implemented: true // Legacy implementation
  },
  sorcerer: {
    name: "Sorcerer",
    hitDie: 6,
    primaryAbility: ["charisma"],
    savingThrows: ["constitution", "charisma"],
    skillChoices: ["arcana", "deception", "insight", "intimidation", "persuasion", "religion"],
    subclassName: "Sorcerous Origin",
    subclassLevel: 1,
    srdSubclass: "draconic",
    implemented: true
  },
  warlock: {
    name: "Warlock",
    hitDie: 8,
    primaryAbility: ["charisma"],
    savingThrows: ["wisdom", "charisma"],
    skillChoices: ["arcana", "deception", "history", "intimidation", "investigation", "nature", "religion"],
    subclassName: "Otherworldly Patron",
    subclassLevel: 1,
    srdSubclass: "fiend",
    implemented: true
  },
  wizard: {
    name: "Wizard",
    hitDie: 6,
    primaryAbility: ["intelligence"],
    savingThrows: ["intelligence", "wisdom"],
    skillChoices: ["arcana", "history", "insight", "investigation", "medicine", "religion"],
    subclassName: "Arcane Tradition",
    subclassLevel: 2,
    srdSubclass: "evocation",
    implemented: true // Legacy implementation
  }
};

export class ModularClassRegistry {
  private classes: ClassRegistry = {};
  private legacyEngine: ClassFeaturesEngine;

  constructor() {
    this.legacyEngine = new ClassFeaturesEngine();
    this.initializeClasses();
  }

  private initializeClasses(): void {
    // Initialize class instances
    const classInstances: ClassRegistry = {
      barbarian: new BarbarianClass(),
      bard: new BardClass(),
      cleric: new ClericClass(),
      druid: new DruidClass(),
      fighter: new FighterClass(),
      monk: new MonkClass(),
      paladin: new PaladinClass(),
      ranger: new RangerClass(),
      rogue: new RogueClass(),
      sorcerer: new SorcererClass(),
      warlock: new WarlockClass(),
      wizard: new WizardClass()
    };
    this.classes = classInstances;
  }

  /**
   * Get all features for a class at given level
   */
  getClassFeatures(className: string, level: number, subclass?: string): ClassFeature[] {
    const normalizedClassName = className.toLowerCase();
    
    // Use new modular implementation if available
    if (this.classes[normalizedClassName]) {
      const defaultSubclass = subclass || SRD_CLASSES[normalizedClassName]?.srdSubclass;
      return this.classes[normalizedClassName].getAllFeatures(level, defaultSubclass);
    }
    
    // Fall back to legacy implementation - return empty array for now
    // TODO: Integrate with legacy engine properly
    return [];
  }

  /**
   * Get features organized by level
   */
  getFeaturesByLevel(className: string, level: number, subclass?: string): Record<number, ClassFeature[]> {
    const normalizedClassName = className.toLowerCase();
    
    if (this.classes[normalizedClassName]) {
      const defaultSubclass = subclass || SRD_CLASSES[normalizedClassName]?.srdSubclass;
      return this.classes[normalizedClassName].getFeaturesByLevel(level, defaultSubclass);
    }
    
    // Legacy fallback - TODO: Integrate properly
    const features: ClassFeature[] = [];
    const featuresByLevel: Record<number, ClassFeature[]> = {};
    
    for (let i = 1; i <= level; i++) {
      featuresByLevel[i] = features.filter(f => f.level === i);
    }
    
    return featuresByLevel;
  }

  /**
   * Get class metadata
   */
  getClassMetadata(className: string): ClassMetadata | null {
    const normalizedClassName = className.toLowerCase();
    return SRD_CLASSES[normalizedClassName] || null;
  }

  /**
   * Get all implemented classes
   */
  getImplementedClasses(): string[] {
    return Object.keys(SRD_CLASSES).filter(className => {
      const classData = SRD_CLASSES[className];
      return classData && classData.implemented;
    });
  }

  /**
   * Check if class has parity with SRD
   */
  hasCompleteParity(): boolean {
    return Object.values(SRD_CLASSES).every(meta => meta.implemented);
  }

  /**
   * Get implementation status report
   */
  getImplementationStatus(): {
    total: number;
    implemented: number;
    missing: string[];
    complete: boolean;
  } {
    const total = Object.keys(SRD_CLASSES).length;
    const implemented = Object.values(SRD_CLASSES).filter(meta => meta.implemented).length;
    const missing = Object.keys(SRD_CLASSES).filter(className => {
      const classData = SRD_CLASSES[className];
      return classData && !classData.implemented;
    });
    
    return {
      total,
      implemented,
      missing,
      complete: implemented === total
    };
  }
}

// Export singleton instance
export const classRegistry = new ModularClassRegistry();
