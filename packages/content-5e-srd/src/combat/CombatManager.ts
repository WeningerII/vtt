import { EventEmitter } from 'events';
import { CharacterSheet, Character } from '../characters/CharacterSheet';
import { SpellManager, ActiveSpell } from '../spells/SpellManager';
import { logger } from '@vtt/logging';

export interface CombatParticipant {
  id: string;
  characterId: string;
  name: string;
  initiative: number;
  hitPoints: { current: number; max: number; temporary: number };
  armorClass: number;
  conditions: CombatCondition[];
  position?: { x: number; y: number };
  isPlayer: boolean;
  isActive: boolean;
}

export interface CombatCondition {
  id: string;
  name: string;
  description: string;
  duration: number; // rounds, -1 for permanent
  effects: {
    advantage?: string[];
    disadvantage?: string[];
    immunity?: string[];
    resistance?: string[];
    vulnerability?: string[];
    abilityModifier?: { [ability: string]: number };
    speedModifier?: number;
    acModifier?: number;
    cannotAct?: boolean;
    cannotMove?: boolean;
    cannotSpeak?: boolean;
  };
  source?: string;
}

export interface CombatAction {
  id: string;
  type: 'attack' | 'spell' | 'dash' | 'dodge' | 'help' | 'hide' | 'ready' | 'search' | 'use_object';
  actorId: string;
  targetIds?: string[];
  data: any;
  timestamp: Date;
}

export interface AttackRoll {
  d20: number;
  modifier: number;
  total: number;
  advantage: boolean;
  disadvantage: boolean;
  criticalHit: boolean;
  criticalMiss: boolean;
}

export interface DamageRoll {
  dice: string;
  modifier: number;
  total: number;
  type: string;
  critical: boolean;
}

export interface CombatEncounter {
  id: string;
  name: string;
  participants: CombatParticipant[];
  currentTurn: number;
  round: number;
  isActive: boolean;
  startTime: Date;
  endTime?: Date;
  actions: CombatAction[];
}

export class CombatManager extends EventEmitter {
  private encounters: Map<string, CombatEncounter> = new Map();
  private spellManager: SpellManager;
  private characterSheets: Map<string, CharacterSheet> = new Map();

  constructor(spellManager: SpellManager) {
    super();
    this.spellManager = spellManager;
    this.setMaxListeners(100);
  }

  /**
   * Start a new combat encounter
   */
  startCombat(
    participants: Array<{
      characterId: string;
      name: string;
      initiative: number;
      isPlayer: boolean;
    }>,
    encounterId?: string
  ): CombatEncounter {
    const encounter: CombatEncounter = {
      id: encounterId || this.generateEncounterId(),
      name: `Combat ${new Date().toLocaleString()}`,
      participants: participants.map(p => ({
        id: this.generateParticipantId(),
        characterId: p.characterId,
        name: p.name,
        initiative: p.initiative,
        hitPoints: { current: 100, max: 100, temporary: 0 }, // Would get from character sheet
        armorClass: 15, // Would get from character sheet
        conditions: [],
        isPlayer: p.isPlayer,
        isActive: true,
      })).sort((a, b) => b.initiative - a.initiative),
      currentTurn: 0,
      round: 1,
      isActive: true,
      startTime: new Date(),
      actions: [],
    };

    this.encounters.set(encounter.id, encounter);
    this.emit('combatStarted', encounter);
    logger.info(`Combat started: ${encounter.id} with ${participants.length} participants`);

    return encounter;
  }

  /**
   * End combat encounter
   */
  endCombat(encounterId: string): boolean {
    const encounter = this.encounters.get(encounterId);
    if (!encounter || !encounter.isActive) {
      return false;
    }

    encounter.isActive = false;
    encounter.endTime = new Date();

    // End all active spells from this combat
    encounter.participants.forEach(participant => {
      const activeSpells = this.spellManager.getActiveSpells(participant.characterId);
      activeSpells.forEach(spell => {
        this.spellManager.endSpell(spell.id);
      });
    });

    this.emit('combatEnded', encounter);
    logger.info(`Combat ended: ${encounterId}`);

    return true;
  }

  /**
   * Advance to next turn
   */
  nextTurn(encounterId: string): boolean {
    const encounter = this.encounters.get(encounterId);
    if (!encounter || !encounter.isActive) {
      return false;
    }

    encounter.currentTurn = (encounter.currentTurn + 1) % encounter.participants.length;
    
    if (encounter.currentTurn === 0) {
      encounter.round++;
      this.processEndOfRound(encounter);
    }

    const currentParticipant = encounter.participants[encounter.currentTurn];
    this.emit('turnChanged', encounter, currentParticipant);
    logger.debug(`Turn advanced in ${encounterId}: ${currentParticipant?.name || 'Unknown'}`);

    return true;
  }

  /**
   * Make an attack roll
   */
  rollAttack(
    encounterId: string,
    attackerId: string,
    targetId: string,
    attackBonus: number,
    options?: {
      advantage?: boolean;
      disadvantage?: boolean;
    }
  ): AttackRoll {
    const encounter = this.encounters.get(encounterId);
    if (!encounter) {
      throw new Error('Combat encounter not found');
    }

    const attacker = encounter.participants.find(p => p.id === attackerId);
    const target = encounter.participants.find(p => p.id === targetId);
    
    if (!attacker || !target) {
      throw new Error('Participant not found');
    }

    // Roll d20 with advantage/disadvantage
    let d20Roll: number;
    const hasAdvantage = options?.advantage || false;
    const hasDisadvantage = options?.disadvantage || false;

    if (hasAdvantage && !hasDisadvantage) {
      const roll1 = Math.floor(Math.random() * 20) + 1;
      const roll2 = Math.floor(Math.random() * 20) + 1;
      d20Roll = Math.max(roll1, roll2);
    } else if (hasDisadvantage && !hasAdvantage) {
      const roll1 = Math.floor(Math.random() * 20) + 1;
      const roll2 = Math.floor(Math.random() * 20) + 1;
      d20Roll = Math.min(roll1, roll2);
    } else {
      d20Roll = Math.floor(Math.random() * 20) + 1;
    }

    const total = d20Roll + attackBonus;
    const criticalHit = d20Roll === 20;
    const criticalMiss = d20Roll === 1;

    const attackRoll: AttackRoll = {
      d20: d20Roll,
      modifier: attackBonus,
      total,
      advantage: hasAdvantage && !hasDisadvantage,
      disadvantage: hasDisadvantage && !hasAdvantage,
      criticalHit,
      criticalMiss,
    };

    this.emit('attackRoll', encounterId, attackerId, targetId, attackRoll);
    
    return attackRoll;
  }

  /**
   * Roll damage
   */
  rollDamage(
    dice: string,
    modifier: number = 0,
    damageType: string = 'bludgeoning',
    critical: boolean = false
  ): DamageRoll {
    let total = modifier;
    
    // Parse dice notation (e.g., "2d6", "1d8+3")
    const diceMatch = dice.match(/(\d+)d(\d+)/g);
    if (diceMatch) {
      for (const diceGroup of diceMatch) {
        const [count, sides] = diceGroup.split('d').map(Number);
        
        if (count && sides) {
          for (let i = 0; i < count; i++) {
            const roll = Math.floor(Math.random() * sides) + 1;
            total += roll;
            
            // Double dice on critical hit
            if (critical) {
              const critRoll = Math.floor(Math.random() * sides) + 1;
              total += critRoll;
            }
          }
        }
      }
    }

    const damageRoll: DamageRoll = {
      dice,
      modifier,
      total: Math.max(0, total),
      type: damageType,
      critical,
    };

    this.emit('damageRoll', damageRoll);
    
    return damageRoll;
  }

  /**
   * Apply damage to participant
   */
  applyDamage(
    encounterId: string,
    targetId: string,
    damage: number,
    damageType: string = 'bludgeoning'
  ): boolean {
    const encounter = this.encounters.get(encounterId);
    if (!encounter) {
      return false;
    }

    const target = encounter.participants.find(p => p.id === targetId);
    if (!target) {
      return false;
    }

    // Apply resistances, immunities, vulnerabilities
    const finalDamage = this.calculateFinalDamage(target, damage, damageType);

    // Apply temporary hit points first
    if (target.hitPoints.temporary > 0) {
      const tempDamage = Math.min(finalDamage, target.hitPoints.temporary);
      target.hitPoints.temporary -= tempDamage;
      const remainingDamage = finalDamage - tempDamage;
      target.hitPoints.current = Math.max(0, target.hitPoints.current - remainingDamage);
    } else {
      target.hitPoints.current = Math.max(0, target.hitPoints.current - finalDamage);
    }

    // Check for unconsciousness or death
    if (target.hitPoints.current === 0) {
      this.addCondition(encounterId, targetId, {
        id: 'unconscious',
        name: 'Unconscious',
        description: 'The creature is unconscious',
        duration: -1,
        effects: {
          cannotAct: true,
          cannotMove: true,
          disadvantage: ['all'],
        },
      });
    }

    this.emit('damageApplied', encounterId, targetId, finalDamage, damageType);
    
    return true;
  }

  /**
   * Heal participant
   */
  heal(encounterId: string, targetId: string, amount: number): boolean {
    const encounter = this.encounters.get(encounterId);
    if (!encounter) {
      return false;
    }

    const target = encounter.participants.find(p => p.id === targetId);
    if (!target) {
      return false;
    }

    const oldHp = target.hitPoints.current;
    target.hitPoints.current = Math.min(target.hitPoints.max, target.hitPoints.current + amount);
    const actualHealing = target.hitPoints.current - oldHp;

    // Remove unconscious condition if healed above 0
    if (oldHp === 0 && target.hitPoints.current > 0) {
      this.removeCondition(encounterId, targetId, 'unconscious');
    }

    this.emit('healed', encounterId, targetId, actualHealing);
    
    return true;
  }

  /**
   * Add condition to participant
   */
  addCondition(encounterId: string, targetId: string, condition: CombatCondition): boolean {
    const encounter = this.encounters.get(encounterId);
    if (!encounter) {
      return false;
    }

    const target = encounter.participants.find(p => p.id === targetId);
    if (!target) {
      return false;
    }

    // Remove existing condition of same type
    target.conditions = target.conditions.filter(c => c.name !== condition.name);
    target.conditions.push(condition);

    this.emit('conditionAdded', encounterId, targetId, condition);
    
    return true;
  }

  /**
   * Remove condition from participant
   */
  removeCondition(encounterId: string, targetId: string, conditionName: string): boolean {
    const encounter = this.encounters.get(encounterId);
    if (!encounter) {
      return false;
    }

    const target = encounter.participants.find(p => p.id === targetId);
    if (!target) {
      return false;
    }

    const initialLength = target.conditions.length;
    target.conditions = target.conditions.filter(c => c.name !== conditionName);

    if (target.conditions.length < initialLength) {
      this.emit('conditionRemoved', encounterId, targetId, conditionName);
      return true;
    }

    return false;
  }

  /**
   * Get current encounter state
   */
  getEncounter(encounterId: string): CombatEncounter | undefined {
    return this.encounters.get(encounterId);
  }

  /**
   * Get current participant's turn
   */
  getCurrentParticipant(encounterId: string): CombatParticipant | undefined {
    const encounter = this.encounters.get(encounterId);
    if (!encounter) {
      return undefined;
    }

    return encounter.participants[encounter.currentTurn];
  }

  /**
   * Roll initiative for all participants
   */
  rollInitiative(participants: Array<{ id: string; dexModifier: number; bonus?: number }>): Array<{ id: string; initiative: number }> {
    return participants.map(p => ({
      id: p.id,
      initiative: Math.floor(Math.random() * 20) + 1 + p.dexModifier + (p.bonus || 0),
    })).sort((a, b) => b.initiative - a.initiative);
  }

  private calculateFinalDamage(target: CombatParticipant, damage: number, damageType: string): number {
    let finalDamage = damage;

    // Check conditions for resistances/immunities/vulnerabilities
    for (const condition of target.conditions) {
      if (condition.effects.immunity?.includes(damageType)) {
        return 0;
      }
      if (condition.effects.resistance?.includes(damageType)) {
        finalDamage = Math.floor(finalDamage / 2);
      }
      if (condition.effects.vulnerability?.includes(damageType)) {
        finalDamage *= 2;
      }
    }

    return finalDamage;
  }

  private processEndOfRound(encounter: CombatEncounter): void {
    // Process condition durations
    encounter.participants.forEach(participant => {
      participant.conditions = participant.conditions.filter(condition => {
        if (condition.duration > 0) {
          condition.duration--;
          return condition.duration > 0;
        }
        return condition.duration === -1; // Permanent conditions
      });
    });

    this.emit('roundEnded', encounter);
  }

  private generateEncounterId(): string {
    return `encounter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateParticipantId(): string {
    return `participant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
