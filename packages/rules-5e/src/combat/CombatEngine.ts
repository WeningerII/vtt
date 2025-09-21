/**
 * Complete D&D 5e Combat Engine with turn management, attack resolution, and damage calculation
 */

export interface Ability {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

export interface CombatStats {
  hitPoints: { current: number; max: number; temporary: number };
  armorClass: number;
  speed: number;
  proficiencyBonus: number;
  abilities: Ability;
  savingThrows: Partial<Record<keyof Ability, number>>;
  skills: Record<string, number>;
  resistances: string[];
  immunities: string[];
  vulnerabilities: string[];
  conditions: string[];
}

export interface Attack {
  id: string;
  name: string;
  type: "melee" | "ranged" | "spell";
  attackBonus: number;
  damage: DamageRoll[];
  range: number;
  properties: string[];
  description?: string;
}

export interface DamageRoll {
  dice: string; // e.g., "1d8", "2d6"
  bonus: number;
  type: string; // e.g., "slashing", "fire", "psychic"
}

export interface Spell {
  id: string;
  name: string;
  level: number;
  school: string;
  castingTime: string;
  range: string;
  components: string[];
  duration: string;
  description: string;
  damage?: DamageRoll[];
  savingThrow?: {
    ability: keyof Ability;
    dc: number;
    effect: "half" | "none" | "special";
  };
  attackRoll?: boolean;
}

export interface Combatant {
  id: string;
  name: string;
  type: "player" | "npc" | "monster";
  stats: CombatStats;
  attacks: Attack[];
  spells: Spell[];
  position: { x: number; y: number };
  initiative: number;
  isActive: boolean;
  actionsUsed: number;
  bonusActionUsed: boolean;
  reactionUsed: boolean;
  movementUsed: number;
}

export interface CombatAction {
  type: "attack" | "spell" | "move" | "dash" | "dodge" | "help" | "hide" | "ready" | "search";
  actorId: string;
  targetId?: string;
  targetPosition?: { x: number; y: number };
  attackId?: string;
  spellId?: string;
  data?: unknown;
}

export interface CombatResult {
  success: boolean;
  message: string;
  damage?: number;
  effects?: string[];
  changes?: Array<{
    combatantId: string;
    property: string;
    oldValue: unknown;
    newValue: unknown;
  }>;
}

export class CombatEngine {
  private combatants: Map<string, Combatant> = new Map();
  private turnOrder: string[] = [];
  private currentTurnIndex = 0;
  private round = 1;
  private isActive = false;
  private eventHandlers: Map<string, Array<(data?: unknown) => void>> = new Map();

  // Dice rolling utility
  private rollDice(diceString: string): { total: number; rolls: number[] } {
    const match = diceString.match(/(\d+)d(\d+)(?:\+(\d+))?/);
    if (!match) {
      throw new Error(`Invalid dice string: ${diceString}`);
    }

    const count = parseInt(match[1]!);
    const sides = parseInt(match[2]!);
    const bonus = parseInt(match[3] || "0");

    const rolls: number[] = [];
    let total = bonus;

    for (let i = 0; i < count; i++) {
      const roll = Math.floor(Math.random() * sides) + 1;
      rolls.push(roll);
      total += roll;
    }

    return { total, rolls };
  }

  private getAbilityModifier(score: number): number {
    return Math.floor((score - 10) / 2);
  }

  private calculateDistance(
    pos1: { x: number; y: number },
    pos2: { x: number; y: number },
  ): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy) * 5; // 5 feet per grid square
  }

  // Combat management
  public addCombatant(combatant: Combatant): void {
    this.combatants.set(combatant.id, combatant);
    this.emit("combatantAdded", combatant);
  }

  public removeCombatant(id: string): void {
    this.combatants.delete(id);
    this.turnOrder = this.turnOrder.filter((turnId) => turnId !== id);
    this.emit("combatantRemoved", id);
  }

  public rollInitiative(): void {
    const initiatives: Array<{ id: string; initiative: number }> = [];

    for (const [id, combatant] of this.combatants) {
      const dexMod = this.getAbilityModifier(combatant.stats.abilities.dexterity);
      const roll = this.rollDice("1d20").total + dexMod;
      combatant.initiative = roll;
      initiatives.push({ id, initiative: roll });
    }

    // Sort by initiative (descending), with dexterity as tiebreaker
    initiatives.sort((a, b) => {
      if (a.initiative !== b.initiative) {
        return b.initiative - a.initiative;
      }

      const combatantA = this.combatants.get(a.id)!;
      const combatantB = this.combatants.get(b.id)!;
      return combatantB.stats.abilities.dexterity - combatantA.stats.abilities.dexterity;
    });

    this.turnOrder = initiatives.map((init) => init.id);
    this.emit("initiativeRolled", initiatives);
  }

  public startCombat(): void {
    if (this.turnOrder.length === 0) {
      this.rollInitiative();
    }

    this.isActive = true;
    this.round = 1;
    this.currentTurnIndex = 0;
    this.resetCombatantActions();
    this.emit("combatStarted");
    this.emit("turnStarted", this.getCurrentCombatant());
  }

  public endCombat(): void {
    this.isActive = false;
    this.emit("combatEnded");
  }

  public nextTurn(): void {
    if (!this.isActive) {
      return;
    }

    const currentCombatant = this.getCurrentCombatant();
    if (currentCombatant) {
      this.emit("turnEnded", currentCombatant);
    }

    this.currentTurnIndex++;

    if (this.currentTurnIndex >= this.turnOrder.length) {
      this.currentTurnIndex = 0;
      this.round++;
      this.resetCombatantActions();
      this.processEndOfRoundEffects();
      this.emit("roundEnded", this.round - 1);
      this.emit("roundStarted", this.round);
    }

    const nextCombatant = this.getCurrentCombatant();
    if (nextCombatant) {
      this.emit("turnStarted", nextCombatant);
    }
  }

  private resetCombatantActions(): void {
    for (const combatant of this.combatants.values()) {
      combatant.actionsUsed = 0;
      combatant.bonusActionUsed = false;
      combatant.reactionUsed = false;
      combatant.movementUsed = 0;
    }
  }

  private processEndOfRoundEffects(): void {
    for (const combatant of this.combatants.values()) {
      // Process condition effects (poison damage, regeneration, etc.)
      this.processConditionEffects(combatant);
    }
  }

  private processConditionEffects(combatant: Combatant): void {
    const conditionsToRemove: string[] = [];

    for (const condition of combatant.stats.conditions) {
      switch (condition) {
        case "poisoned":
          {
            // Example: poison damage
            const poisonDamage = this.rollDice("1d4").total;
            this.applyDamage(combatant.id, poisonDamage, "poison");
          }
          break;
        case "regeneration":
          {
            // Example: healing
            const healing = this.rollDice("1d6").total;
            this.heal(combatant.id, healing);
          }
          break;
      }
    }

    // Remove expired conditions
    combatant.stats.conditions = combatant.stats.conditions.filter(
      (condition) => !conditionsToRemove.includes(condition),
    );
  }

  public getCurrentCombatant(): Combatant | null {
    if (!this.isActive || this.turnOrder.length === 0) {
      return null;
    }
    const id = this.turnOrder[this.currentTurnIndex];
    return id ? this.combatants.get(id) || null : null;
  }

  // Combat actions
  public executeAction(action: CombatAction): CombatResult {
    const actor = this.combatants.get(action.actorId);
    if (!actor) {
      return { success: false, message: "Actor not found" };
    }

    const currentCombatant = this.getCurrentCombatant();
    if (!currentCombatant || currentCombatant.id !== action.actorId) {
      return { success: false, message: "Not your turn" };
    }

    switch (action.type) {
      case "attack":
        return this.executeAttack(action);
      case "spell":
        return this.executeSpell(action);
      case "move":
        return this.executeMove(action);
      case "dash":
        return this.executeDash(action);
      case "dodge":
        return this.executeDodge(action);
      case "help":
        return this.executeHelp(action);
      case "hide":
        return this.executeHide(action);
      default:
        return { success: false, message: "Unknown action type" };
    }
  }

  private executeAttack(action: CombatAction): CombatResult {
    const actor = this.combatants.get(action.actorId)!;
    const target = action.targetId ? this.combatants.get(action.targetId) : null;

    if (!target) {
      return { success: false, message: "Target not found" };
    }

    if (actor.actionsUsed >= 1) {
      return { success: false, message: "No actions remaining" };
    }

    const attack = actor.attacks.find((a) => a.id === action.attackId);
    if (!attack) {
      return { success: false, message: "Attack not found" };
    }

    // Check range
    const distance = this.calculateDistance(actor.position, target.position);
    if (distance > attack.range) {
      return { success: false, message: "Target out of range" };
    }

    // Roll attack
    const attackRoll = this.rollDice("1d20").total + attack.attackBonus;
    const targetAC = target.stats.armorClass;

    const hit = attackRoll >= targetAC;
    const critical = attackRoll === 20 + attack.attackBonus;

    let totalDamage = 0;
    const damageBreakdown: string[] = [];

    if (hit) {
      for (const damageRoll of attack.damage) {
        let damage = this.rollDice(damageRoll.dice).total + damageRoll.bonus;

        // Critical hit doubles dice
        if (critical) {
          damage += this.rollDice(damageRoll.dice).total;
        }

        // Apply resistances/immunities/vulnerabilities
        damage = this.applyDamageModifiers(target, damage, damageRoll.type);

        totalDamage += damage;
        damageBreakdown.push(`${damage} ${damageRoll.type}`);
      }

      this.applyDamage(target.id, totalDamage);
    }

    actor.actionsUsed++;

    const message = hit
      ? `${actor.name} hits ${target.name} for ${totalDamage} damage (${damageBreakdown.join(", ")})`
      : `${actor.name} misses ${target.name}`;

    this.emit("attackExecuted", {
      actor,
      target,
      attack,
      hit,
      critical,
      damage: totalDamage,
      attackRoll,
    });

    return {
      success: true,
      message,
      damage: hit ? totalDamage : 0,
      changes: hit
        ? [
            {
              combatantId: target.id,
              property: "hitPoints.current",
              oldValue: target.stats.hitPoints.current + totalDamage,
              newValue: target.stats.hitPoints.current,
            },
          ]
        : [],
    };
  }

  private executeSpell(action: CombatAction): CombatResult {
    const actor = this.combatants.get(action.actorId)!;
    const spell = actor.spells.find((s) => s.id === action.spellId);

    if (!spell) {
      return { success: false, message: "Spell not found" };
    }

    if (actor.actionsUsed >= 1) {
      return { success: false, message: "No actions remaining" };
    }

    let result: CombatResult;

    if (spell.attackRoll && action.targetId) {
      // Spell attack
      const target = this.combatants.get(action.targetId);
      if (!target) {
        return { success: false, message: "Target not found" };
      }

      const spellAttackBonus =
        actor.stats.proficiencyBonus + this.getAbilityModifier(actor.stats.abilities.intelligence); // Assuming wizard

      const attackRoll = this.rollDice("1d20").total + spellAttackBonus;
      const hit = attackRoll >= target.stats.armorClass;

      if (hit && spell.damage) {
        let totalDamage = 0;
        for (const damageRoll of spell.damage) {
          const damage = this.rollDice(damageRoll.dice).total + damageRoll.bonus;
          totalDamage += this.applyDamageModifiers(target, damage, damageRoll.type);
        }

        this.applyDamage(target.id, totalDamage);

        result = {
          success: true,
          message: `${actor.name} casts ${spell.name} and hits ${target.name} for ${totalDamage} damage`,
          damage: totalDamage,
        };
      } else {
        result = {
          success: true,
          message: `${actor.name} casts ${spell.name} but misses ${target.name}`,
          damage: 0,
        };
      }
    } else if (spell.savingThrow) {
      // Saving throw spell
      result = this.executeSavingThrowSpell(actor, spell, action);
    } else {
      // Utility spell
      result = {
        success: true,
        message: `${actor.name} casts ${spell.name}`,
        effects: [spell.description],
      };
    }

    actor.actionsUsed++;

    this.emit("spellCast", {
      actor,
      spell,
      result,
    });

    return result;
  }

  private executeSavingThrowSpell(
    actor: Combatant,
    spell: Spell,
    action: CombatAction,
  ): CombatResult {
    if (!spell.savingThrow || !action.targetId) {
      return { success: false, message: "Invalid saving throw spell" };
    }

    const target = this.combatants.get(action.targetId);
    if (!target) {
      return { success: false, message: "Target not found" };
    }

    const savingThrow = spell.savingThrow;
    const abilityMod = this.getAbilityModifier(target.stats.abilities[savingThrow.ability]);
    const proficiency = target.stats.savingThrows[savingThrow.ability] || 0;

    const saveRoll = this.rollDice("1d20").total + abilityMod + proficiency;
    const success = saveRoll >= savingThrow.dc;

    let totalDamage = 0;
    if (spell.damage) {
      for (const damageRoll of spell.damage) {
        let damage = this.rollDice(damageRoll.dice).total + damageRoll.bonus;

        if (success && savingThrow.effect === "half") {
          damage = Math.floor(damage / 2);
        } else if (success && savingThrow.effect === "none") {
          damage = 0;
        }

        totalDamage += this.applyDamageModifiers(target, damage, damageRoll.type);
      }

      if (totalDamage > 0) {
        this.applyDamage(target.id, totalDamage);
      }
    }

    const saveResult = success ? "succeeds" : "fails";
    const message = `${target.name} ${saveResult} the saving throw against ${spell.name}${
      totalDamage > 0 ? ` and takes ${totalDamage} damage` : ""
    }`;

    return {
      success: true,
      message,
      damage: totalDamage,
    };
  }

  private executeMove(action: CombatAction): CombatResult {
    const actor = this.combatants.get(action.actorId)!;

    if (!action.targetPosition) {
      return { success: false, message: "No target position specified" };
    }

    const distance = this.calculateDistance(actor.position, action.targetPosition);
    const remainingMovement = actor.stats.speed - actor.movementUsed;

    if (distance > remainingMovement) {
      return { success: false, message: "Not enough movement remaining" };
    }

    actor.position = action.targetPosition;
    actor.movementUsed += distance;

    this.emit("combatantMoved", {
      combatant: actor,
      from: actor.position,
      to: action.targetPosition,
      distance,
    });

    return {
      success: true,
      message: `${actor.name} moves ${distance} feet`,
      changes: [
        {
          combatantId: actor.id,
          property: "position",
          oldValue: actor.position,
          newValue: action.targetPosition,
        },
      ],
    };
  }

  private executeDash(action: CombatAction): CombatResult {
    const actor = this.combatants.get(action.actorId)!;

    if (actor.actionsUsed >= 1) {
      return { success: false, message: "No actions remaining" };
    }

    // Dash doubles movement speed for the turn
    const additionalMovement = actor.stats.speed;
    actor.actionsUsed++;

    return {
      success: true,
      message: `${actor.name} dashes, gaining ${additionalMovement} feet of movement`,
      effects: [`+${additionalMovement} movement`],
    };
  }

  private executeDodge(action: CombatAction): CombatResult {
    const actor = this.combatants.get(action.actorId)!;

    if (actor.actionsUsed >= 1) {
      return { success: false, message: "No actions remaining" };
    }

    actor.actionsUsed++;
    // Add dodging condition (would need to be tracked and applied to attack rolls)

    return {
      success: true,
      message: `${actor.name} dodges, gaining advantage on Dexterity saving throws and imposing disadvantage on attacks`,
      effects: ["dodging"],
    };
  }

  private executeHelp(action: CombatAction): CombatResult {
    const actor = this.combatants.get(action.actorId)!;

    if (actor.actionsUsed >= 1) {
      return { success: false, message: "No actions remaining" };
    }

    if (!action.targetId) {
      return { success: false, message: "No target specified for help action" };
    }

    const target = this.combatants.get(action.targetId);
    if (!target) {
      return { success: false, message: "Target not found" };
    }

    actor.actionsUsed++;

    return {
      success: true,
      message: `${actor.name} helps ${target.name}, granting advantage on their next ability check or attack`,
      effects: ["advantage on next roll"],
    };
  }

  private executeHide(action: CombatAction): CombatResult {
    const actor = this.combatants.get(action.actorId)!;

    if (actor.actionsUsed >= 1) {
      return { success: false, message: "No actions remaining" };
    }

    // Roll Stealth check
    const dexMod = this.getAbilityModifier(actor.stats.abilities.dexterity);
    const stealthBonus = actor.stats.skills.stealth || 0;
    const stealthRoll = this.rollDice("1d20").total + dexMod + stealthBonus;

    actor.actionsUsed++;

    return {
      success: true,
      message: `${actor.name} attempts to hide (Stealth: ${stealthRoll})`,
      effects: [`stealth: ${stealthRoll}`],
    };
  }

  // Damage and healing
  private applyDamageModifiers(target: Combatant, damage: number, damageType: string): number {
    if (target.stats.immunities.includes(damageType)) {
      return 0;
    }

    if (target.stats.resistances.includes(damageType)) {
      return Math.floor(damage / 2);
    }

    if (target.stats.vulnerabilities.includes(damageType)) {
      return damage * 2;
    }

    return damage;
  }

  public applyDamage(combatantId: string, damage: number, damageType?: string): void {
    const combatant = this.combatants.get(combatantId);
    if (!combatant) {
      return;
    }

    // Apply temporary hit points first
    if (combatant.stats.hitPoints.temporary > 0) {
      const tempDamage = Math.min(damage, combatant.stats.hitPoints.temporary);
      combatant.stats.hitPoints.temporary -= tempDamage;
      damage -= tempDamage;
    }

    // Apply remaining damage to current hit points
    combatant.stats.hitPoints.current = Math.max(0, combatant.stats.hitPoints.current - damage);

    this.emit("damageApplied", {
      combatant,
      damage,
      damageType,
      newHitPoints: combatant.stats.hitPoints.current,
    });

    // Check for death/unconsciousness
    if (combatant.stats.hitPoints.current === 0) {
      this.handleUnconscious(combatant);
    }
  }

  public heal(combatantId: string, healing: number): void {
    const combatant = this.combatants.get(combatantId);
    if (!combatant) {
      return;
    }

    const oldHitPoints = combatant.stats.hitPoints.current;
    combatant.stats.hitPoints.current = Math.min(
      combatant.stats.hitPoints.max,
      combatant.stats.hitPoints.current + healing,
    );

    const actualHealing = combatant.stats.hitPoints.current - oldHitPoints;

    this.emit("healingApplied", {
      combatant,
      healing: actualHealing,
      newHitPoints: combatant.stats.hitPoints.current,
    });
  }

  private handleUnconscious(combatant: Combatant): void {
    if (!combatant.stats.conditions.includes("unconscious")) {
      combatant.stats.conditions.push("unconscious");
    }

    this.emit("combatantUnconscious", combatant);
  }

  // Event system
  public on(event: string, handler: (data?: unknown) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  public off(event: string, handler: (data?: unknown) => void): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(data));
    }
  }

  // Getters
  public getCombatants(): Combatant[] {
    return Array.from(this.combatants.values());
  }

  public getTurnOrder(): string[] {
    return [...this.turnOrder];
  }

  public getCurrentRound(): number {
    return this.round;
  }

  public isInCombat(): boolean {
    return this.isActive;
  }
}
