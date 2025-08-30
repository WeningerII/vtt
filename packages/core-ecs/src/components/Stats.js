/**
 * Stats component for D&D 5e ability scores and derived stats
 */
export class StatsStore {
  constructor(capacity = 1000) {
    this.count = 0;
    this.capacity = capacity;
    this.entities = new Uint32Array(capacity);
    this.strength = new Uint8Array(capacity);
    this.dexterity = new Uint8Array(capacity);
    this.constitution = new Uint8Array(capacity);
    this.intelligence = new Uint8Array(capacity);
    this.wisdom = new Uint8Array(capacity);
    this.charisma = new Uint8Array(capacity);
    this.proficiencyBonus = new Uint8Array(capacity);
    this.armorClass = new Uint8Array(capacity);
    this.speed = new Uint8Array(capacity);
    this.level = new Uint8Array(capacity);
    this.hitDie = new Array(capacity);
  }
  add(entity, data) {
    if (this.count >= this.capacity) {
      throw new Error("StatsStore capacity exceeded");
    }
    const index = this.count++;
    this.entities[index] = entity;
    this.strength[index] = data.abilities.strength;
    this.dexterity[index] = data.abilities.dexterity;
    this.constitution[index] = data.abilities.constitution;
    this.intelligence[index] = data.abilities.intelligence;
    this.wisdom[index] = data.abilities.wisdom;
    this.charisma[index] = data.abilities.charisma;
    this.proficiencyBonus[index] = data.proficiencyBonus;
    this.armorClass[index] = data.armorClass;
    this.speed[index] = data.speed;
    this.level[index] = data.level;
    this.hitDie[index] = data.hitDie;
  }
  remove(entity) {
    const index = this.findIndex(entity);
    if (index === -1) return;
    const lastIndex = this.count - 1;
    if (index !== lastIndex) {
      this.entities[index] = this.entities[lastIndex] || 0;
      this.strength[index] = this.strength[lastIndex] || 10;
      this.dexterity[index] = this.dexterity[lastIndex] || 10;
      this.constitution[index] = this.constitution[lastIndex] || 10;
      this.intelligence[index] = this.intelligence[lastIndex] || 10;
      this.wisdom[index] = this.wisdom[lastIndex] || 10;
      this.charisma[index] = this.charisma[lastIndex] || 10;
      this.proficiencyBonus[index] = this.proficiencyBonus[lastIndex] || 2;
      this.armorClass[index] = this.armorClass[lastIndex] || 10;
      this.speed[index] = this.speed[lastIndex] || 30;
      this.level[index] = this.level[lastIndex] || 1;
      this.hitDie[index] = this.hitDie[lastIndex] || "d8";
    }
    this.count--;
  }
  has(entity) {
    return this.findIndex(entity) !== -1;
  }
  get(entity) {
    const index = this.findIndex(entity);
    if (index === -1) return null;
    const abilities = {
      strength: this.strength[index] || 10,
      dexterity: this.dexterity[index] || 10,
      constitution: this.constitution[index] || 10,
      intelligence: this.intelligence[index] || 10,
      wisdom: this.wisdom[index] || 10,
      charisma: this.charisma[index] || 10,
    };
    return {
      abilities,
      abilityModifiers: {
        strength: Math.floor((abilities.strength - 10) / 2),
        dexterity: Math.floor((abilities.dexterity - 10) / 2),
        constitution: Math.floor((abilities.constitution - 10) / 2),
        intelligence: Math.floor((abilities.intelligence - 10) / 2),
        wisdom: Math.floor((abilities.wisdom - 10) / 2),
        charisma: Math.floor((abilities.charisma - 10) / 2),
      },
      proficiencyBonus: this.proficiencyBonus[index] || 2,
      armorClass: this.armorClass[index] || 10,
      speed: this.speed[index] || 30,
      level: this.level[index] || 1,
      hitDie: this.hitDie[index] || "d8",
    };
  }
  getAbilityModifier(entity, ability) {
    const index = this.findIndex(entity);
    if (index === -1) return 0;
    const score = this[ability][index] || 10;
    return Math.floor((score - 10) / 2);
  }
  getSavingThrowModifier(entity, ability, proficient = false) {
    const abilityMod = this.getAbilityModifier(entity, ability);
    const profBonus = proficient ? this.getProficiencyBonus(entity) : 0;
    return abilityMod + profBonus;
  }
  getSkillModifier(entity, ability, proficient = false, expertise = false) {
    const abilityMod = this.getAbilityModifier(entity, ability);
    const profBonus = this.getProficiencyBonus(entity);
    let modifier = abilityMod;
    if (proficient) {
      modifier += profBonus;
      if (expertise) {
        modifier += profBonus; // Double proficiency for expertise
      }
    }
    return modifier;
  }
  getProficiencyBonus(entity) {
    const index = this.findIndex(entity);
    if (index === -1) return 0;
    return this.proficiencyBonus[index] || 2;
  }
  getInitiativeModifier(entity) {
    return this.getAbilityModifier(entity, "dexterity");
  }
  getSpellSaveDC(entity, spellcastingAbility) {
    const abilityMod = this.getAbilityModifier(entity, spellcastingAbility);
    const profBonus = this.getProficiencyBonus(entity);
    return 8 + abilityMod + profBonus;
  }
  getSpellAttackBonus(entity, spellcastingAbility) {
    const abilityMod = this.getAbilityModifier(entity, spellcastingAbility);
    const profBonus = this.getProficiencyBonus(entity);
    return abilityMod + profBonus;
  }
  findIndex(entity) {
    for (let i = 0; i < this.count; i++) {
      if (this.entities[i] === entity) return i;
    }
    return -1;
  }
  getEntities() {
    return Array.from(this.entities.slice(0, this.count));
  }
  forEach(callback) {
    for (let i = 0; i < this.count; i++) {
      const entity = this.entities[i];
      if (entity !== undefined) {
        const stats = this.get(entity);
        if (stats) {
          callback(entity, stats);
        }
      }
    }
  }
  size() {
    return this.count;
  }
}
//# sourceMappingURL=Stats.js.map
