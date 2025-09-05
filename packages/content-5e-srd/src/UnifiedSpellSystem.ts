/**
 * Unified Spell System - 100% Integration Bridge
 * Seamlessly integrates all three spell definition formats:
 * - Basic Spell Engine (spell-engine)
 * - Computational Spell System (ComputationalSpellSystem)
 * - Enhanced Physics Spells (enhanced-dnd5e-spells)
 */

import { EventEmitter } from "events";
import type { SpellEngine, Spell, _CastingResult } from "@vtt/spell-engine";
import type {
  ComputationalSpell,
  SpellExecutionEngine,
  EffectResult,
  ExecutionContext,
} from "./ComputationalSpellSystem";
import type { PhysicsSpellEffect, PhysicsSpellBridge } from "@vtt/physics-spell-bridge";
// import { PhysicsVisualBridge } from '../spell-visual-effects/src/PhysicsVisualBridge';
import type { SRDSpell } from "./index";

// Unified spell interface that encompasses all formats
export interface UnifiedSpell {
  id: string;
  name: string;
  level: number;
  school: string;
  classes: string[];
  source: string;

  // Core D&D mechanics
  castingTime: string;
  range: string;
  components: string[];
  materialComponent?: string;
  duration: string;
  concentration: boolean;
  ritual: boolean;
  description: string;
  upcastDescription?: string;

  // Enhanced mechanics
  damage?: {
    diceExpression: string;
    damageType: string;
    scalingDice?: string;
  };
  savingThrow?: {
    ability: string;
    dc: number;
  };
  tags: string[];

  // System bridges
  basicSpell?: Spell;
  computationalSpell?: ComputationalSpell;
  physicsSpell?: PhysicsSpellEffect;
  srdSpell?: SRDSpell;
}

export interface UnifiedCastingContext {
  caster: any;
  targets: string[];
  position?: { x: number; y: number; z?: number };
  spellLevel?: number;
  sceneId: string;
  mapService?: any;
}

export interface UnifiedCastingResult {
  success: boolean;
  spellSlotUsed: number;
  effects: Array<{
    type: string;
    target: string;
    result: any;
  }>;
  conditions?: Array<{ target: string; condition: string; duration: number }>;
  physicsEffects: any[];
  computationalResults?: EffectResult[];
  visualEffects: any[];
  error?: string;
}

export class UnifiedSpellSystem extends EventEmitter {
  private spellRegistry = new Map<string, UnifiedSpell>();
  private spellEngine?: SpellEngine;
  private computationalEngine?: SpellExecutionEngine;
  private physicsSpellBridge?: PhysicsSpellBridge;

  constructor() {
    super();
  }

  /**
   * Initialize with all engine integrations
   */
  initialize(
    spellEngine: SpellEngine,
    computationalEngine: SpellExecutionEngine,
    physicsSpellBridge: PhysicsSpellBridge,
  ): void {
    this.spellEngine = spellEngine;
    this.computationalEngine = computationalEngine;
    this.physicsSpellBridge = physicsSpellBridge;

    this.emit("initialized");
  }

  /**
   * Register a spell from any format
   */
  registerSpell(
    spell: UnifiedSpell | SRDSpell | Spell | ComputationalSpell | PhysicsSpellEffect,
  ): void {
    const unified = this.convertToUnified(spell);
    this.spellRegistry.set(unified.id, unified);
    this.emit("spellRegistered", unified.id);
  }

  /**
   * Register multiple spells
   */
  registerSpells(spells: Record<string, any>): void {
    for (const spell of Object.values(spells)) {
      this.registerSpell(spell);
    }
  }

  /**
   * Get unified spell by ID
   */
  getSpell(id: string): UnifiedSpell | undefined {
    return this.spellRegistry.get(id);
  }

  /**
   * Search spells by criteria
   */
  searchSpells(criteria: {
    level?: number;
    school?: string;
    classes?: string[];
    tags?: string[];
    hasPhysics?: boolean;
    hasComputational?: boolean;
  }): UnifiedSpell[] {
    return Array.from(this.spellRegistry.values()).filter((spell) => {
      if (criteria.level !== undefined && spell.level !== criteria.level) {return false;}
      if (criteria.school && spell.school !== criteria.school) {return false;}
      if (criteria.classes && !criteria.classes.some((c) => spell.classes.includes(c)))
        {return false;}
      if (criteria.tags && !criteria.tags.some((t) => spell.tags.includes(t))) {return false;}
      if (criteria.hasPhysics && !spell.physicsSpell) {return false;}
      if (criteria.hasComputational && !spell.computationalSpell) {return false;}
      return true;
    });
  }

  /**
   * Cast spell with full 100% integration
   */
  async castSpell(spellId: string, context: UnifiedCastingContext): Promise<UnifiedCastingResult> {
    const spell = this.spellRegistry.get(spellId);
    if (!spell) {
      return {
        success: false,
        error: `Spell not found: ${spellId}`,
        spellSlotUsed: 0,
        effects: [],
        physicsEffects: [],
        visualEffects: [],
      };
    }

    const results: UnifiedCastingResult = {
      success: true,
      spellSlotUsed: context.spellLevel || spell.level,
      effects: [],
      physicsEffects: [],
      visualEffects: [],
    };

    try {
      // 1. Execute Basic Spell Engine
      if (spell.basicSpell && this.spellEngine) {
        const basicResult = this.spellEngine.castSpell(
          spell.basicSpell,
          context.caster,
          context.targets,
          context.spellLevel,
          context.position,
        );

        if (!basicResult.success) {
          return { ...results, success: false, error: basicResult.error || "Unknown error" };
        }

        results.effects.push(...basicResult.effects);
        results.conditions = basicResult.conditions;
      }

      // 2. Execute Computational Spell System
      if (spell.computationalSpell && this.computationalEngine) {
        const executionContext = this.createExecutionContext(context, spell);
        const compResult = this.computationalEngine.execute(
          spell.computationalSpell,
          executionContext,
          context.spellLevel,
        );

        if (!compResult.success) {
          return {
            ...results,
            success: false,
            error: compResult.error || "Computational spell failed",
          };
        }

        results.computationalResults = compResult.results;
        results.effects.push(...this.convertComputationalToEffects(compResult.results));
      }

      // 3. Execute Physics Integration
      if (spell.physicsSpell && this.physicsSpellBridge) {
        const physicsResult = await this.physicsSpellBridge.castSpellWithPhysics(
          spell.physicsSpell,
          context.caster,
          context.targets,
          context.spellLevel,
          context.position,
        );

        if (!physicsResult.success) {
          return {
            ...results,
            success: false,
            error: physicsResult.error || "Physics spell failed",
          };
        }

        results.physicsEffects = physicsResult.physicsEffects;
        results.effects.push(...physicsResult.effects);
      }

      // 4. Generate Visual Effects
      results.visualEffects = await this.generateVisualEffects(spell, context, results);

      // 5. Update Map Service if provided
      if (context.mapService) {
        await this.updateMapService(context.mapService, context.sceneId, spell, results);
      }

      this.emit("spellCast", spellId, context, results);
      return results;
    } catch (error) {
      return {
        ...results,
        success: false,
        error: error instanceof Error ? error.message : "Unknown casting error",
      };
    }
  }

  /**
   * Convert any spell format to unified format
   */
  private convertToUnified(spell: any): UnifiedSpell {
    // Handle different spell formats
    if (spell.metadata) {
      // Computational spell format
      return this.convertComputationalToUnified(spell as ComputationalSpell);
    } else if (spell.physics) {
      // Physics spell format
      return this.convertPhysicsToUnified(spell as PhysicsSpellEffect);
    } else if (spell.effects && Array.isArray(spell.effects)) {
      // Basic spell engine format
      return this.convertBasicToUnified(spell as Spell);
    } else if (spell.diceExpression) {
      // SRD spell format
      return this.convertSRDToUnified(spell as SRDSpell);
    } else {
      // Already unified or unknown format
      return spell as UnifiedSpell;
    }
  }

  private convertSRDToUnified(srd: SRDSpell): UnifiedSpell {
    return {
      id: srd.id,
      name: srd.name,
      level: srd.level,
      school: srd.school,
      classes: srd.classes,
      source: srd.source,
      castingTime: srd.castingTime,
      range: srd.range,
      components: srd.components,
      materialComponent: this.extractMaterialComponent(srd.components) || "",
      duration: srd.duration,
      concentration: srd.concentration,
      ritual: srd.ritual,
      description: srd.description,
      upcastDescription: srd.upcastDescription || "",
      damage: srd.damage || { diceExpression: "", damageType: "" },
      savingThrow: srd.savingThrow,
      tags: srd.tags,
      srdSpell: srd,
    };
  }

  private convertBasicToUnified(basic: Spell): UnifiedSpell {
    return {
      id: basic.id,
      name: basic.name,
      level: basic.level,
      school: basic.school,
      classes: [],
      source: "Basic Engine",
      castingTime: basic.castingTime,
      range: basic.range,
      components: this.formatComponents(basic.components),
      materialComponent: this.extractMaterialComponent(basic.components) || "",
      duration: basic.duration,
      concentration: basic.concentration,
      ritual: basic.ritual,
      description: basic.description,
      upcastDescription: basic.atHigherLevels || "",
      tags: this.extractTagsFromEffects(basic.effects),
      basicSpell: basic,
    };
  }

  private convertComputationalToUnified(comp: ComputationalSpell): UnifiedSpell {
    return {
      id: comp.id,
      name: comp.metadata.name,
      level: comp.metadata.level,
      school: comp.metadata.school,
      classes: comp.metadata.classes,
      source: comp.metadata.source,
      castingTime: this.formatCastingTime(comp.requirements.castingTime({} as any)),
      range: this.formatRange(comp.requirements.range({} as any)),
      components: this.formatComputationalComponents(comp.requirements.components),
      duration: comp.requirements.concentration ? "Concentration" : "Instantaneous",
      concentration: comp.requirements.concentration,
      ritual: comp.requirements.ritual,
      description: `Computational spell with ${comp.effects.length} effects`,
      tags: this.extractComputationalTags(comp.effects),
      computationalSpell: comp,
    };
  }

  private convertPhysicsToUnified(physics: PhysicsSpellEffect): UnifiedSpell {
    return {
      id: physics.id || physics.name.toLowerCase().replace(/\s+/g, ""),
      name: physics.name,
      level: physics.level,
      school: physics.school,
      classes: [],
      source: "Physics Enhanced",
      castingTime: physics.castingTime,
      range: physics.range,
      components: Array.isArray(physics.components) ? physics.components : [],
      duration: physics.duration,
      concentration: physics.concentration || false,
      ritual: false,
      description: physics.description,
      tags: this.extractPhysicsTags(physics),
      physicsSpell: physics,
    };
  }

  private createExecutionContext(
    context: UnifiedCastingContext,
    _spell: UnifiedSpell,
  ): ExecutionContext {
    return {
      caster: {
        id: context.caster.id,
        position: {
          x: context.position?.x || 0,
          y: context.position?.y || 0,
          z: context.position?.z || 0,
        },
        hitPoints: { current: 100, maximum: 100 },
        armorClass: 15,
        savingThrows: Record<string, any>,
        conditions: new Set(),
        resistances: new Set(),
        immunities: new Set(),
        vulnerabilities: new Set(),
      },
      targets: context.targets.map((id) => ({
        id,
        position: { x: 0, y: 0, z: 0 },
        hitPoints: { current: 100, maximum: 100 },
        armorClass: 15,
        savingThrows: Record<string, any>,
        conditions: new Set(),
        resistances: new Set(),
        immunities: new Set(),
        vulnerabilities: new Set(),
      })),
      environment: {
        entities: new Map(),
        obstacles: [],
        lighting: 1.0,
        temperature: 20,
      },
      dice: (_sides: number, _count: number = 1) => {
        const results = [];
        for (let i = 0; i < count; i++) {
          results.push(Math.floor(Math.random() * sides) + 1);
        }
        return results;
      },
      time: Date.now(),
    };
  }

  private convertComputationalToEffects(results: EffectResult[]): any[] {
    return results.map((result) => ({
      type: `computational_effect_${result.effectIndex}`,
      target: result.targets.join(","),
      result: {
        success: result.success,
        values: result.values,
        modifications: result.modifications,
      },
    }));
  }

  private async generateVisualEffects(
    spell: UnifiedSpell,
    context: UnifiedCastingContext,
    results: UnifiedCastingResult,
  ): Promise<any[]> {
    const visualEffects = [];

    // Generate based on spell school and type
    switch (spell.school) {
      case "evocation":
        if (spell.tags.includes("fire")) {
          visualEffects.push({
            type: "particle_system",
            effect: "fire_explosion",
            position: context.position,
            duration: 2000,
          });
        }
        if (spell.tags.includes("lightning")) {
          visualEffects.push({
            type: "lightning_bolt",
            start: context.caster.position || context.position,
            end: context.position,
            duration: 500,
          });
        }
        break;

      case "conjuration":
        if (spell.tags.includes("teleport")) {
          visualEffects.push({
            type: "teleport_effect",
            start: context.caster.position,
            end: context.position,
            duration: 1000,
          });
        }
        break;

      case "enchantment":
        visualEffects.push({
          type: "mind_effect",
          targets: context.targets,
          duration: 3000,
        });
        break;
    }

    // Add physics-based visual effects
    if (results.physicsEffects.length > 0) {
      for (const physicsEffect of results.physicsEffects) {
        switch (physicsEffect.type) {
          case "projectile_created":
            visualEffects.push({
              type: "projectile_trail",
              projectileId: physicsEffect.projectileId,
              duration: 5000,
            });
            break;
          case "force_applied":
            visualEffects.push({
              type: "force_impact",
              target: physicsEffect.targetId,
              force: physicsEffect.force,
              duration: 1000,
            });
            break;
        }
      }
    }

    return visualEffects;
  }

  private async updateMapService(
    mapService: any,
    sceneId: string,
    spell: UnifiedSpell,
    results: UnifiedCastingResult,
  ): Promise<void> {
    // Update tokens with spell effects
    for (const effect of results.effects) {
      if (effect.type === "damage" && effect.result.total) {
        await mapService.applyDamage(
          sceneId,
          effect.target,
          effect.result.total,
          spell.damage?.damageType || "magical",
        );
      }
      if (effect.type === "healing" && effect.result.amount) {
        await mapService.applyHealing(sceneId, effect.target, effect.result.amount);
      }
    }

    // Handle conditions
    if (results.conditions) {
      for (const condition of results.conditions) {
        // This would integrate with a conditions system
        mapService.emit("conditionApplied", {
          target: condition.target,
          condition: condition.condition,
          duration: condition.duration,
          source: spell.id,
        });
      }
    }

    // Emit spell cast event to map
    mapService.emitMapUpdate(sceneId, {
      type: "spell_cast",
      spell: spell.id,
      caster: results.effects[0]?.target,
      effects: results.effects.length,
      timestamp: Date.now(),
    });
  }

  // Helper methods for format conversions
  private formatComponents(components: any): string[] {
    const result = [];
    if (components.verbal) {result.push("V");}
    if (components.somatic) {result.push("S");}
    if (components.material) {result.push("M");}
    return result;
  }

  private formatComputationalComponents(components: any): string[] {
    const result = [];
    if (components.verbal) {result.push("V");}
    if (components.somatic) {result.push("S");}
    if (components.material?.required) {result.push("M");}
    return result;
  }

  private formatCastingTime(ms: number): string {
    if (ms === 0) {return "1 reaction";}
    if (ms === 1000) {return "1 action";}
    if (ms === 6000) {return "1 bonus action";}
    return `${ms / 1000} seconds`;
  }

  private formatRange(gameUnits: number): string {
    const feet = gameUnits / 5;
    if (feet === 0) {return "Self";}
    if (feet === 1) {return "Touch";}
    return `${feet} feet`;
  }

  private extractTagsFromEffects(effects: any[]): string[] {
    const tags = new Set<string>();
    for (const effect of effects) {
      tags.add(effect.type);
      if (effect.damage?.type) {tags.add(effect.damage.type);}
      if (effect.area?.type) {tags.add(effect.area.type);}
    }
    return Array.from(tags);
  }

  private extractComputationalTags(effects: any[]): string[] {
    const tags = new Set<string>();
    for (const effect of effects) {
      tags.add(effect.type);
    }
    return Array.from(tags);
  }

  private extractPhysicsTags(physics: PhysicsSpellEffect): string[] {
    const tags = new Set<string>();
    if (physics.physics?.type) {tags.add(physics.physics.type);}
    if (physics.effects) {
      for (const effect of physics.effects) {
        if (effect.damage?.type) {tags.add(effect.damage.type);}
      }
    }
    return Array.from(tags);
  }

  /**
   * Get system statistics
   */
  getStats(): {
    totalSpells: number;
    basicSpells: number;
    computationalSpells: number;
    physicsSpells: number;
    unifiedSpells: number;
  } {
    const spells = Array.from(this.spellRegistry.values());
    return {
      totalSpells: spells.length,
      basicSpells: spells.filter((s) => s.basicSpell).length,
      computationalSpells: spells.filter((s) => s.computationalSpell).length,
      physicsSpells: spells.filter((s) => s.physicsSpell).length,
      unifiedSpells: spells.filter((s) => s.basicSpell && s.computationalSpell && s.physicsSpell)
        .length,
    };
  }

  /**
   * Export unified spell registry
   */
  exportSpells(): Record<string, UnifiedSpell> {
    const result: Record<string, UnifiedSpell> = {};
    for (const [id, spell] of this.spellRegistry.entries()) {
      result[id] = spell;
    }
    return result;
  }
}

// Singleton instance
export const _unifiedSpellSystem = new UnifiedSpellSystem();
