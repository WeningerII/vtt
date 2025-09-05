/**
 * Minimal stubs for AI components to satisfy compilation
 */

// Stub for AIBehaviorEngine
export class AIBehaviorEngine {
  constructor() {}
  process(): any { return null; }
}

// Stub for NPCPersonality with missing properties
export interface NPCPersonality {
  aggression: number;
  curiosity: number;
  sociability: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  traits: string[];
}

// Stub for NPCGoal
export interface NPCGoal {
  type: "survival" | "combat" | "social" | "exploration" | "protection" | "acquisition" | "defend" | "support";
  priority: number;
  target: string | null;
  duration?: number;
  data?: Record<string, any>;
}

// Stub for BehaviorTreeNode (alias for BehaviorNode)
export { BehaviorNode as BehaviorTreeNode } from './BehaviorTree';

// Export stubs
export * from './BehaviorTree';
export * from './StateMachine';
