import { EventEmitter } from 'events';

export interface CombatParticipant {
  id: string;
  name: string;
  initiative: number;
  hitPoints: number;
  maxHitPoints: number;
  armorClass: number;
  conditions: string[];
  isPlayer: boolean;
}

export interface CombatState {
  participants: CombatParticipant[];
  currentTurn: number;
  round: number;
  isActive: boolean;
}

export class CombatEngine extends EventEmitter {
  private state: CombatState;

  constructor() {
    super();
    this.state = {
      participants: [],
      currentTurn: 0,
      round: 1,
      isActive: false
    };
  }

  public addParticipant(participant: CombatParticipant): void {
    this.state.participants.push(participant);
    this.sortParticipantsByInitiative();
    this.emit('participantAdded', participant);
  }

  public removeParticipant(participantId: string): void {
    const index = this.state.participants.findIndex(p => p.id === participantId);
    if (index !== -1) {
      const removed = this.state.participants.splice(index, 1)[0];
      this.emit('participantRemoved', removed);
    }
  }

  public startCombat(): void {
    if (this.state.participants.length === 0) {
      throw new Error('Cannot start combat without participants');
    }
    this.state.isActive = true;
    this.state.currentTurn = 0;
    this.state.round = 1;
    this.emit('combatStarted', this.state);
  }

  public endCombat(): void {
    this.state.isActive = false;
    this.emit('combatEnded', this.state);
  }

  public nextTurn(): void {
    if (!this.state.isActive) {
      throw new Error('Cannot advance turn when combat is not active');
    }

    this.state.currentTurn++;
    if (this.state.currentTurn >= this.state.participants.length) {
      this.state.currentTurn = 0;
      this.state.round++;
      this.emit('roundAdvanced', this.state.round);
    }
    this.emit('turnAdvanced', this.getCurrentParticipant());
  }

  public getCurrentParticipant(): CombatParticipant | null {
    if (!this.state.isActive || this.state.participants.length === 0) {
      return null;
    }
    return this.state.participants[this.state.currentTurn] || null;
  }

  public dealDamage(participantId: string, damage: number): void {
    const participant = this.state.participants.find(p => p.id === participantId);
    if (participant) {
      participant.hitPoints = Math.max(0, participant.hitPoints - damage);
      this.emit('damageTaken', participant, damage);
      
      if (participant.hitPoints === 0) {
        this.emit('participantDefeated', participant);
      }
    }
  }

  public healParticipant(participantId: string, healing: number): void {
    const participant = this.state.participants.find(p => p.id === participantId);
    if (participant) {
      participant.hitPoints = Math.min(participant.maxHitPoints, participant.hitPoints + healing);
      this.emit('healingReceived', participant, healing);
    }
  }

  public addCondition(participantId: string, condition: string): void {
    const participant = this.state.participants.find(p => p.id === participantId);
    if (participant && !participant.conditions.includes(condition)) {
      participant.conditions.push(condition);
      this.emit('conditionAdded', participant, condition);
    }
  }

  public removeCondition(participantId: string, condition: string): void {
    const participant = this.state.participants.find(p => p.id === participantId);
    if (participant) {
      const index = participant.conditions.indexOf(condition);
      if (index !== -1) {
        participant.conditions.splice(index, 1);
        this.emit('conditionRemoved', participant, condition);
      }
    }
  }

  public getState(): CombatState {
    return { ...this.state };
  }

  private sortParticipantsByInitiative(): void {
    this.state.participants.sort((a, b) => b.initiative - a.initiative);
  }
}
