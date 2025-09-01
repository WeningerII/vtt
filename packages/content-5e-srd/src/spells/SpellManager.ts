import { EventEmitter } from 'events';
import { logger } from '@vtt/logging';

export interface Spell {
  id: string;
  name: string;
  level: number;
  school: 'abjuration' | 'conjuration' | 'divination' | 'enchantment' | 'evocation' | 'illusion' | 'necromancy' | 'transmutation';
  castingTime: string;
  range: string;
  components: {
    verbal: boolean;
    somatic: boolean;
    material: boolean;
    materialComponent?: string;
  };
  duration: string;
  concentration: boolean;
  ritual: boolean;
  description: string;
  higherLevels?: string;
  classes: string[];
  source: string;
}

export interface SpellSlot {
  level: number;
  max: number;
  used: number;
}

export interface ActiveSpell {
  id: string;
  spellId: string;
  casterId: string;
  targets: string[];
  level: number;
  startTime: Date;
  duration: number; // in seconds, -1 for permanent
  concentration: boolean;
  effects: SpellEffect[];
}

export interface SpellEffect {
  id: string;
  type: 'damage' | 'healing' | 'buff' | 'debuff' | 'condition' | 'movement' | 'utility';
  name: string;
  description: string;
  value?: number;
  condition?: string;
  duration?: number;
  recurring?: boolean;
  recurringInterval?: number;
}

export interface SpellAttack {
  spellId: string;
  casterId: string;
  targetId: string;
  attackRoll?: number;
  damage?: Array<{
    type: string;
    amount: number;
    dice: string;
  }>;
  savingThrow?: {
    ability: 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma';
    dc: number;
    success: 'half' | 'none' | 'negates';
  };
}

export class SpellManager extends EventEmitter {
  private spells: Map<string, Spell> = new Map();
  private activeSpells: Map<string, ActiveSpell> = new Map();
  private spellEffectTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    super();
    this.setMaxListeners(100);
    this.loadSRDSpells();
  }

  /**
   * Get spell by ID
   */
  getSpell(spellId: string): Spell | undefined {
    return this.spells.get(spellId);
  }

  /**
   * Search spells by criteria
   */
  searchSpells(criteria: {
    name?: string;
    level?: number;
    school?: string;
    class?: string;
    concentration?: boolean;
    ritual?: boolean;
  }): Spell[] {
    return Array.from(this.spells.values()).filter(spell => {
      if (criteria.name && !spell.name.toLowerCase().includes(criteria.name.toLowerCase())) {
        return false;
      }
      if (criteria.level !== undefined && spell.level !== criteria.level) {
        return false;
      }
      if (criteria.school && spell.school !== criteria.school) {
        return false;
      }
      if (criteria.class && !spell.classes.includes(criteria.class)) {
        return false;
      }
      if (criteria.concentration !== undefined && spell.concentration !== criteria.concentration) {
        return false;
      }
      if (criteria.ritual !== undefined && spell.ritual !== criteria.ritual) {
        return false;
      }
      return true;
    });
  }

  /**
   * Cast a spell
   */
  castSpell(
    spellId: string,
    casterId: string,
    targets: string[],
    level: number,
    options?: {
      position?: { x: number; y: number; z: number };
      upcast?: boolean;
    }
  ): ActiveSpell | null {
    const spell = this.spells.get(spellId);
    if (!spell) {
      logger.warn(`Attempted to cast unknown spell: ${spellId}`);
      return null;
    }

    if (level < spell.level) {
      logger.warn(`Cannot cast ${spell.name} at level ${level}, minimum level is ${spell.level}`);
      return null;
    }

    const activeSpell: ActiveSpell = {
      id: this.generateActiveSpellId(),
      spellId,
      casterId,
      targets,
      level,
      startTime: new Date(),
      duration: this.parseDuration(spell.duration),
      concentration: spell.concentration,
      effects: this.generateSpellEffects(spell, level),
    };

    this.activeSpells.set(activeSpell.id, activeSpell);

    // Set up duration timer if not permanent
    if (activeSpell.duration > 0) {
      const timer = setTimeout(() => {
        this.endSpell(activeSpell.id);
      }, activeSpell.duration * 1000);
      
      this.spellEffectTimers.set(activeSpell.id, timer);
    }

    this.emit('spellCast', activeSpell, spell);
    logger.info(`Spell cast: ${spell.name} by ${casterId}`);

    return activeSpell;
  }

  /**
   * End an active spell
   */
  endSpell(activeSpellId: string): boolean {
    const activeSpell = this.activeSpells.get(activeSpellId);
    if (!activeSpell) {
      return false;
    }

    // Clear timer
    const timer = this.spellEffectTimers.get(activeSpellId);
    if (timer) {
      clearTimeout(timer);
      this.spellEffectTimers.delete(activeSpellId);
    }

    this.activeSpells.delete(activeSpellId);
    this.emit('spellEnded', activeSpell);
    logger.debug(`Spell ended: ${activeSpellId}`);

    return true;
  }

  /**
   * Get active spells for a character
   */
  getActiveSpells(characterId: string): ActiveSpell[] {
    return Array.from(this.activeSpells.values()).filter(
      spell => spell.casterId === characterId || spell.targets.includes(characterId)
    );
  }

  /**
   * Get concentration spells for a character
   */
  getConcentrationSpells(characterId: string): ActiveSpell[] {
    return Array.from(this.activeSpells.values()).filter(
      spell => spell.casterId === characterId && spell.concentration
    );
  }

  /**
   * Break concentration for a character
   */
  breakConcentration(characterId: string): void {
    const concentrationSpells = this.getConcentrationSpells(characterId);
    concentrationSpells.forEach(spell => {
      this.endSpell(spell.id);
    });

    if (concentrationSpells.length > 0) {
      this.emit('concentrationBroken', characterId, concentrationSpells);
    }
  }

  /**
   * Make a spell attack
   */
  makeSpellAttack(attack: SpellAttack): {
    hit: boolean;
    damage?: number;
    effects?: SpellEffect[];
  } {
    const spell = this.spells.get(attack.spellId);
    if (!spell) {
      return { hit: false };
    }

    let hit = false;
    let totalDamage = 0;

    if (attack.attackRoll !== undefined) {
      // Attack roll spell
      hit = attack.attackRoll >= 10; // Simplified - would need target AC
      
      if (hit && attack.damage) {
        totalDamage = attack.damage.reduce((sum, dmg) => sum + dmg.amount, 0);
      }
    } else if (attack.savingThrow) {
      // Saving throw spell
      const saveRoll = Math.floor(Math.random() * 20) + 1; // Simplified - would need actual save bonus
      hit = saveRoll < attack.savingThrow.dc;
      
      if (attack.damage) {
        totalDamage = attack.damage.reduce((sum, dmg) => sum + dmg.amount, 0);
        
        if (!hit && attack.savingThrow.success === 'half') {
          totalDamage = Math.floor(totalDamage / 2);
        } else if (!hit && attack.savingThrow.success === 'negates') {
          totalDamage = 0;
        }
      }
    }

    this.emit('spellAttack', attack, { hit, damage: totalDamage });
    
    return {
      hit,
      damage: totalDamage,
      effects: spell ? this.generateSpellEffects(spell, 1) : undefined,
    };
  }

  /**
   * Get spells by class and level
   */
  getSpellsForClass(className: string, level?: number): Spell[] {
    return Array.from(this.spells.values()).filter(spell => {
      if (!spell.classes.includes(className)) {
        return false;
      }
      if (level !== undefined && spell.level > level) {
        return false;
      }
      return true;
    });
  }

  /**
   * Get cantrips for a class
   */
  getCantrips(className: string): Spell[] {
    return this.getSpellsForClass(className, 0).filter(spell => spell.level === 0);
  }

  private loadSRDSpells(): void {
    // Load a subset of SRD spells for demonstration
    const srdSpells: Spell[] = [
      {
        id: 'fireball',
        name: 'Fireball',
        level: 3,
        school: 'evocation',
        castingTime: '1 action',
        range: '150 feet',
        components: { verbal: true, somatic: true, material: true, materialComponent: 'a tiny ball of bat guano and sulfur' },
        duration: 'Instantaneous',
        concentration: false,
        ritual: false,
        description: 'A bright streak flashes from your pointing finger to a point you choose within range and then blossoms with a low roar into an explosion of flame.',
        higherLevels: 'When you cast this spell using a spell slot of 4th level or higher, the damage increases by 1d6 for each slot level above 3rd.',
        classes: ['sorcerer', 'wizard'],
        source: 'SRD',
      },
      {
        id: 'cure-wounds',
        name: 'Cure Wounds',
        level: 1,
        school: 'evocation',
        castingTime: '1 action',
        range: 'Touch',
        components: { verbal: true, somatic: true, material: false },
        duration: 'Instantaneous',
        concentration: false,
        ritual: false,
        description: 'A creature you touch regains a number of hit points equal to 1d8 + your spellcasting ability modifier.',
        higherLevels: 'When you cast this spell using a spell slot of 2nd level or higher, the healing increases by 1d8 for each slot level above 1st.',
        classes: ['bard', 'cleric', 'druid', 'paladin', 'ranger'],
        source: 'SRD',
      },
      {
        id: 'magic-missile',
        name: 'Magic Missile',
        level: 1,
        school: 'evocation',
        castingTime: '1 action',
        range: '120 feet',
        components: { verbal: true, somatic: true, material: false },
        duration: 'Instantaneous',
        concentration: false,
        ritual: false,
        description: 'You create three glowing darts of magical force. Each dart hits a creature of your choice that you can see within range.',
        higherLevels: 'When you cast this spell using a spell slot of 2nd level or higher, the spell creates one more dart for each slot level above 1st.',
        classes: ['sorcerer', 'wizard'],
        source: 'SRD',
      },
      {
        id: 'shield',
        name: 'Shield',
        level: 1,
        school: 'abjuration',
        castingTime: '1 reaction',
        range: 'Self',
        components: { verbal: true, somatic: true, material: false },
        duration: '1 round',
        concentration: false,
        ritual: false,
        description: 'An invisible barrier of magical force appears and protects you. Until the start of your next turn, you have a +5 bonus to AC.',
        classes: ['sorcerer', 'wizard'],
        source: 'SRD',
      },
      {
        id: 'mage-hand',
        name: 'Mage Hand',
        level: 0,
        school: 'conjuration',
        castingTime: '1 action',
        range: '30 feet',
        components: { verbal: true, somatic: true, material: false },
        duration: '1 minute',
        concentration: false,
        ritual: false,
        description: 'A spectral, floating hand appears at a point you choose within range.',
        classes: ['bard', 'sorcerer', 'warlock', 'wizard'],
        source: 'SRD',
      },
    ];

    srdSpells.forEach(spell => {
      this.spells.set(spell.id, spell);
    });

    logger.info(`Loaded ${srdSpells.length} SRD spells`);
  }

  private parseDuration(duration: string): number {
    if (duration === 'Instantaneous') return 0;
    if (duration === 'Until dispelled' || duration === 'Permanent') return -1;
    
    // Parse duration like "1 minute", "10 minutes", "1 hour", etc.
    const match = duration.match(/(\d+)\s*(round|minute|hour|day)/i);
    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      
      switch (unit) {
        case 'round': return value * 6; // 6 seconds per round
        case 'minute': return value * 60;
        case 'hour': return value * 3600;
        case 'day': return value * 86400;
      }
    }
    
    return 60; // Default to 1 minute
  }

  private generateSpellEffects(spell: Spell, level: number): SpellEffect[] {
    const effects: SpellEffect[] = [];
    
    // Generate effects based on spell
    switch (spell.id) {
      case 'fireball':
        effects.push({
          id: `${spell.id}-damage`,
          type: 'damage',
          name: 'Fire Damage',
          description: `${8 + (level - 3)}d6 fire damage`,
          value: (8 + (level - 3)) * 3.5, // Average damage
        });
        break;
        
      case 'cure-wounds':
        effects.push({
          id: `${spell.id}-healing`,
          type: 'healing',
          name: 'Healing',
          description: `${level}d8 + spellcasting modifier healing`,
          value: level * 4.5, // Average healing
        });
        break;
        
      case 'shield':
        effects.push({
          id: `${spell.id}-ac`,
          type: 'buff',
          name: 'AC Bonus',
          description: '+5 bonus to AC',
          value: 5,
          duration: 6, // 1 round
        });
        break;
    }
    
    return effects;
  }

  private generateActiveSpellId(): string {
    return `spell_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  destroy(): void {
    // Clear all timers
    for (const timer of this.spellEffectTimers.values()) {
      clearTimeout(timer);
    }
    this.spellEffectTimers.clear();
    this.activeSpells.clear();
  }
}
