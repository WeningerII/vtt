/**
 * 5e SRD Class Features Parity Verification
 * Ensures complete implementation and machine-readable consistency
 */

import { classRegistry, SRD_CLASSES, ClassMetadata } from '../classes/index';
import { BaseClass, ClassFeature } from '../classes/base/BaseClass';

interface ParityReport {
  className: string;
  implemented: boolean;
  coreFeatureCount: number;
  subclassFeatureCount: number;
  levelCoverage: number[];
  missingLevels: number[];
  structureValid: boolean;
  issues: string[];
}

export class ClassParityVerifier {
  
  /**
   * Verify complete SRD parity across all 12 classes
   */
  public verifyCompleteParity(): {
    overallParity: boolean;
    classReports: ParityReport[];
    summary: {
      totalClasses: number;
      implementedClasses: number;
      missingClasses: string[];
      totalFeatures: number;
      averageFeatureCompliance: number;
    }
  } {
    const classReports: ParityReport[] = [];
    let totalFeatures = 0;
    let totalCompliance = 0;
    
    // Verify each SRD class
    for (const [className, metadata] of Object.entries(SRD_CLASSES)) {
      const report = this.verifyClassParity(className, metadata);
      classReports.push(report);
      
      if (report.implemented) {
        totalFeatures += report.coreFeatureCount + report.subclassFeatureCount;
        totalCompliance += report.structureValid ? 1 : 0;
      }
    }
    
    const implementedClasses = classReports.filter(r => r.implemented);
    const missingClasses = classReports.filter(r => !r.implemented).map(r => r.className);
    
    return {
      overallParity: missingClasses.length === 0 && classReports.every(r => r.structureValid),
      classReports,
      summary: {
        totalClasses: Object.keys(SRD_CLASSES).length,
        implementedClasses: implementedClasses.length,
        missingClasses,
        totalFeatures,
        averageFeatureCompliance: implementedClasses.length > 0 ? totalCompliance / implementedClasses.length : 0
      }
    };
  }
  
  /**
   * Verify individual class parity
   */
  private verifyClassParity(className: string, metadata: ClassMetadata): ParityReport {
    const report: ParityReport = {
      className,
      implemented: metadata.implemented,
      coreFeatureCount: 0,
      subclassFeatureCount: 0,
      levelCoverage: [],
      missingLevels: [],
      structureValid: true,
      issues: []
    };
    
    if (!metadata.implemented) {
      report.issues.push("Class not implemented");
      report.structureValid = false;
      return report;
    }
    
    try {
      // Get class features through modular registry
      const features = classRegistry.getClassFeatures(className, 20, metadata.srdSubclass);
      
      // Validate feature structure
      this.validateFeatureStructure(features, report);
      
      // Analyze level coverage
      this.analyzeLevelCoverage(features, report);
      
      // Count features by source
      const coreFeatures = features.filter(f => f.source === 'core');
      const subclassFeatures = features.filter(f => f.source === 'subclass');
      
      report.coreFeatureCount = coreFeatures.length;
      report.subclassFeatureCount = subclassFeatures.length;
      
      // Validate minimum expected features
      this.validateMinimumFeatures(className, report);
      
    } catch (error) {
      report.issues.push(`Error retrieving features: ${error}`);
      report.structureValid = false;
    }
    
    return report;
  }
  
  /**
   * Validate feature structure consistency
   */
  private validateFeatureStructure(features: ClassFeature[], report: ParityReport): void {
    for (const feature of features) {
      // Required fields
      if (!feature.id || !feature.name || !feature.className || !feature.description) {
        report.issues.push(`Feature missing required fields: ${feature.id || 'unnamed'}`);
        report.structureValid = false;
      }
      
      // Valid type
      if (!['passive', 'active', 'reaction', 'triggered'].includes(feature.type)) {
        report.issues.push(`Invalid feature type: ${feature.type} in ${feature.id}`);
        report.structureValid = false;
      }
      
      // Valid source
      if (!['core', 'subclass'].includes(feature.source)) {
        report.issues.push(`Invalid feature source: ${feature.source} in ${feature.id}`);
        report.structureValid = false;
      }
      
      // Level validation
      if (feature.level < 1 || feature.level > 20) {
        report.issues.push(`Invalid feature level: ${feature.level} in ${feature.id}`);
        report.structureValid = false;
      }
      
      // Uses validation
      if (feature.uses) {
        if (!['per_short_rest', 'per_long_rest', 'per_day', 'charges'].includes(feature.uses.type)) {
          report.issues.push(`Invalid uses type: ${feature.uses.type} in ${feature.id}`);
          report.structureValid = false;
        }
        
        if (feature.uses.amount < 0 || feature.uses.current < 0) {
          report.issues.push(`Invalid uses amount/current in ${feature.id}`);
          report.structureValid = false;
        }
      }
      
      // Effects validation
      if (!feature.effects || feature.effects.length === 0) {
        report.issues.push(`Feature missing effects: ${feature.id}`);
        report.structureValid = false;
      }
    }
  }
  
  /**
   * Analyze level coverage for comprehensive class progression
   */
  private analyzeLevelCoverage(features: ClassFeature[], report: ParityReport): void {
    const levelsCovered = new Set<number>();
    
    for (const feature of features) {
      levelsCovered.add(feature.level);
    }
    
    report.levelCoverage = Array.from(levelsCovered).sort((a, b) => a - b);
    
    // Expected key levels for all classes
    const keyLevels = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
    
    // Find missing critical levels (1, 3, 5, etc.)
    const criticalLevels = [1, 3, 5, 11, 17, 20]; // ASI and major feature levels
    
    for (const level of criticalLevels) {
      if (!levelsCovered.has(level)) {
        report.missingLevels.push(level);
        report.issues.push(`Missing features at critical level: ${level}`);
      }
    }
  }
  
  /**
   * Validate minimum expected features per class
   */
  private validateMinimumFeatures(className: string, report: ParityReport): void {
    const minimumExpected = {
      // Core features expected for each class type
      spellcaster: 6, // Classes like Wizard, Cleric, Druid
      halfCaster: 5,  // Classes like Paladin, Ranger
      martial: 4,     // Classes like Fighter, Barbarian, Rogue, Monk
      warlock: 5      // Special case for Warlock
    };
    
    // Classify classes by type
    const classTypes: Record<string, keyof typeof minimumExpected> = {
      'wizard': 'spellcaster',
      'cleric': 'spellcaster',
      'druid': 'spellcaster',
      'sorcerer': 'spellcaster',
      'bard': 'spellcaster',
      'paladin': 'halfCaster',
      'ranger': 'halfCaster',
      'fighter': 'martial',
      'barbarian': 'martial',
      'rogue': 'martial',
      'monk': 'martial',
      'warlock': 'warlock'
    };
    
    const classType = classTypes[className];
    if (!classType) {
      report.issues.push(`Unknown class type for: ${className}`);
      return;
    }
    const minFeatures = minimumExpected[classType];
    
    if (report.coreFeatureCount < minFeatures) {
      report.issues.push(`Insufficient core features: ${report.coreFeatureCount} < ${minFeatures} expected`);
      report.structureValid = false;
    }
    
    // All classes should have at least 2 subclass features
    if (report.subclassFeatureCount < 2) {
      report.issues.push(`Insufficient subclass features: ${report.subclassFeatureCount} < 2 expected`);
      report.structureValid = false;
    }
  }
  
  /**
   * Generate detailed parity report
   */
  public generateParityReport(): string {
    const verification = this.verifyCompleteParity();
    
    let report = "=== 5e SRD Class Features Parity Report ===\n\n";
    
    // Overall summary
    report += `Overall Parity: ${verification.overallParity ? '✅ COMPLETE' : '❌ INCOMPLETE'}\n`;
    report += `Classes Implemented: ${verification.summary.implementedClasses}/${verification.summary.totalClasses}\n`;
    report += `Total Features: ${verification.summary.totalFeatures}\n`;
    report += `Average Compliance: ${(verification.summary.averageFeatureCompliance * 100).toFixed(1)}%\n\n`;
    
    if (verification.summary.missingClasses.length > 0) {
      report += `Missing Classes: ${verification.summary.missingClasses.join(', ')}\n\n`;
    }
    
    // Individual class reports
    report += "=== Individual Class Reports ===\n\n";
    
    for (const classReport of verification.classReports) {
      const status = classReport.implemented ? 
        (classReport.structureValid ? '✅' : '⚠️') : '❌';
      
      report += `${status} ${classReport.className.toUpperCase()}\n`;
      report += `  Implemented: ${classReport.implemented}\n`;
      
      if (classReport.implemented) {
        report += `  Core Features: ${classReport.coreFeatureCount}\n`;
        report += `  Subclass Features: ${classReport.subclassFeatureCount}\n`;
        report += `  Level Coverage: ${classReport.levelCoverage.length}/20 levels\n`;
        
        if (classReport.missingLevels.length > 0) {
          report += `  Missing Critical Levels: ${classReport.missingLevels.join(', ')}\n`;
        }
        
        if (classReport.issues.length > 0) {
          report += `  Issues:\n`;
          for (const issue of classReport.issues) {
            report += `    - ${issue}\n`;
          }
        }
      }
      
      report += "\n";
    }
    
    return report;
  }
}

// Export verification instance
export const parityVerifier = new ClassParityVerifier();
