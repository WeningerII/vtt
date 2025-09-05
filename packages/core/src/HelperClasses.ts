/**
 * Essential Helper Classes for VTT System Integration
 * Supporting utilities for decision trees, automation, and procedural generation
 */

import { _globalEventBus, _GameEvents } from "./EventBus";

// Math and Utility Helpers
export class MathHelpers {
  /**
   * Clamp a value between min and max
   */
  static clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  /**
   * Linear interpolation between two values
   */
  static lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t;
  }

  /**
   * Convert degrees to radians
   */
  static degToRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Convert radians to degrees
   */
  static radToDeg(radians: number): number {
    return radians * (180 / Math.PI);
  }

  /**
   * Calculate distance between two points
   */
  static distance(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Generate random number in range
   */
  static randomRange(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }

  /**
   * Generate random integer in range (inclusive)
   */
  static randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Weighted random selection
   */
  static weightedRandom<T>(items: Array<{ item: T; weight: number }>): T {
    const totalWeight = items.reduce((_sum, _item) => _sum + _item.weight, 0);
    let random = Math.random() * totalWeight;

    for (const item of items) {
      random -= item.weight;
      if (random <= 0) {
        return item.item;
      }
    }

    const fallback = items[items.length - 1]?.item ?? items[0]?.item;
    if (fallback === undefined) {
      throw new Error("No items provided to weighted random selector");
    }
    return fallback;
  }
}

// Dice Rolling System
export class DiceRoller {
  /**
   * Roll dice using standard notation (e.g., "2d6+3", "1d20")
   */
  static roll(notation: string): { total: number; rolls: number[]; modifier: number } {
    const match = notation.match(/(\d+)d(\d+)(?:([+-])(\d+))?/i);
    if (!match) {
      throw new Error(`Invalid dice notation: ${notation}`);
    }

    const count = parseInt(match[1]!);
    const sides = parseInt(match[2]!);
    const modifierSign = match[3];
    const modifierValue = match[4] ? parseInt(match[4]) : 0;

    const modifier = modifierSign === "-" ? -modifierValue : modifierValue;
    const rolls: number[] = [];

    for (let i = 0; i < count; i++) {
      rolls.push(Math.floor(Math.random() * sides) + 1);
    }

    const total = rolls.reduce((_sum, _roll) => _sum + _roll, 0) + modifier;

    return { total, rolls, modifier };
  }

  /**
   * Roll with advantage (roll twice, take higher)
   */
  static rollAdvantage(notation: string): { total: number; rolls: number[][]; modifier: number } {
    const roll1 = this.roll(notation);
    const roll2 = this.roll(notation);

    const total = Math.max(roll1.total, roll2.total);

    return {
      total,
      rolls: [roll1.rolls, roll2.rolls],
      modifier: roll1.modifier,
    };
  }

  /**
   * Roll with disadvantage (roll twice, take lower)
   */
  static rollDisadvantage(notation: string): {
    total: number;
    rolls: number[][];
    modifier: number;
  } {
    const roll1 = this.roll(notation);
    const roll2 = this.roll(notation);

    const total = Math.min(roll1.total, roll2.total);

    return {
      total,
      rolls: [roll1.rolls, roll2.rolls],
      modifier: roll1.modifier,
    };
  }
}

// Game Entity Management
export class EntityManager {
  private entities: Map<string, any> = new Map();
  private entityTypes: Map<string, string> = new Map();
  private entityGroups: Map<string, Set<string>> = new Map();

  /**
   * Register an entity
   */
  registerEntity(id: string, entity: any, type: string = "unknown"): void {
    this.entities.set(id, entity);
    this.entityTypes.set(id, type);

    // Add to type group
    if (!this.entityGroups.has(type)) {
      this.entityGroups.set(type, new Set());
    }
    this.entityGroups.get(type)!.add(id);
  }

  /**
   * Get entity by ID
   */
  getEntity(id: string): any | undefined {
    return this.entities.get(id);
  }

  /**
   * Get entities by type
   */
  getEntitiesByType(type: string): any[] {
    const group = this.entityGroups.get(type);
    if (!group) {return [];}

    return Array.from(group)
      .map((id) => this.entities.get(id))
      .filter(Boolean);
  }

  /**
   * Remove entity
   */
  removeEntity(id: string): boolean {
    const type = this.entityTypes.get(id);
    if (type) {
      this.entityGroups.get(type)?.delete(id);
    }

    this.entityTypes.delete(id);
    return this.entities.delete(id);
  }

  /**
   * Find entities within range
   */
  findEntitiesInRange(centerX: number, centerY: number, range: number): any[] {
    const result: any[] = [];

    for (const entity of this.entities.values()) {
      if (entity.position) {
        const distance = MathHelpers.distance(
          centerX,
          centerY,
          entity.position.x,
          entity.position.y,
        );

        if (distance <= range) {
          result.push(entity);
        }
      }
    }

    return result;
  }

  /**
   * Get all entities
   */
  getAllEntities(): any[] {
    return Array.from(this.entities.values());
  }

  /**
   * Clear all entities
   */
  clear(): void {
    this.entities.clear();
    this.entityTypes.clear();
    this.entityGroups.clear();
  }
}

// State Machine Helper
export class StateMachine<T extends string> {
  private currentState: T;
  private states: Map<T, StateDefinition<T>> = new Map();
  private history: T[] = [];

  constructor(initialState: T) {
    this.currentState = initialState;
  }

  /**
   * Define a state
   */
  defineState(state: T, definition: StateDefinition<T>): void {
    this.states.set(state, definition);
  }

  /**
   * Transition to a new state
   */
  async transition(newState: T, data?: any): Promise<boolean> {
    const currentDefinition = this.states.get(this.currentState);
    const newDefinition = this.states.get(newState);

    if (!newDefinition) {
      return false;
    }

    // Check if transition is allowed
    if (currentDefinition?.canExit && !(await currentDefinition.canExit(newState, data))) {
      return false;
    }

    if (newDefinition.canEnter && !(await newDefinition.canEnter(this.currentState, data))) {
      return false;
    }

    // Execute exit logic
    if (currentDefinition?.onExit) {
      await currentDefinition.onExit(newState, data);
    }

    // Update state
    this.history.push(this.currentState);
    this.currentState = newState;

    // Execute enter logic
    if (newDefinition.onEnter) {
      const previousState = this.history[this.history.length - 1];
      if (previousState !== undefined) {
        await newDefinition.onEnter(previousState, data);
      }
    }

    return true;
  }

  /**
   * Get current state
   */
  getCurrentState(): T {
    return this.currentState;
  }

  /**
   * Get state history
   */
  getHistory(): T[] {
    return [...this.history];
  }

  /**
   * Go back to previous state
   */
  async goBack(data?: any): Promise<boolean> {
    if (this.history.length === 0) {return false;}

    const previousState = this.history.pop()!;
    return await this.transition(previousState, data);
  }
}

export interface StateDefinition<T> {
  onEnter?: (_fromState: T, _data?: any) => Promise<void> | void;
  onExit?: (_toState: T, _data?: any) => Promise<void> | void;
  canEnter?: (_fromState: T, _data?: any) => Promise<boolean> | boolean;
  canExit?: (_toState: T, _data?: any) => Promise<boolean> | boolean;
}

// Cooldown Manager
export class CooldownManager {
  private cooldowns: Map<string, number> = new Map();

  /**
   * Start a cooldown
   */
  startCooldown(key: string, durationMs: number): void {
    this.cooldowns.set(key, Date.now() + durationMs);
  }

  /**
   * Check if something is on cooldown
   */
  isOnCooldown(key: string): boolean {
    const endTime = this.cooldowns.get(key);
    if (!endTime) {return false;}

    if (Date.now() >= endTime) {
      this.cooldowns.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Get remaining cooldown time
   */
  getRemainingTime(key: string): number {
    const endTime = this.cooldowns.get(key);
    if (!endTime) {return 0;}

    const remaining = endTime - Date.now();
    return Math.max(0, remaining);
  }

  /**
   * Clear a cooldown
   */
  clearCooldown(key: string): void {
    this.cooldowns.delete(key);
  }

  /**
   * Clear all cooldowns
   */
  clearAll(): void {
    this.cooldowns.clear();
  }
}

// Resource Pool Manager (for spell slots, abilities, etc.)
export class ResourcePool {
  private current: number;
  private maximum: number;
  private regenerationRate: number; // per second
  private lastRegenTime: number;

  constructor(max: number, initial?: number, regenRate: number = 0) {
    this.maximum = max;
    this.current = initial ?? max;
    this.regenerationRate = regenRate;
    this.lastRegenTime = Date.now();
  }

  /**
   * Use resources
   */
  use(amount: number): boolean {
    this.updateRegeneration();

    if (this.current >= amount) {
      this.current -= amount;
      return true;
    }

    return false;
  }

  /**
   * Restore resources
   */
  restore(amount: number): void {
    this.updateRegeneration();
    this.current = Math.min(this.maximum, this.current + amount);
  }

  /**
   * Get current amount
   */
  getCurrent(): number {
    this.updateRegeneration();
    return this.current;
  }

  /**
   * Get maximum amount
   */
  getMaximum(): number {
    return this.maximum;
  }

  /**
   * Check if enough resources are available
   */
  hasEnough(amount: number): boolean {
    this.updateRegeneration();
    return this.current >= amount;
  }

  /**
   * Set maximum (and optionally current)
   */
  setMaximum(max: number, adjustCurrent: boolean = true): void {
    this.maximum = max;
    if (adjustCurrent && this.current > max) {
      this.current = max;
    }
  }

  /**
   * Update based on regeneration rate
   */
  private updateRegeneration(): void {
    if (this.regenerationRate <= 0) {return;}

    const now = Date.now();
    const deltaSeconds = (now - this.lastRegenTime) / 1000;
    const regenAmount = deltaSeconds * this.regenerationRate;

    if (regenAmount > 0) {
      this.current = Math.min(this.maximum, this.current + regenAmount);
      this.lastRegenTime = now;
    }
  }
}

// Condition/Effect Manager
export class ConditionManager {
  private conditions: Map<string, Condition> = new Map();

  /**
   * Add a condition
   */
  addCondition(condition: Condition): void {
    this.conditions.set(condition.id, condition);
  }

  /**
   * Remove a condition
   */
  removeCondition(id: string): boolean {
    return this.conditions.delete(id);
  }

  /**
   * Check if has condition
   */
  hasCondition(type: string): boolean {
    for (const condition of this.conditions.values()) {
      if (condition.type === type) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get conditions by type
   */
  getConditionsByType(type: string): Condition[] {
    return Array.from(this.conditions.values()).filter((c) => c.type === type);
  }

  /**
   * Update conditions (call this each turn/frame)
   */
  updateConditions(deltaTime: number): void {
    const toRemove: string[] = [];

    for (const condition of this.conditions.values()) {
      if (condition.duration > 0) {
        condition.duration -= deltaTime;
        if (condition.duration <= 0) {
          toRemove.push(condition.id);
        }
      }
    }

    // Remove expired conditions
    toRemove.forEach((id) => {
      const condition = this.conditions.get(id);
      if (condition?.onExpire) {
        condition.onExpire();
      }
      this.conditions.delete(id);
    });
  }

  /**
   * Get all active conditions
   */
  getAllConditions(): Condition[] {
    return Array.from(this.conditions.values());
  }

  /**
   * Clear all conditions
   */
  clearAll(): void {
    this.conditions.clear();
  }
}

export interface Condition {
  id: string;
  type: string;
  name: string;
  description: string;
  duration: number; // -1 for permanent
  effects: ConditionEffect[];
  onExpire?: () => void;
}

export interface ConditionEffect {
  type:
    | "attribute_modifier"
    | "advantage"
    | "disadvantage"
    | "immunity"
    | "vulnerability"
    | "custom";
  target: string;
  value?: any;
  apply?: (entity: any) => void;
  remove?: (entity: any) => void;
}

// Pathfinding Helper (simple A*)
export class Pathfinder {
  /**
   * Find path using A* algorithm
   */
  static findPath(
    start: { x: number; y: number },
    goal: { x: number; y: number },
    grid: boolean[][],
    allowDiagonal: boolean = true,
  ): { x: number; y: number }[] {
    const openSet: PathNode[] = [];
    const closedSet: PathNode[] = [];
    const startNode: PathNode = {
      x: start.x,
      y: start.y,
      g: 0,
      h: this.heuristic(start, goal),
      f: 0,
      parent: null,
    };
    startNode.f = startNode.g + startNode.h;

    openSet.push(startNode);

    while (openSet.length > 0) {
      // Find node with lowest f score
      let current = openSet[0]!;
      let currentIndex = 0;

      for (let i = 1; i < openSet.length; i++) {
        if (openSet[i]!.f < current.f) {
          current = openSet[i]!;
          currentIndex = i;
        }
      }

      // Move current from open to closed
      openSet.splice(currentIndex, 1);
      closedSet.push(current);

      // Check if we reached the goal
      if (current.x === goal.x && current.y === goal.y) {
        return this.reconstructPath(current);
      }

      // Check neighbors
      const neighbors = this.getNeighbors(current, grid, allowDiagonal);

      for (const neighbor of neighbors) {
        // Skip if in closed set
        if (closedSet.find((n) => n.x === neighbor.x && n.y === neighbor.y)) {
          continue;
        }

        const tentativeG = current.g + this.distance(current, neighbor);
        const existingNode = openSet.find((n) => n.x === neighbor.x && n.y === neighbor.y);

        if (!existingNode) {
          neighbor.g = tentativeG;
          neighbor.h = this.heuristic(neighbor, goal);
          neighbor.f = neighbor.g + neighbor.h;
          neighbor.parent = current;
          openSet.push(neighbor);
        } else if (tentativeG < existingNode.g) {
          existingNode.g = tentativeG;
          existingNode.f = existingNode.g + existingNode.h;
          existingNode.parent = current;
        }
      }
    }

    return []; // No path found
  }

  private static heuristic(a: { x: number; y: number }, b: { x: number; y: number }): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  private static distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private static getNeighbors(
    node: PathNode,
    grid: boolean[][],
    allowDiagonal: boolean,
  ): PathNode[] {
    const neighbors: PathNode[] = [];
    const directions = allowDiagonal
      ? [
          [-1, -1],
          [-1, 0],
          [-1, 1],
          [0, -1],
          [0, 1],
          [1, -1],
          [1, 0],
          [1, 1],
        ]
      : [
          [-1, 0],
          [0, -1],
          [0, 1],
          [1, 0],
        ];

    for (const [dx, dy] of directions) {
      if (dx === undefined || dy === undefined) {continue;}
      const x = node.x + dx;
      const y = node.y + dy;

      if (x >= 0 && x < (grid[0]?.length || 0) && y >= 0 && y < grid.length && grid[y]?.[x]) {
        neighbors.push({
          x,
          y,
          g: 0,
          h: 0,
          f: 0,
          parent: null,
        });
      }
    }

    return neighbors;
  }

  private static reconstructPath(node: PathNode): { x: number; y: number }[] {
    const path: { x: number; y: number }[] = [];
    let current: PathNode | null = node;

    while (current) {
      path.unshift({ x: current.x, y: current.y });
      current = current.parent;
    }

    return path;
  }
}

interface PathNode {
  x: number;
  y: number;
  g: number; // Distance from start
  h: number; // Heuristic (distance to goal)
  f: number; // Total cost
  parent: PathNode | null;
}

// Global helper instances
export const _entityManager = new EntityManager();
export const _cooldownManager = new CooldownManager();
