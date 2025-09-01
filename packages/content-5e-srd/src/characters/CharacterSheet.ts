import { EventEmitter } from 'events';
import { logger } from '@vtt/logging';

export interface AbilityScores {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

export interface SavingThrows {
  strength: { proficient: boolean; value: number };
  dexterity: { proficient: boolean; value: number };
  constitution: { proficient: boolean; value: number };
  intelligence: { proficient: boolean; value: number };
  wisdom: { proficient: boolean; value: number };
  charisma: { proficient: boolean; value: number };
}

export interface Skills {
  acrobatics: { proficient: boolean; expertise: boolean; value: number };
  animalHandling: { proficient: boolean; expertise: boolean; value: number };
  arcana: { proficient: boolean; expertise: boolean; value: number };
  athletics: { proficient: boolean; expertise: boolean; value: number };
  deception: { proficient: boolean; expertise: boolean; value: number };
  history: { proficient: boolean; expertise: boolean; value: number };
  insight: { proficient: boolean; expertise: boolean; value: number };
  intimidation: { proficient: boolean; expertise: boolean; value: number };
  investigation: { proficient: boolean; expertise: boolean; value: number };
  medicine: { proficient: boolean; expertise: boolean; value: number };
  nature: { proficient: boolean; expertise: boolean; value: number };
  perception: { proficient: boolean; expertise: boolean; value: number };
  performance: { proficient: boolean; expertise: boolean; value: number };
  persuasion: { proficient: boolean; expertise: boolean; value: number };
  religion: { proficient: boolean; expertise: boolean; value: number };
  sleightOfHand: { proficient: boolean; expertise: boolean; value: number };
  stealth: { proficient: boolean; expertise: boolean; value: number };
  survival: { proficient: boolean; expertise: boolean; value: number };
}

export interface SpellSlots {
  level1: { max: number; used: number };
  level2: { max: number; used: number };
  level3: { max: number; used: number };
  level4: { max: number; used: number };
  level5: { max: number; used: number };
  level6: { max: number; used: number };
  level7: { max: number; used: number };
  level8: { max: number; used: number };
  level9: { max: number; used: number };
}

export interface ClassFeature {
  id: string;
  name: string;
  description: string;
  level: number;
  uses?: { max: number; used: number; resetOn: 'short' | 'long' };
}

export interface Equipment {
  id: string;
  name: string;
  type: 'weapon' | 'armor' | 'shield' | 'tool' | 'item' | 'consumable';
  quantity: number;
  weight: number;
  value: { amount: number; currency: 'cp' | 'sp' | 'ep' | 'gp' | 'pp' };
  equipped: boolean;
  attuned?: boolean;
  properties: string[];
  description: string;
}

export interface Character {
  id: string;
  name: string;
  race: string;
  class: string;
  subclass?: string;
  level: number;
  background: string;
  alignment: string;
  experiencePoints: number;
  
  // Core stats
  abilityScores: AbilityScores;
  proficiencyBonus: number;
  armorClass: number;
  hitPoints: { current: number; max: number; temporary: number };
  hitDice: { total: number; used: number; type: string };
  speed: number;
  
  // Proficiencies
  savingThrows: SavingThrows;
  skills: Skills;
  languages: string[];
  toolProficiencies: string[];
  weaponProficiencies: string[];
  armorProficiencies: string[];
  
  // Combat
  initiative: number;
  attacks: Array<{
    name: string;
    attackBonus: number;
    damage: string;
    damageType: string;
    range?: string;
    properties: string[];
  }>;
  
  // Spellcasting
  spellcastingAbility?: keyof AbilityScores;
  spellSaveDC?: number;
  spellAttackBonus?: number;
  spellSlots: SpellSlots;
  spellsKnown: string[];
  spellsPrepared: string[];
  cantripsKnown: string[];
  
  // Features and traits
  classFeatures: ClassFeature[];
  racialTraits: ClassFeature[];
  feats: ClassFeature[];
  
  // Equipment
  equipment: Equipment[];
  currency: {
    copper: number;
    silver: number;
    electrum: number;
    gold: number;
    platinum: number;
  };
  
  // Roleplay
  personalityTraits: string[];
  ideals: string[];
  bonds: string[];
  flaws: string[];
  
  // Metadata
  ownerId: string;
  campaignId?: string;
  isNPC: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class CharacterSheet extends EventEmitter {
  private character: Character;

  constructor(character: Character) {
    super();
    this.character = { ...character };
    this.setMaxListeners(100);
  }

  /**
   * Get character data
   */
  getCharacter(): Character {
    return { ...this.character };
  }

  /**
   * Update character data
   */
  updateCharacter(updates: Partial<Character>): void {
    this.character = {
      ...this.character,
      ...updates,
      updatedAt: new Date(),
    };
    
    this.emit('characterUpdated', this.character);
    this.recalculateStats();
  }

  /**
   * Calculate ability modifier
   */
  getAbilityModifier(ability: keyof AbilityScores): number {
    return Math.floor((this.character.abilityScores[ability] - 10) / 2);
  }

  /**
   * Calculate skill modifier
   */
  getSkillModifier(skill: keyof Skills): number {
    const skillData = this.character.skills[skill];
    const abilityMap: Record<keyof Skills, keyof AbilityScores> = {
      acrobatics: 'dexterity',
      animalHandling: 'wisdom',
      arcana: 'intelligence',
      athletics: 'strength',
      deception: 'charisma',
      history: 'intelligence',
      insight: 'wisdom',
      intimidation: 'charisma',
      investigation: 'intelligence',
      medicine: 'wisdom',
      nature: 'intelligence',
      perception: 'wisdom',
      performance: 'charisma',
      persuasion: 'charisma',
      religion: 'intelligence',
      sleightOfHand: 'dexterity',
      stealth: 'dexterity',
      survival: 'wisdom',
    };

    const abilityMod = this.getAbilityModifier(abilityMap[skill]);
    let bonus = abilityMod;

    if (skillData.proficient) {
      bonus += this.character.proficiencyBonus;
    }

    if (skillData.expertise) {
      bonus += this.character.proficiencyBonus;
    }

    return bonus;
  }

  /**
   * Calculate saving throw modifier
   */
  getSavingThrowModifier(ability: keyof AbilityScores): number {
    const savingThrow = this.character.savingThrows[ability];
    let bonus = this.getAbilityModifier(ability);

    if (savingThrow.proficient) {
      bonus += this.character.proficiencyBonus;
    }

    return bonus;
  }

  /**
   * Take damage
   */
  takeDamage(amount: number, damageType?: string): void {
    const hp = this.character.hitPoints;
    
    // Apply temporary hit points first
    if (hp.temporary > 0) {
      const tempDamage = Math.min(amount, hp.temporary);
      hp.temporary -= tempDamage;
      amount -= tempDamage;
    }

    // Apply remaining damage to current hit points
    hp.current = Math.max(0, hp.current - amount);
    
    this.character.updatedAt = new Date();
    this.emit('damageTaken', amount, damageType, hp);
    
    if (hp.current === 0) {
      this.emit('characterUnconscious', this.character);
    }
  }

  /**
   * Heal damage
   */
  heal(amount: number): void {
    const hp = this.character.hitPoints;
    const oldCurrent = hp.current;
    
    hp.current = Math.min(hp.max, hp.current + amount);
    const actualHealing = hp.current - oldCurrent;
    
    this.character.updatedAt = new Date();
    this.emit('healed', actualHealing, hp);
  }

  /**
   * Add temporary hit points
   */
  addTemporaryHitPoints(amount: number): void {
    // Temporary hit points don't stack, take the higher value
    this.character.hitPoints.temporary = Math.max(
      this.character.hitPoints.temporary,
      amount
    );
    
    this.character.updatedAt = new Date();
    this.emit('temporaryHitPointsAdded', amount);
  }

  /**
   * Use spell slot
   */
  useSpellSlot(level: number): boolean {
    const slotKey = `level${level}` as keyof SpellSlots;
    const slot = this.character.spellSlots[slotKey];
    
    if (slot.used >= slot.max) {
      return false;
    }
    
    slot.used++;
    this.character.updatedAt = new Date();
    this.emit('spellSlotUsed', level, slot);
    
    return true;
  }

  /**
   * Restore spell slots
   */
  restoreSpellSlots(level?: number): void {
    if (level) {
      const slotKey = `level${level}` as keyof SpellSlots;
      this.character.spellSlots[slotKey].used = 0;
    } else {
      // Restore all spell slots
      Object.values(this.character.spellSlots).forEach(slot => {
        slot.used = 0;
      });
    }
    
    this.character.updatedAt = new Date();
    this.emit('spellSlotsRestored', level);
  }

  /**
   * Use class feature
   */
  useClassFeature(featureId: string): boolean {
    const feature = this.character.classFeatures.find(f => f.id === featureId);
    
    if (!feature?.uses || feature.uses.used >= feature.uses.max) {
      return false;
    }
    
    feature.uses.used++;
    this.character.updatedAt = new Date();
    this.emit('classFeatureUsed', feature);
    
    return true;
  }

  /**
   * Take a short rest
   */
  shortRest(): void {
    // Restore hit dice (half of total, minimum 1)
    const hitDiceToRestore = Math.max(1, Math.floor(this.character.hitDice.total / 2));
    this.character.hitDice.used = Math.max(0, this.character.hitDice.used - hitDiceToRestore);
    
    // Restore short rest features
    this.character.classFeatures.forEach(feature => {
      if (feature.uses?.resetOn === 'short') {
        feature.uses.used = 0;
      }
    });
    
    this.character.updatedAt = new Date();
    this.emit('shortRest', this.character);
  }

  /**
   * Take a long rest
   */
  longRest(): void {
    // Restore all hit points
    this.character.hitPoints.current = this.character.hitPoints.max;
    this.character.hitPoints.temporary = 0;
    
    // Restore all hit dice
    this.character.hitDice.used = 0;
    
    // Restore all spell slots
    this.restoreSpellSlots();
    
    // Restore all features
    this.character.classFeatures.forEach(feature => {
      if (feature.uses) {
        feature.uses.used = 0;
      }
    });
    
    this.character.updatedAt = new Date();
    this.emit('longRest', this.character);
  }

  /**
   * Level up character
   */
  levelUp(newLevel: number): void {
    if (newLevel <= this.character.level) {
      return;
    }
    
    const oldLevel = this.character.level;
    this.character.level = newLevel;
    
    // Recalculate proficiency bonus
    this.character.proficiencyBonus = Math.ceil(newLevel / 4) + 1;
    
    this.character.updatedAt = new Date();
    this.emit('levelUp', oldLevel, newLevel);
    this.recalculateStats();
  }

  /**
   * Equip/unequip item
   */
  toggleEquipment(itemId: string): boolean {
    const item = this.character.equipment.find(e => e.id === itemId);
    if (!item) {
      return false;
    }
    
    item.equipped = !item.equipped;
    this.character.updatedAt = new Date();
    this.emit('equipmentToggled', item);
    this.recalculateStats();
    
    return true;
  }

  /**
   * Add equipment
   */
  addEquipment(equipment: Equipment): void {
    this.character.equipment.push(equipment);
    this.character.updatedAt = new Date();
    this.emit('equipmentAdded', equipment);
  }

  /**
   * Remove equipment
   */
  removeEquipment(itemId: string): boolean {
    const index = this.character.equipment.findIndex(e => e.id === itemId);
    if (index === -1) {
      return false;
    }
    
    const item = this.character.equipment.splice(index, 1)[0];
    this.character.updatedAt = new Date();
    this.emit('equipmentRemoved', item);
    this.recalculateStats();
    
    return true;
  }

  /**
   * Recalculate derived stats
   */
  private recalculateStats(): void {
    // Recalculate AC based on equipped armor
    this.recalculateArmorClass();
    
    // Recalculate saving throws
    this.recalculateSavingThrows();
    
    // Recalculate skills
    this.recalculateSkills();
    
    // Recalculate spell save DC and attack bonus
    this.recalculateSpellcasting();
    
    this.emit('statsRecalculated', this.character);
  }

  private recalculateArmorClass(): void {
    let baseAC = 10 + this.getAbilityModifier('dexterity');
    
    // Find equipped armor
    const armor = this.character.equipment.find(e => 
      e.equipped && (e.type === 'armor' || e.type === 'shield')
    );
    
    if (armor) {
      // Simplified AC calculation - would need full armor rules
      if (armor.type === 'armor') {
        baseAC = 11 + this.getAbilityModifier('dexterity'); // Leather armor example
      } else if (armor.type === 'shield') {
        baseAC += 2;
      }
    }
    
    this.character.armorClass = baseAC;
  }

  private recalculateSavingThrows(): void {
    Object.keys(this.character.savingThrows).forEach(ability => {
      const key = ability as keyof AbilityScores;
      this.character.savingThrows[key].value = this.getSavingThrowModifier(key);
    });
  }

  private recalculateSkills(): void {
    Object.keys(this.character.skills).forEach(skill => {
      const key = skill as keyof Skills;
      this.character.skills[key].value = this.getSkillModifier(key);
    });
  }

  private recalculateSpellcasting(): void {
    if (this.character.spellcastingAbility) {
      const abilityMod = this.getAbilityModifier(this.character.spellcastingAbility);
      this.character.spellSaveDC = 8 + this.character.proficiencyBonus + abilityMod;
      this.character.spellAttackBonus = this.character.proficiencyBonus + abilityMod;
    }
  }
}
