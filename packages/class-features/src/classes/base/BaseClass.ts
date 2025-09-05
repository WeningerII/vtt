/**
 * Base Class Interface for 5e SRD Classes
 * Provides standardized structure for all class implementations
 */

export interface ClassFeature {
  id: string;
  name: string;
  className: string;
  level: number;
  description: string;
  type: "passive" | "active" | "reaction" | "triggered";
  uses?: {
    type: "per_short_rest" | "per_long_rest" | "per_day" | "charges";
    amount: number;
    current: number;
    resetOn: "short_rest" | "long_rest" | "dawn";
  } | undefined;
  effects: any[];
  triggers?: any[] | undefined;
  actionCost?: "action" | "bonus_action" | "reaction" | "free" | undefined;
  scaling?: any | undefined;
  subclass?: string | undefined;
  source: "core" | "subclass";
}

export interface FeatureEffect {
  type: string;
  target?: string;
  parameters?: Record<string, any>;
  duration?: number;
  scaling?: {
    attribute: string;
    formula: string;
  };
}

export interface FeatureTrigger {
  event: string;
  condition?: string;
  priority?: number;
}

export interface SubclassInfo {
  id: string;
  name: string;
  description: string;
  source: "srd" | "expansion";
  features: Record<number, ClassFeature[]>; // level -> features
}

export abstract class BaseClass {
  abstract readonly className: string;
  abstract readonly hitDie: number;
  abstract readonly primaryAbility: string[];
  abstract readonly savingThrows: string[];
  abstract readonly skillChoices: string[];
  abstract readonly subclassName: string;
  abstract readonly subclassLevel: number;

  abstract getCoreFeatures(level: number): ClassFeature[];
  abstract getSubclassFeatures(level: number, subclass: string): ClassFeature[];
  
  getAllFeatures(level: number, subclass?: string): ClassFeature[] {
    const coreFeatures = this.getCoreFeatures(level);
    const subclassFeatures = subclass ? this.getSubclassFeatures(level, subclass) : [];
    
    return [...coreFeatures, ...subclassFeatures]
      .filter(f => f.level <= level)
      .sort((a, b) => a.level - b.level);
  }

  getFeaturesByLevel(level: number, subclass?: string): Record<number, ClassFeature[]> {
    const allFeatures = this.getAllFeatures(20, subclass);
    const featuresByLevel: Record<number, ClassFeature[]> = {};
    
    for (let i = 1; i <= level; i++) {
      featuresByLevel[i] = allFeatures.filter(f => f.level === i);
    }
    
    return featuresByLevel;
  }
}
