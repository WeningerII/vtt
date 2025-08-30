/**
 * Stats component for D&D 5e ability scores and derived stats
 */
export interface AbilityScores {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}
export interface StatsData {
  abilities: AbilityScores;
  abilityModifiers: Record<string, number>;
  proficiencyBonus: number;
  armorClass: number;
  speed: number;
  level: number;
  hitDie: string;
}
export declare class StatsStore {
  private capacity;
  private count;
  private entities;
  private strength;
  private dexterity;
  private constitution;
  private intelligence;
  private wisdom;
  private charisma;
  private proficiencyBonus;
  private armorClass;
  private speed;
  private level;
  private hitDie;
  constructor(capacity?: number);
  add(entity: number, data: StatsData): void;
  remove(entity: number): void;
  has(entity: number): boolean;
  get(entity: number): StatsData | null;
  getAbilityModifier(entity: number, ability: keyof AbilityScores): number;
  getSavingThrowModifier(
    entity: number,
    ability: keyof AbilityScores,
    proficient?: boolean,
  ): number;
  getSkillModifier(
    entity: number,
    ability: keyof AbilityScores,
    proficient?: boolean,
    expertise?: boolean,
  ): number;
  getProficiencyBonus(entity: number): number;
  getInitiativeModifier(entity: number): number;
  getSpellSaveDC(entity: number, spellcastingAbility: keyof AbilityScores): number;
  getSpellAttackBonus(entity: number, spellcastingAbility: keyof AbilityScores): number;
  private findIndex;
  getEntities(): number[];
  forEach(_callback: (entity: number, _stats: StatsData) => void): void;
  size(): number;
}
//# sourceMappingURL=Stats.d.ts.map
