import { MonsterSchema } from "@vtt/core-schemas";
import { EventEmitter } from 'events';
// Export additional systems
export { DiceRoller, diceRoller } from './DiceRoller';
export { SpellSystem } from './SpellSystem';
export { ActionSystem } from './ActionSystem';
export function abilityMod(score) {
    return Math.floor((score - 10) / 2);
}
export const CR_XP_MAP = {
    "0": 10,
    "1/8": 25,
    "1/4": 50,
    "1/2": 100,
    "1": 200,
    "2": 450,
    "3": 700,
    "4": 1100,
    "5": 1800,
    "6": 2300,
    "7": 2900,
    "8": 3900,
    "9": 5000,
    "10": 5900,
    "11": 7200,
    "12": 8400,
    "13": 10000,
    "14": 11500,
    "15": 13000,
    "16": 15000,
    "17": 18000,
    "18": 20000,
    "19": 22000,
    "20": 25000,
    "21": 33000,
    "22": 41000,
    "23": 50000,
    "24": 62000,
    "25": 75000,
    "26": 90000,
    "27": 105000,
    "28": 120000,
    "29": 135000,
    "30": 155000,
};
export function crToProficiency(cr) {
    // Typical MM guidance for proficiency by CR bands
    switch (cr) {
        case "0":
        case "1/8":
        case "1/4":
        case "1/2":
        case "1":
        case "2":
        case "3":
        case "4":
            return 2;
        case "5":
        case "6":
        case "7":
        case "8":
            return 3;
        case "9":
        case "10":
        case "11":
        case "12":
            return 4;
        case "13":
        case "14":
        case "15":
        case "16":
            return 5;
        case "17":
        case "18":
        case "19":
        case "20":
            return 6;
        case "21":
        case "22":
        case "23":
        case "24":
            return 7;
        case "25":
        case "26":
        case "27":
        case "28":
            return 8;
        case "29":
        case "30":
            return 9;
    }
}
export function compileMonster(mon) {
    // Validate upfront
    const parsed = MonsterSchema.parse(mon);
    const xp = parsed.xp ?? CR_XP_MAP[parsed.challengeRating];
    const proficiencyBonus = parsed.proficiencyBonus ?? crToProficiency(parsed.challengeRating);
    // Passive Perception: prefer explicit, else 10 + skill bonus if present, else 10 + WIS mod
    const explicitPassive = parsed.passivePerception;
    const skillPerception = parsed.skills?.PERCEPTION;
    const wisMod = abilityMod(parsed.abilities.WIS);
    const passivePerception = explicitPassive ?? (skillPerception != null ? 10 + skillPerception : 10 + wisMod);
    return {
        ...parsed,
        xp,
        proficiencyBonus,
        passivePerception,
    };
}
export function compileMonsters(list) {
    return list.map(compileMonster);
}
export class CombatEngine extends EventEmitter {
    constructor() {
        super();
        this.combatants = [];
        this.turnOrder = [];
        this.currentTurnIndex = 0;
        this.currentRound = 1;
        this.isActive = false;
    }
    addCombatant(combatant) {
        this.combatants.push(combatant);
        this.sortInitiative();
    }
    removeCombatant(id) {
        this.combatants = this.combatants.filter(c => c.id !== id);
        this.turnOrder = this.turnOrder.filter(id => id !== id);
    }
    startCombat() {
        this.isActive = true;
        this.currentRound = 1;
        this.currentTurnIndex = 0;
        this.sortInitiative();
    }
    endCombat() {
        this.isActive = false;
        this.currentRound = 1;
        this.currentTurnIndex = 0;
    }
    nextTurn() {
        if (!this.isActive)
            return;
        this.currentTurnIndex++;
        if (this.currentTurnIndex >= this.turnOrder.length) {
            this.currentTurnIndex = 0;
            this.currentRound++;
        }
    }
    getCurrentCombatant() {
        if (!this.isActive || this.turnOrder.length === 0)
            return null;
        const id = this.turnOrder[this.currentTurnIndex];
        return this.combatants.find(c => c.id === id) || null;
    }
    getCombatants() {
        return [...this.combatants];
    }
    getTurnOrder() {
        return [...this.turnOrder];
    }
    getCurrentRound() {
        return this.currentRound;
    }
    isInCombat() {
        return this.isActive;
    }
    executeAction(action) {
        // Placeholder for action execution
    }
    sortInitiative() {
        this.combatants.sort((a, b) => b.initiative - a.initiative);
        this.turnOrder = this.combatants.map(c => c.id);
    }
}
//# sourceMappingURL=index.js.map