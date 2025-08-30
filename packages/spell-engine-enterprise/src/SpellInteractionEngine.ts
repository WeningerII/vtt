/**
 * Enterprise Spell Interaction & Combination System
 * Handles complex spell interactions, combinations, and emergent behaviors
 */

import { EventEmitter } from 'events';

export class SpellInteractionEngine extends EventEmitter {
  private activeSpells = new Map<string, ActiveSpell>();
  private interactionRules = new Map<string, InteractionRule[]>();
  private combinationMatrix = new Map<string, CombinationEffect>();
  private spatialIndex: SpatialIndex;
  private temporalTracker: TemporalTracker;

  constructor() {
    super();
    this.spatialIndex = new SpatialIndex();
    this.temporalTracker = new TemporalTracker();
    this.initializeInteractionRules();
    this.initializeCombinationMatrix();
  }

  private initializeInteractionRules(): void {
    // Elemental interaction rules
    this.addInteractionRule('fire', 'ice', {
      type: 'neutralization',
      priority: 10,
      effect: 'steam_explosion',
      magnitude: 1.5,
      radius: 3.0
    });

    this.addInteractionRule('fire', 'water', {
      type: 'neutralization',
      priority: 8,
      effect: 'steam_cloud',
      magnitude: 1.2,
      radius: 2.5
    });

    this.addInteractionRule('lightning', 'water', {
      type: 'amplification',
      priority: 9,
      effect: 'chain_lightning',
      magnitude: 2.0,
      radius: 5.0
    });

    this.addInteractionRule('fire', 'poison', {
      type: 'transformation',
      priority: 7,
      effect: 'toxic_flames',
      magnitude: 1.8,
      radius: 4.0
    });

    this.addInteractionRule('ice', 'earth', {
      type: 'enhancement',
      priority: 6,
      effect: 'crystal_spikes',
      magnitude: 1.3,
      radius: 3.5
    });

    // School-based interactions
    this.addInteractionRule('enchantment', 'illusion', {
      type: 'synergy',
      priority: 8,
      effect: 'enhanced_deception',
      magnitude: 1.4,
      radius: 0
    });

    this.addInteractionRule('necromancy', 'evocation', {
      type: 'corruption',
      priority: 9,
      effect: 'death_magic_amplification',
      magnitude: 2.2,
      radius: 6.0
    });

    // Concentration spell interactions
    this.addInteractionRule('concentration', 'concentration', {
      type: 'conflict',
      priority: 10,
      effect: 'concentration_break',
      magnitude: 0,
      radius: 0
    });
  }

  private initializeCombinationMatrix(): void {
    // Fire + Ice combinations
    this.setCombination(['fire', 'ice'], {
      resultType: 'steam_explosion',
      damageMultiplier: 1.5,
      areaMultiplier: 2.0,
      duration: 3000,
      secondaryEffects: ['visibility_reduction', 'heat_damage']
    });

    // Lightning + Water combinations
    this.setCombination(['lightning', 'water'], {
      resultType: 'electrified_water',
      damageMultiplier: 2.0,
      areaMultiplier: 1.5,
      duration: 5000,
      secondaryEffects: ['paralysis', 'chain_reaction']
    });

    // Multiple element combinations
    this.setCombination(['fire', 'earth', 'air'], {
      resultType: 'volcanic_eruption',
      damageMultiplier: 3.0,
      areaMultiplier: 4.0,
      duration: 10000,
      secondaryEffects: ['lava_flow', 'ash_cloud', 'seismic_activity']
    });

    // Utility spell combinations
    this.setCombination(['mage_hand', 'minor_illusion'], {
      resultType: 'phantom_manipulation',
      damageMultiplier: 0,
      areaMultiplier: 1.0,
      duration: 60000,
      secondaryEffects: ['invisible_interaction', 'enhanced_stealth']
    });
  }

  async registerSpell(spell: SpellEffect, caster: any, position: Vector3): Promise<string> {
    const activeSpell: ActiveSpell = {
      id: crypto.randomUUID(),
      spell,
      caster,
      position,
      startTime: Date.now(),
      lastUpdate: Date.now(),
      spatialBounds: this.calculateSpellBounds(spell, position),
      interactionHistory: []
    };

    this.activeSpells.set(activeSpell.id, activeSpell);
    this.spatialIndex.insert(activeSpell);
    this.temporalTracker.track(activeSpell);

    // Check for immediate interactions
    await this.checkForInteractions(activeSpell);

    this.emit('spell_registered', activeSpell);
    return activeSpell.id;
  }

  async processInteractions(): Promise<InteractionResult[]> {
    const results: InteractionResult[] = [];
    const processedPairs = new Set<string>();

    for (const [_id1, spell1] of this.activeSpells) {
      const nearbySpells = this.spatialIndex.query(spell1.spatialBounds);
      
      for (const spell2 of nearbySpells) {
        if (spell1.id === spell2.id) continue;
        
        const pairKey = [spell1.id, spell2.id].sort().join(':');
        if (processedPairs.has(pairKey)) continue;
        processedPairs.add(pairKey);

        const interaction = await this.evaluateInteraction(spell1, spell2);
        if (interaction) {
          results.push(interaction);
          await this.executeInteraction(interaction);
        }
      }
    }

    return results;
  }

  private async evaluateInteraction(spell1: ActiveSpell, spell2: ActiveSpell): Promise<InteractionResult | null> {
    // Check spatial proximity
    const distance = this.calculateDistance(spell1.position, spell2.position);
    const maxInteractionRange = Math.max(
      this.getSpellRadius(spell1.spell),
      this.getSpellRadius(spell2.spell)
    ) + 5.0; // 5-foot interaction buffer

    if (distance > maxInteractionRange) return null;

    // Check temporal compatibility
    if (!this.temporalTracker.areTemporallyCompatible(spell1, spell2)) return null;

    // Find applicable interaction rules
    const rules = this.findInteractionRules(spell1.spell, spell2.spell);
    if (rules.length === 0) return null;

    // Select highest priority rule
    const rule = rules.sort((_a, _b) => b.priority - a.priority)[0];

    // Calculate interaction strength based on overlap
    const overlapArea = this.calculateSpellOverlap(spell1, spell2);
    const interactionStrength = Math.min(1.0, overlapArea / 10.0); // Normalize to 0-1

    return {
      id: crypto.randomUUID(),
      spell1: spell1.id,
      spell2: spell2.id,
      rule,
      strength: interactionStrength,
      position: this.calculateInteractionCenter(spell1, spell2),
      timestamp: Date.now()
    };
  }

  private async executeInteraction(interaction: InteractionResult): Promise<void> {
    const spell1 = this.activeSpells.get(interaction.spell1)!;
    const spell2 = this.activeSpells.get(interaction.spell2)!;

    // Record interaction in history
    spell1.interactionHistory.push(interaction);
    spell2.interactionHistory.push(interaction);

    switch (interaction.rule.type) {
      case 'neutralization':
        await this.handleNeutralization(spell1, spell2, interaction);
        break;
      case 'amplification':
        await this.handleAmplification(spell1, spell2, interaction);
        break;
      case 'transformation':
        await this.handleTransformation(spell1, spell2, interaction);
        break;
      case 'enhancement':
        await this.handleEnhancement(spell1, spell2, interaction);
        break;
      case 'synergy':
        await this.handleSynergy(spell1, spell2, interaction);
        break;
      case 'corruption':
        await this.handleCorruption(spell1, spell2, interaction);
        break;
      case 'conflict':
        await this.handleConflict(spell1, spell2, interaction);
        break;
    }

    this.emit('interaction_executed', interaction);
  }

  private async handleNeutralization(spell1: ActiveSpell, spell2: ActiveSpell, interaction: InteractionResult): Promise<void> {
    // Create neutralization effect
    const effect = await this.createNeutralizationEffect(spell1, spell2, interaction);
    
    // Reduce or cancel both spells
    await this.reduceSpellPotency(spell1, 0.5);
    await this.reduceSpellPotency(spell2, 0.5);
    
    this.emit('neutralization_effect', effect);
  }

  private async handleAmplification(spell1: ActiveSpell, spell2: ActiveSpell, interaction: InteractionResult): Promise<void> {
    // Amplify the primary spell (usually the first one)
    const amplificationFactor = interaction.rule.magnitude * interaction.strength;
    
    await this.amplifySpell(spell1, amplificationFactor);
    
    // Secondary spell may be consumed or reduced
    if (interaction.rule.effect === 'chain_lightning') {
      await this.createChainLightningEffect(spell1, spell2, interaction);
    }
    
    this.emit('amplification_effect', { spell1, spell2, factor: amplificationFactor });
  }

  private async handleTransformation(spell1: ActiveSpell, spell2: ActiveSpell, interaction: InteractionResult): Promise<void> {
    // Transform both spells into a new combined effect
    const transformedEffect = await this.createTransformedEffect(spell1, spell2, interaction);
    
    // Remove original spells
    this.removeSpell(spell1.id);
    this.removeSpell(spell2.id);
    
    // Register new transformed spell
    await this.registerTransformedSpell(transformedEffect);
    
    this.emit('transformation_effect', transformedEffect);
  }

  private async handleEnhancement(spell1: ActiveSpell, spell2: ActiveSpell, interaction: InteractionResult): Promise<void> {
    // Enhance spell properties without changing core nature
    const enhancement = {
      duration: spell1.spell.duration * interaction.rule.magnitude,
      potency: (spell1.spell.damage?.diceExpression || '1d4') + '+' + Math.floor(interaction.strength * 10),
      radius: this.getSpellRadius(spell1.spell) * 1.2
    };
    
    await this.applyEnhancement(spell1, enhancement);
    
    this.emit('enhancement_effect', { spell: spell1, enhancement });
  }

  private async handleSynergy(spell1: ActiveSpell, spell2: ActiveSpell, interaction: InteractionResult): Promise<void> {
    // Create synergistic effects that benefit from both spells
    const synergyEffect = await this.createSynergyEffect(spell1, spell2, interaction);
    
    // Both spells continue but with enhanced properties
    await this.applySynergyBonus(spell1, synergyEffect.bonus1);
    await this.applySynergyBonus(spell2, synergyEffect.bonus2);
    
    this.emit('synergy_effect', synergyEffect);
  }

  private async handleCorruption(spell1: ActiveSpell, spell2: ActiveSpell, interaction: InteractionResult): Promise<void> {
    // Create corrupted version with enhanced but dangerous effects
    const corruptedEffect = await this.createCorruptedEffect(spell1, spell2, interaction);
    
    // Apply corruption to both spells
    await this.applyCorruption(spell1, corruptedEffect.corruption1);
    await this.applyCorruption(spell2, corruptedEffect.corruption2);
    
    this.emit('corruption_effect', corruptedEffect);
  }

  private async handleConflict(spell1: ActiveSpell, spell2: ActiveSpell, _interaction: InteractionResult): Promise<void> {
    // Handle conflicting spells (e.g., concentration conflicts)
    if (spell1.caster.id === spell2.caster.id && 
        spell1.spell.concentration && spell2.spell.concentration) {
      
      // Break concentration on older spell
      const olderSpell = spell1.startTime < spell2.startTime ? spell1 : spell2;
      await this.breakConcentration(olderSpell);
    }
    
    this.emit('conflict_resolved', { spell1, spell2, resolution: 'concentration_broken' });
  }

  async detectSpellCombinations(): Promise<CombinationDetection[]> {
    const combinations: CombinationDetection[] = [];
    const spellGroups = this.groupSpellsByProximity();

    for (const group of spellGroups) {
      if (group.length < 2) continue;

      const elementTypes = group.map(s => this.getSpellElement(s.spell));
      const combinationKey = elementTypes.sort().join(',');

      if (this.combinationMatrix.has(combinationKey)) {
        const combination = this.combinationMatrix.get(combinationKey)!;
        combinations.push({
          id: crypto.randomUUID(),
          spells: group.map(s => s.id),
          combination,
          centerPoint: this.calculateGroupCenter(group),
          detectionTime: Date.now()
        });
      }
    }

    return combinations;
  }

  async executeCombination(detection: CombinationDetection): Promise<CombinationResult> {
    const spells = detection.spells.map(id => this.activeSpells.get(id)!);
    const combination = detection.combination;

    // Calculate combined effect magnitude
    const baseDamage = spells.reduce((_sum, _spell) => {
      return sum + this.getSpellDamage(spell.spell);
    }, 0);

    const combinedDamage = baseDamage * combination.damageMultiplier;
    const combinedRadius = Math.max(...spells.map(s => this.getSpellRadius(s.spell))) * combination.areaMultiplier;

    // Create combination effect
    const result: CombinationResult = {
      id: crypto.randomUUID(),
      type: combination.resultType,
      position: detection.centerPoint,
      damage: combinedDamage,
      radius: combinedRadius,
      duration: combination.duration,
      secondaryEffects: combination.secondaryEffects,
      participatingSpells: spells.map(s => s.id)
    };

    // Remove or modify participating spells
    for (const spell of spells) {
      if (combination.damageMultiplier > 2.0) {
        // High-power combinations consume spells
        this.removeSpell(spell.id);
      } else {
        // Lower-power combinations reduce spell potency
        await this.reduceSpellPotency(spell, 0.7);
      }
    }

    this.emit('combination_executed', result);
    return result;
  }

  removeSpell(spellId: string): void {
    const spell = this.activeSpells.get(spellId);
    if (spell) {
      this.spatialIndex.remove(spell);
      this.temporalTracker.untrack(spell);
      this.activeSpells.delete(spellId);
      this.emit('spell_removed', spellId);
    }
  }

  // Utility methods
  private addInteractionRule(element1: string, element2: string, rule: InteractionRule): void {
    const key1 = `${element1}:${element2}`;
    const key2 = `${element2}:${element1}`;
    
    if (!this.interactionRules.has(key1)) this.interactionRules.set(key1, []);
    if (!this.interactionRules.has(key2)) this.interactionRules.set(key2, []);
    
    this.interactionRules.get(key1)!.push(rule);
    this.interactionRules.get(key2)!.push(rule);
  }

  private setCombination(elements: string[], effect: CombinationEffect): void {
    const key = elements.sort().join(',');
    this.combinationMatrix.set(key, effect);
  }

  private findInteractionRules(spell1: SpellEffect, spell2: SpellEffect): InteractionRule[] {
    const element1 = this.getSpellElement(spell1);
    const element2 = this.getSpellElement(spell2);
    const key = `${element1}:${element2}`;
    
    return this.interactionRules.get(key) || [];
  }

  private getSpellElement(spell: SpellEffect): string {
    if (spell.damage?.damageType) return spell.damage.damageType;
    if (spell.school) return spell.school;
    if (spell.concentration) return 'concentration';
    return 'neutral';
  }

  private calculateDistance(pos1: Vector3, pos2: Vector3): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  private getSpellRadius(spell: SpellEffect): number {
    if (spell.areaOfEffect?.radius) return spell.areaOfEffect.radius;
    if (spell.range === 'Touch') return 1.5;
    if (spell.range === 'Self') return 0;
    
    const rangeMatch = spell.range.match(/(\d+) feet/);
    return rangeMatch ? parseInt(rangeMatch[1]) : 5;
  }

  private getSpellDamage(spell: SpellEffect): number {
    if (!spell.damage?.diceExpression) return 0;
    
    const match = spell.damage.diceExpression.match(/(\d+)d(\d+)(?:\+(\d+))?/);
    if (match) {
      const numDice = parseInt(match[1]);
      const dieSize = parseInt(match[2]);
      const bonus = parseInt(match[3] || '0');
      return numDice * (dieSize / 2 + 0.5) + bonus; // Average damage
    }
    
    return 0;
  }

  private calculateSpellBounds(spell: SpellEffect, position: Vector3): BoundingBox {
    const radius = this.getSpellRadius(spell);
    return {
      min: { x: position.x - radius, y: position.y - radius, z: position.z - radius },
      max: { x: position.x + radius, y: position.y + radius, z: position.z + radius }
    };
  }

  private calculateSpellOverlap(spell1: ActiveSpell, spell2: ActiveSpell): number {
    // Simplified overlap calculation - in practice would use proper geometric intersection
    const distance = this.calculateDistance(spell1.position, spell2.position);
    const radius1 = this.getSpellRadius(spell1.spell);
    const radius2 = this.getSpellRadius(spell2.spell);
    
    if (distance >= radius1 + radius2) return 0;
    if (distance <= Math.abs(radius1 - radius2)) return Math.PI * Math.min(radius1, radius2) ** 2;
    
    // Approximate overlap for intersecting circles
    const overlap = (radius1 + radius2 - distance) / (radius1 + radius2);
    return overlap * Math.PI * Math.min(radius1, radius2) ** 2;
  }

  private calculateInteractionCenter(spell1: ActiveSpell, spell2: ActiveSpell): Vector3 {
    return {
      x: (spell1.position.x + spell2.position.x) / 2,
      y: (spell1.position.y + spell2.position.y) / 2,
      z: (spell1.position.z + spell2.position.z) / 2
    };
  }

  private groupSpellsByProximity(): ActiveSpell[][] {
    const groups: ActiveSpell[][] = [];
    const processed = new Set<string>();

    for (const [id, spell] of this.activeSpells) {
      if (processed.has(id)) continue;

      const group = [spell];
      processed.add(id);

      const nearby = this.spatialIndex.query(spell.spatialBounds);
      for (const nearbySpell of nearby) {
        if (!processed.has(nearbySpell.id) && 
            this.calculateDistance(spell.position, nearbySpell.position) <= 10) {
          group.push(nearbySpell);
          processed.add(nearbySpell.id);
        }
      }

      groups.push(group);
    }

    return groups;
  }

  private calculateGroupCenter(group: ActiveSpell[]): Vector3 {
    const sum = group.reduce((_acc, _spell) => ({
      x: acc.x + spell.position.x,
      y: acc.y + spell.position.y,
      z: acc.z + spell.position.z
    }), { x: 0, y: 0, z: 0 });

    return {
      x: sum.x / group.length,
      y: sum.y / group.length,
      z: sum.z / group.length
    };
  }

  // Placeholder implementations for effect creation methods
  private async createNeutralizationEffect(spell1: ActiveSpell, spell2: ActiveSpell, _interaction: InteractionResult): Promise<any> {
    return { type: 'neutralization', spells: [spell1.id, spell2.id] };
  }

  private async createChainLightningEffect(spell1: ActiveSpell, spell2: ActiveSpell, _interaction: InteractionResult): Promise<any> {
    return { type: 'chain_lightning', origin: spell1.id, amplifier: spell2.id };
  }

  private async createTransformedEffect(spell1: ActiveSpell, spell2: ActiveSpell, interaction: InteractionResult): Promise<any> {
    return { type: interaction.rule.effect, originalSpells: [spell1.id, spell2.id] };
  }

  private async createSynergyEffect(_spell1: ActiveSpell, _spell2: ActiveSpell, _interaction: InteractionResult): Promise<any> {
    return { 
      type: 'synergy', 
      bonus1: { potency: 1.2, duration: 1.1 },
      bonus2: { potency: 1.2, duration: 1.1 }
    };
  }

  private async createCorruptedEffect(_spell1: ActiveSpell, _spell2: ActiveSpell, _interaction: InteractionResult): Promise<any> {
    return {
      type: 'corruption',
      corruption1: { damageIncrease: 1.5, unpredictability: 0.3 },
      corruption2: { damageIncrease: 1.5, unpredictability: 0.3 }
    };
  }

  private async reduceSpellPotency(_spell: ActiveSpell, _factor: number): Promise<void> {
    // Implementation would modify spell properties
  }

  private async amplifySpell(_spell: ActiveSpell, _factor: number): Promise<void> {
    // Implementation would enhance spell properties
  }

  private async applyEnhancement(_spell: ActiveSpell, _enhancement: any): Promise<void> {
    // Implementation would apply enhancement effects
  }

  private async applySynergyBonus(_spell: ActiveSpell, _bonus: any): Promise<void> {
    // Implementation would apply synergy bonuses
  }

  private async applyCorruption(_spell: ActiveSpell, _corruption: any): Promise<void> {
    // Implementation would apply corruption effects
  }

  private async breakConcentration(spell: ActiveSpell): Promise<void> {
    this.removeSpell(spell.id);
    this.emit('concentration_broken', spell);
  }

  private async registerTransformedSpell(_effect: any): Promise<void> {
    // Implementation would register new transformed spell
  }

  private async checkForInteractions(_spell: ActiveSpell): Promise<void> {
    // Implementation would check for immediate interactions
  }
}

// Supporting classes
class SpatialIndex {
  private grid = new Map<string, ActiveSpell[]>();
  private cellSize = 10; // 10-foot grid cells

  insert(spell: ActiveSpell): void {
    const cells = this.getCells(spell.spatialBounds);
    for (const cell of cells) {
      if (!this.grid.has(cell)) this.grid.set(cell, []);
      this.grid.get(cell)!.push(spell);
    }
  }

  remove(spell: ActiveSpell): void {
    const cells = this.getCells(spell.spatialBounds);
    for (const cell of cells) {
      const spells = this.grid.get(cell);
      if (spells) {
        const index = spells.findIndex(s => s.id === spell.id);
        if (index >= 0) spells.splice(index, 1);
      }
    }
  }

  query(bounds: BoundingBox): ActiveSpell[] {
    const cells = this.getCells(bounds);
    const results = new Set<ActiveSpell>();
    
    for (const cell of cells) {
      const spells = this.grid.get(cell) || [];
      spells.forEach(spell => results.add(spell));
    }
    
    return Array.from(results);
  }

  private getCells(bounds: BoundingBox): string[] {
    const cells: string[] = [];
    const minX = Math.floor(bounds.min.x / this.cellSize);
    const maxX = Math.floor(bounds.max.x / this.cellSize);
    const minY = Math.floor(bounds.min.y / this.cellSize);
    const maxY = Math.floor(bounds.max.y / this.cellSize);
    const minZ = Math.floor(bounds.min.z / this.cellSize);
    const maxZ = Math.floor(bounds.max.z / this.cellSize);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          cells.push(`${x},${y},${z}`);
        }
      }
    }

    return cells;
  }
}

class TemporalTracker {
  private spellTimelines = new Map<string, SpellTimeline>();

  track(spell: ActiveSpell): void {
    this.spellTimelines.set(spell.id, {
      spellId: spell.id,
      startTime: spell.startTime,
      duration: this.getSpellDuration(spell.spell),
      lastInteraction: spell.startTime
    });
  }

  untrack(spell: ActiveSpell): void {
    this.spellTimelines.delete(spell.id);
  }

  areTemporallyCompatible(spell1: ActiveSpell, spell2: ActiveSpell): boolean {
    const timeline1 = this.spellTimelines.get(spell1.id);
    const timeline2 = this.spellTimelines.get(spell2.id);
    
    if (!timeline1 || !timeline2) return false;

    const now = Date.now();
    const spell1Active = now < timeline1.startTime + timeline1.duration;
    const spell2Active = now < timeline2.startTime + timeline2.duration;

    return spell1Active && spell2Active;
  }

  private getSpellDuration(spell: SpellEffect): number {
    if (spell.duration === 'Instantaneous') return 100; // 100ms for instantaneous
    if (spell.duration.includes('Concentration')) {
      const match = spell.duration.match(/(\d+) (minute|hour)/);
      if (match) {
        const value = parseInt(match[1]);
        const unit = match[2];
        return value * (unit === 'minute' ? 60000 : 3600000);
      }
    }
    
    const match = spell.duration.match(/(\d+) (round|minute|hour)/);
    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2];
      switch (unit) {
        case 'round': return value * 6000; // 6 seconds per round
        case 'minute': return value * 60000;
        case 'hour': return value * 3600000;
      }
    }
    
    return 60000; // Default 1 minute
  }
}

// Type definitions
interface Vector3 {
  x: number;
  y: number;
  z: number;
}

interface BoundingBox {
  min: Vector3;
  max: Vector3;
}

interface SpellEffect {
  id: string;
  name: string;
  school: string;
  level: number;
  duration: string;
  range: string;
  concentration?: boolean;
  damage?: {
    diceExpression: string;
    damageType: string;
  };
  areaOfEffect?: {
    radius: number;
    shape: string;
  };
}

interface ActiveSpell {
  id: string;
  spell: SpellEffect;
  caster: any;
  position: Vector3;
  startTime: number;
  lastUpdate: number;
  spatialBounds: BoundingBox;
  interactionHistory: InteractionResult[];
}

interface InteractionRule {
  type: 'neutralization' | 'amplification' | 'transformation' | 'enhancement' | 'synergy' | 'corruption' | 'conflict';
  priority: number;
  effect: string;
  magnitude: number;
  radius: number;
}

interface InteractionResult {
  id: string;
  spell1: string;
  spell2: string;
  rule: InteractionRule;
  strength: number;
  position: Vector3;
  timestamp: number;
}

interface CombinationEffect {
  resultType: string;
  damageMultiplier: number;
  areaMultiplier: number;
  duration: number;
  secondaryEffects: string[];
}

interface CombinationDetection {
  id: string;
  spells: string[];
  combination: CombinationEffect;
  centerPoint: Vector3;
  detectionTime: number;
}

interface CombinationResult {
  id: string;
  type: string;
  position: Vector3;
  damage: number;
  radius: number;
  duration: number;
  secondaryEffects: string[];
  participatingSpells: string[];
}

interface SpellTimeline {
  spellId: string;
  startTime: number;
  duration: number;
  lastInteraction: number;
}

export { SpellInteractionEngine };
