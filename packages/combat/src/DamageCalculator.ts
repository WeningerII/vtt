/**
 * Damage Calculator
 * Handles complex damage calculations, resistances, vulnerabilities, and immunities
 */

export interface DamageResistance {
  type: string;
  value: number | 'immunity' | 'resistance' | 'vulnerability';
  conditions?: string[]; // Optional conditions when resistance applies
}

export interface DamageInstance {
  amount: number;
  type: string;
  source: string;
  isCritical?: boolean;
  ignoresResistance?: boolean;
  piercing?: number; // Amount that bypasses armor
}

export interface DamageResult {
  totalDamage: number;
  damageByType: Record<string, number>;
  resistanceApplied: Record<string, number>;
  immunityBlocked: Record<string, number>;
  vulnerabilityAdded: Record<string, number>;
  modifications: DamageModification[];
}

export interface DamageModification {
  type: 'resistance' | 'immunity' | 'vulnerability' | 'reduction' | 'absorption';
  damageType: string;
  amount: number;
  source: string;
}

export interface CreatureDefenses {
  armorClass: number;
  hitPoints: {
    current: number;
    maximum: number;
    temporary: number;
  };
  resistances: DamageResistance[];
  conditions: string[];
  specialAbilities: string[];
}

export class DamageCalculator {
  // Standard D&D 5e damage types
  private static readonly DAMAGE_TYPES = [
    'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning',
    'necrotic', 'piercing', 'poison', 'psychic', 'radiant',
    'slashing', 'thunder'
  ];

  // Physical damage types (affected by some resistances differently)
  private static readonly PHYSICAL_DAMAGE = ['bludgeoning', 'piercing', 'slashing'];

  /**
   * Calculate damage against a target
   */
  static calculateDamage(
    damageInstances: DamageInstance[],
    targetDefenses: CreatureDefenses
  ): DamageResult {
    const result: DamageResult = {
      totalDamage: 0,
      damageByType: Record<string, any>,
      resistanceApplied: Record<string, any>,
      immunityBlocked: Record<string, any>,
      vulnerabilityAdded: Record<string, any>,
      modifications: []
    };

    for (const damage of damageInstances) {
      const processedDamage = this.processDamageInstance(damage, targetDefenses);
      
      // Add to totals
      result.totalDamage += processedDamage.finalAmount;
      result.damageByType[damage.type] = (result.damageByType[damage.type] || 0) + processedDamage.finalAmount;
      
      // Track modifications
      result.modifications.push(...processedDamage.modifications);
      
      // Update resistance/immunity/vulnerability tracking
      if (processedDamage.resistanceReduction > 0) {
        result.resistanceApplied[damage.type] = (result.resistanceApplied[damage.type] || 0) + processedDamage.resistanceReduction;
      }
      
      if (processedDamage.immunityBlocked > 0) {
        result.immunityBlocked[damage.type] = (result.immunityBlocked[damage.type] || 0) + processedDamage.immunityBlocked;
      }
      
      if (processedDamage.vulnerabilityAdded > 0) {
        result.vulnerabilityAdded[damage.type] = (result.vulnerabilityAdded[damage.type] || 0) + processedDamage.vulnerabilityAdded;
      }
    }

    return result;
  }

  private static processDamageInstance(
    damage: DamageInstance,
    defenses: CreatureDefenses
  ): {
    finalAmount: number;
    resistanceReduction: number;
    immunityBlocked: number;
    vulnerabilityAdded: number;
    modifications: DamageModification[];
  } {
    let currentAmount = damage.amount;
    const modifications: DamageModification[] = [];
    let resistanceReduction = 0;
    let immunityBlocked = 0;
    let vulnerabilityAdded = 0;

    // Skip resistance processing if damage ignores resistance
    if (!damage.ignoresResistance) {
      // Find applicable resistances
      const applicableResistances = defenses.resistances.filter(resistance => 
        this.resistanceApplies(resistance, damage, defenses.conditions)
      );

      for (const resistance of applicableResistances) {
        const damageModification = this.applyResistance(resistance, currentAmount, damage.type, damage.source);
        
        if (damageModification.amount !== 0) {
          modifications.push(damageModification);
          
          switch (damageModification.type) {
            case 'resistance': {
              const reduction = currentAmount - Math.floor(currentAmount / 2);
              resistanceReduction += reduction;
              currentAmount = Math.floor(currentAmount / 2);
    }
              break;
            
            case 'immunity':
              immunityBlocked += currentAmount;
              currentAmount = 0;
              break;
            
            case 'vulnerability': {
              const addition = currentAmount;
              vulnerabilityAdded += addition;
              currentAmount *= 2;
    }
              break;
            
            case 'reduction': {
              const flatReduction = Math.min(currentAmount, damageModification.amount);
              resistanceReduction += flatReduction;
              currentAmount = Math.max(0, currentAmount - damageModification.amount);
    }
              break;
            
            case 'absorption': {
              const absorbed = Math.min(currentAmount, damageModification.amount);
              resistanceReduction += absorbed;
              currentAmount = Math.max(0, currentAmount - absorbed);
              // Note: Absorption might heal the target instead
    }
              break;
          }
        }
      }
    }

    // Apply special condition effects
    currentAmount = this.applyConditionEffects(currentAmount, damage, defenses.conditions);

    return {
      finalAmount: Math.max(0, currentAmount),
      resistanceReduction,
      immunityBlocked,
      vulnerabilityAdded,
      modifications
    };
  }

  private static resistanceApplies(
    resistance: DamageResistance,
    damage: DamageInstance,
    conditions: string[]
  ): boolean {
    // Check if damage type matches
    if (resistance.type !== damage.type && resistance.type !== 'all') {
      // Special case for nonmagical physical damage
      if (resistance.type === 'nonmagical_physical') {
        return this.PHYSICAL_DAMAGE.includes(damage.type) && 
               !damage.source.toLowerCase().includes('magical');
      }
      return false;
    }

    // Check if conditions are met
    if (resistance.conditions && resistance.conditions.length > 0) {
      return resistance.conditions.some(condition => conditions.includes(condition));
    }

    return true;
  }

  private static applyResistance(
    resistance: DamageResistance,
    damage: number,
    damageType: string,
    source: string
  ): DamageModification {
    switch (resistance.value) {
      case 'immunity':
        return {
          type: 'immunity',
          damageType,
          amount: damage,
          source: `Immunity to ${damageType}`
        };
      
      case 'resistance':
        return {
          type: 'resistance',
          damageType,
          amount: Math.floor(damage / 2),
          source: `Resistance to ${damageType}`
        };
      
      case 'vulnerability':
        return {
          type: 'vulnerability',
          damageType,
          amount: damage,
          source: `Vulnerability to ${damageType}`
        };
      
      default:
        // Numeric value - flat reduction or absorption
        if (typeof resistance.value === 'number') {
          return {
            type: resistance.value > 0 ? 'reduction' : 'absorption',
            damageType,
            amount: Math.abs(resistance.value),
            source: `${resistance.value > 0 ? 'Damage reduction' : 'Damage absorption'} (${Math.abs(resistance.value)})`
          };
        }
        
        return {
          type: 'reduction',
          damageType,
          amount: 0,
          source: 'No effect'
        };
    }
  }

  private static applyConditionEffects(
    damage: number,
    damageInstance: DamageInstance,
    conditions: string[]
  ): number {
    let modifiedDamage = damage;

    // Bear totem barbarian rage resistance to all damage except psychic
    if (conditions.includes('rage_bear') && damageInstance.type !== 'psychic') {
      modifiedDamage = Math.floor(modifiedDamage / 2);
    }

    // Heavy armor master feat
    if (conditions.includes('heavy_armor_master') && this.PHYSICAL_DAMAGE.includes(damageInstance.type)) {
      modifiedDamage = Math.max(0, modifiedDamage - 3);
    }

    // Uncanny dodge (rogue)
    if (conditions.includes('uncanny_dodge')) {
      modifiedDamage = Math.floor(modifiedDamage / 2);
    }

    return modifiedDamage;
  }

  /**
   * Calculate healing amount
   */
  static calculateHealing(
    healingAmount: number,
    target: CreatureDefenses,
    source: string = 'unknown'
  ): {
    effectiveHealing: number;
    overflow: number;
    blocked: boolean;
    modifications: string[];
  } {
    const modifications: string[] = [];
    let effectiveHealing = healingAmount;
    let blocked = false;

    // Check for healing immunity/resistance
    if (target.conditions.includes('undead') && source.includes('positive energy')) {
      blocked = true;
      effectiveHealing = 0;
      modifications.push('Undead immunity to positive energy healing');
    }

    // Check for healing reversal (undead taking positive energy damage)
    if (target.conditions.includes('undead') && source.includes('cure')) {
      // Convert healing to damage for undead
      blocked = true;
      effectiveHealing = -healingAmount; // Negative indicates damage
      modifications.push('Healing converted to damage (undead)');
    }

    // Calculate overflow
    const maxPossibleHealing = target.hitPoints.maximum - target.hitPoints.current;
    const overflow = Math.max(0, effectiveHealing - maxPossibleHealing);

    if (effectiveHealing > 0) {
      effectiveHealing = Math.min(effectiveHealing, maxPossibleHealing);
    }

    return {
      effectiveHealing,
      overflow,
      blocked,
      modifications
    };
  }

  /**
   * Calculate critical hit damage
   */
  static calculateCriticalHit(
    baseDamage: DamageInstance,
    criticalMultiplier: number = 2,
    extraDice?: string
  ): DamageInstance {
    let criticalAmount = baseDamage.amount;

    // Double dice damage only (not static modifiers)
    // This is a simplified approach - ideally would track dice vs modifiers separately
    if (criticalMultiplier === 2) {
      // Estimate: assume roughly half the damage is from dice
      const estimatedDiceAmount = Math.floor(baseDamage.amount * 0.6);
      criticalAmount = baseDamage.amount + estimatedDiceAmount;
    } else {
      criticalAmount *= criticalMultiplier;
    }

    // Add extra critical dice if specified
    if (extraDice) {
      const extraDamage = this.rollDice(extraDice);
      criticalAmount += extraDamage;
    }

    return {
      ...baseDamage,
      amount: criticalAmount,
      isCritical: true
    };
  }

  /**
   * Simple dice rolling utility
   */
  private static rollDice(diceNotation: string): number {
    // Parse dice notation like "2d6" or "1d8+3"
    const match = diceNotation.match(/(\d+)d(\d+)(?:\+(\d+))?/);
    if (!match) return 0;

    const numDice = parseInt(match[1] || '1');
    const diceSides = parseInt(match[2] || '6');
    const modifier = parseInt(match[3] || '0') || 0;

    let total = 0;
    for (let i = 0; i < numDice; i++) {
      total += Math.floor(Math.random() * diceSides) + 1;
    }

    return total + modifier;
  }

  /**
   * Get damage type color for UI display
   */
  static getDamageTypeColor(damageType: string): string {
    const colors: Record<string, string> = {
      'acid': '#9ACD32',
      'bludgeoning': '#8B4513',
      'cold': '#87CEEB',
      'fire': '#FF4500',
      'force': '#9370DB',
      'lightning': '#FFD700',
      'necrotic': '#2F4F2F',
      'piercing': '#CD853F',
      'poison': '#32CD32',
      'psychic': '#FF69B4',
      'radiant': '#FFFFE0',
      'slashing': '#DC143C',
      'thunder': '#4169E1'
    };

    return colors[damageType] || '#808080';
  }

  /**
   * Get damage severity description
   */
  static getDamageSeverity(damage: number, maxHp: number): {
    level: 'minimal' | 'light' | 'moderate' | 'heavy' | 'severe' | 'massive';
    description: string;
  } {
    const percentage = (damage / maxHp) * 100;

    if (percentage < 5) {
      return { level: 'minimal', description: 'barely scratched' };
    } else if (percentage < 15) {
      return { level: 'light', description: 'lightly wounded' };
    } else if (percentage < 30) {
      return { level: 'moderate', description: 'moderately injured' };
    } else if (percentage < 50) {
      return { level: 'heavy', description: 'heavily damaged' };
    } else if (percentage < 75) {
      return { level: 'severe', description: 'severely wounded' };
    } else {
      return { level: 'massive', description: 'catastrophically injured' };
    }
  }

  /**
   * Validate damage type
   */
  static isValidDamageType(damageType: string): boolean {
    return this.DAMAGE_TYPES.includes(damageType.toLowerCase());
  }

  /**
   * Get all damage types
   */
  static getAllDamageTypes(): string[] {
    return [...this.DAMAGE_TYPES];
  }

  /**
   * Check if damage type is physical
   */
  static isPhysicalDamage(damageType: string): boolean {
    return this.PHYSICAL_DAMAGE.includes(damageType.toLowerCase());
  }
}
