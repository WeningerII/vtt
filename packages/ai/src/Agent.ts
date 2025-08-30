import { BehaviorTree, Blackboard, _NodeStatus} from './BehaviorTree';
import { StateMachine, _State, _StateContext } from './StateMachine';
import { PathfindingManager, Vector2 } from './Pathfinding';

export interface AgentConfig {
  id: string;
  name: string;
  position: Vector2;
  maxSpeed: number;
  maxAcceleration: number;
  visionRange: number;
  updateInterval: number;
  enablePathfinding: boolean;
  enableBehaviorTree: boolean;
  enableStateMachine: boolean;
}

export interface AgentPerception {
  nearbyAgents: Agent[];
  visibleObjects: any[];
  threats: any[];
  resources: any[];
  goals: Goal[];
  lastUpdate: number;
}

export interface Goal {
  id: string;
  type: string;
  priority: number;
  position?: Vector2;
  target?: any;
  data: any;
  isActive: boolean;
  isCompleted: boolean;
  deadline?: number;
}

export interface AgentMemory {
  shortTerm: Map<string, { value: any; timestamp: number; decay: number }>;
  longTerm: Map<string, any>;
  experiences: Array<{ event: string; outcome: string; timestamp: number; importance: number }>;
  maxShortTermSize: number;
  shortTermDecay: number;
}

export class Agent {
  public readonly id: string;
  public readonly name: string;
  public config: AgentConfig;
  
  // Core systems
  private behaviorTree: BehaviorTree | null = null;
  private stateMachine: StateMachine | null = null;
  private pathfinding: PathfindingManager;
  private blackboard: Blackboard;
  
  // State
  public position: Vector2;
  public velocity: Vector2 = { x: 0, y: 0 };
  public acceleration: Vector2 = { x: 0, y: 0 };
  public rotation: number = 0;
  
  // AI state
  private perception: AgentPerception;
  private memory: AgentMemory;
  private goals: Goal[] = [];
  private currentGoal: Goal | null = null;
  private lastUpdate = 0;
  private isActive = true;
  
  // Performance tracking
  private updateCount = 0;
  private totalUpdateTime = 0;
  private lastUpdateTime = 0;
  
  constructor(config: AgentConfig) {
    this.id = config.id;
    this.name = config.name;
    this.config = { ...config };
    this.position = { ...config.position };
    
    this.pathfinding = new PathfindingManager();
    this.blackboard = new Blackboard();
    
    // Initialize perception
    this.perception = {
      nearbyAgents: [],
      visibleObjects: [],
      threats: [],
      resources: [],
      goals: [],
      lastUpdate: 0
    };
    
    // Initialize memory
    this.memory = {
      shortTerm: new Map(),
      longTerm: new Map(),
      experiences: [],
      maxShortTermSize: 100,
      shortTermDecay: 10000 // 10 seconds
    };
    
    // Set up blackboard with agent data
    this.blackboard.set('agent', this);
    this.blackboard.set('position', this.position);
    this.blackboard.set('velocity', this.velocity);
    this.blackboard.set('goals', this.goals);
  }
  
  public setBehaviorTree(behaviorTree: BehaviorTree): void {
    this.behaviorTree = behaviorTree;
  }
  
  public setStateMachine(stateMachine: StateMachine): void {
    this.stateMachine = stateMachine;
  }
  
  public update(deltaTime: number): void {
    if (!this.isActive) return;
    
    const startTime = performance.now();
    
    // Check if we need to update based on interval
    const now = Date.now();
    if (now - this.lastUpdate < this.config.updateInterval) {
      return;
    }
    
    this.lastUpdate = now;
    
    // Update perception
    this.updatePerception();
    
    // Update memory (decay short-term memories)
    this.updateMemory();
    
    // Update goals
    this.updateGoals();
    
    // Update blackboard
    this.updateBlackboard();
    
    // Update AI systems
    if (this.config.enableBehaviorTree && this.behaviorTree) {
      this.behaviorTree.tick();
    }
    
    if (this.config.enableStateMachine && this.stateMachine) {
      this.stateMachine.update(deltaTime);
    }
    
    // Update movement
    this.updateMovement(deltaTime);
    
    // Performance tracking
    this.updateCount++;
    this.lastUpdateTime = performance.now() - startTime;
    this.totalUpdateTime += this.lastUpdateTime;
  }
  
  private updatePerception(): void {
    // This would be implemented based on the game's world state
    // For now, we'll just update the timestamp
    this.perception.lastUpdate = Date.now();
    
    // Update goals in perception
    this.perception.goals = [...this.goals];
  }
  
  private updateMemory(): void {
    const now = Date.now();
    
    // Decay short-term memories
    for (const [key, memory] of this.memory.shortTerm) {
      if (now - memory.timestamp > memory.decay) {
        this.memory.shortTerm.delete(key);
      }
    }
    
    // Limit short-term memory size
    if (this.memory.shortTerm.size > this.memory.maxShortTermSize) {
      const entries = Array.from(this.memory.shortTerm.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = entries.slice(0, entries.length - this.memory.maxShortTermSize);
      for (const [key] of toRemove) {
        this.memory.shortTerm.delete(key);
      }
    }
  }
  
  private updateGoals(): void {
    // Remove completed goals
    this.goals = this.goals.filter(goal => !goal.isCompleted);
    
    // Sort goals by priority
    this.goals.sort((a, b) => b.priority - a.priority);
    
    // Update current goal
    const topGoal = this.goals.find(goal => goal.isActive);
    if (topGoal && topGoal !== this.currentGoal) {
      this.currentGoal = topGoal;
      this.blackboard.set('currentGoal', this.currentGoal);
    } else if (!topGoal && this.currentGoal) {
      this.currentGoal = null;
      this.blackboard.set('currentGoal', null);
    }
  }
  
  private updateBlackboard(): void {
    this.blackboard.set('position', this.position);
    this.blackboard.set('velocity', this.velocity);
    this.blackboard.set('rotation', this.rotation);
    this.blackboard.set('perception', this.perception);
    this.blackboard.set('goals', this.goals);
    this.blackboard.set('deltaTime', Date.now() - this.lastUpdate);
  }
  
  private updateMovement(deltaTime: number): void {
    // Apply acceleration
    this.velocity.x += this.acceleration.x * deltaTime;
    this.velocity.y += this.acceleration.y * deltaTime;
    
    // Limit speed
    const speed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y);
    if (speed > this.config.maxSpeed) {
      const scale = this.config.maxSpeed / speed;
      this.velocity.x *= scale;
      this.velocity.y *= scale;
    }
    
    // Update position
    this.position.x += this.velocity.x * deltaTime;
    this.position.y += this.velocity.y * deltaTime;
    
    // Update rotation based on velocity
    if (speed > 0.1) {
      this.rotation = Math.atan2(this.velocity.y, this.velocity.x);
    }
    
    // Reset acceleration
    this.acceleration.x = 0;
    this.acceleration.y = 0;
  }
  
  // Goal management
  public addGoal(goal: Goal): void {
    this.goals.push(goal);
    this.rememberShortTerm(`goal_added_${goal.id}`, goal);
  }
  
  public removeGoal(goalId: string): void {
    const index = this.goals.findIndex(goal => goal.id === goalId);
    if (index >= 0) {
      const goal = this.goals[index];
      this.goals.splice(index, 1);
      this.rememberShortTerm(`goal_removed_${goalId}`, goal);
    }
  }
  
  public completeGoal(goalId: string): void {
    const goal = this.goals.find(g => g.id === goalId);
    if (goal) {
      goal.isCompleted = true;
      this.rememberExperience(`goal_completed_${goalId}`, 'success', 8);
    }
  }
  
  public getCurrentGoal(): Goal | null {
    return this.currentGoal;
  }
  
  // Memory management
  public rememberShortTerm(key: string, value: any, decay: number = this.memory.shortTermDecay): void {
    this.memory.shortTerm.set(key, {
      value,
      timestamp: Date.now(),
      decay
    });
  }
  
  public rememberLongTerm(key: string, value: any): void {
    this.memory.longTerm.set(key, value);
  }
  
  public recall(key: string): any {
    // Check short-term first
    const shortTerm = this.memory.shortTerm.get(key);
    if (shortTerm && Date.now() - shortTerm.timestamp < shortTerm.decay) {
      return shortTerm.value;
    }
    
    // Check long-term
    return this.memory.longTerm.get(key);
  }
  
  public forget(key: string): void {
    this.memory.shortTerm.delete(key);
    this.memory.longTerm.delete(key);
  }
  
  public rememberExperience(event: string, outcome: string, importance: number = 5): void {
    this.memory.experiences.push({
      event,
      outcome,
      timestamp: Date.now(),
      importance
    });
    
    // Keep only the most recent/important experiences
    if (this.memory.experiences.length > 1000) {
      this.memory.experiences.sort((a, b) => 
        (b.importance * 0.7 + (Date.now() - b.timestamp) * 0.3) - 
        (a.importance * 0.7 + (Date.now() - a.timestamp) * 0.3)
      );
      this.memory.experiences = this.memory.experiences.slice(0, 500);
    }
  }
  
  // Movement control
  public moveTo(target: Vector2): void {
    const direction = {
      x: target.x - this.position.x,
      y: target.y - this.position.y
    };
    
    const distance = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
    if (distance > 0.1) {
      this.acceleration.x = (direction.x / distance) * this.config.maxAcceleration;
      this.acceleration.y = (direction.y / distance) * this.config.maxAcceleration;
    }
  }
  
  public stop(): void {
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.acceleration.x = 0;
    this.acceleration.y = 0;
  }
  
  public applyForce(force: Vector2): void {
    this.acceleration.x += force.x;
    this.acceleration.y += force.y;
  }
  
  // Pathfinding
  public findPathTo(target: Vector2, gridId: string = 'default'): Vector2[] {
    if (!this.config.enablePathfinding) {
      return [this.position, target];
    }
    
    const result = this.pathfinding.findPath(gridId, this.position, target);
    return result.path;
  }
  
  // Perception queries
  public canSee(position: Vector2): boolean {
    const distance = Math.sqrt(
      (position.x - this.position.x) ** 2 + 
      (position.y - this.position.y) ** 2
    );
    return distance <= this.config.visionRange;
  }
  
  public getNearbyAgents(range?: number): Agent[] {
    const searchRange = range || this.config.visionRange;
    return this.perception.nearbyAgents.filter(agent => {
      const distance = Math.sqrt(
        (agent.position.x - this.position.x) ** 2 + 
        (agent.position.y - this.position.y) ** 2
      );
      return distance <= searchRange;
    });
  }
  
  // Utility methods
  public getDistanceTo(position: Vector2): number {
    return Math.sqrt(
      (position.x - this.position.x) ** 2 + 
      (position.y - this.position.y) ** 2
    );
  }
  
  public getAngleTo(position: Vector2): number {
    return Math.atan2(
      position.y - this.position.y,
      position.x - this.position.x
    );
  }
  
  public setActive(active: boolean): void {
    this.isActive = active;
    
    if (!active && this.stateMachine) {
      this.stateMachine.stop();
    }
  }
  
  public getBlackboard(): Blackboard {
    return this.blackboard;
  }
  
  public getPerception(): AgentPerception {
    return this.perception;
  }
  
  public getMemory(): AgentMemory {
    return this.memory;
  }
  
  // Performance and debugging
  public getStats() {
    return {
      id: this.id,
      name: this.name,
      position: this.position,
      velocity: this.velocity,
      rotation: this.rotation,
      isActive: this.isActive,
      updateCount: this.updateCount,
      lastUpdateTime: this.lastUpdateTime,
      averageUpdateTime: this.updateCount > 0 ? this.totalUpdateTime / this.updateCount : 0,
      goalCount: this.goals.length,
      currentGoal: this.currentGoal?.id || null,
      shortTermMemorySize: this.memory.shortTerm.size,
      longTermMemorySize: this.memory.longTerm.size,
      experienceCount: this.memory.experiences.length,
      behaviorTreeActive: this.behaviorTree !== null,
      stateMachineActive: this.stateMachine !== null
    };
  }
  
  public getDebugInfo() {
    return {
      ...this.getStats(),
      perception: this.perception,
      goals: this.goals,
      blackboard: this.blackboard.getData(),
      behaviorTreeDebug: this.behaviorTree?.getDebugInfo(),
      stateMachineDebug: this.stateMachine?.getStats()
    };
  }
  
  public dispose(): void {
    this.setActive(false);
    
    if (this.behaviorTree) {
      this.behaviorTree.dispose();
    }
    
    if (this.stateMachine) {
      this.stateMachine.dispose();
    }
    
    this.pathfinding.dispose();
    this.blackboard.clear();
    this.goals = [];
    this.memory.shortTerm.clear();
    this.memory.longTerm.clear();
    this.memory.experiences = [];
  }
}

// Agent Manager
export class AgentManager {
  private agents = new Map<string, Agent>();
  private updateQueue: Agent[] = [];
  private maxAgentsPerFrame = 10;
  private currentIndex = 0;
  
  public createAgent(config: AgentConfig): Agent {
    const agent = new Agent(config);
    this.agents.set(config.id, agent);
    this.updateQueue.push(agent);
    return agent;
  }
  
  public getAgent(id: string): Agent | null {
    return this.agents.get(id) || null;
  }
  
  public removeAgent(id: string): void {
    const agent = this.agents.get(id);
    if (agent) {
      agent.dispose();
      this.agents.delete(id);
      
      const index = this.updateQueue.indexOf(agent);
      if (index >= 0) {
        this.updateQueue.splice(index, 1);
        if (this.currentIndex > index) {
          this.currentIndex--;
        }
      }
    }
  }
  
  public getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }
  
  public getActiveAgents(): Agent[] {
    return Array.from(this.agents.values()).filter(agent => agent['isActive']);
  }
  
  public update(deltaTime: number): void {
    const agentsToUpdate = Math.min(this.maxAgentsPerFrame, this.updateQueue.length);
    
    for (let i = 0; i < agentsToUpdate; i++) {
      const agent = this.updateQueue[this.currentIndex];
      if (agent) {
        agent.update(deltaTime);
      }
      
      this.currentIndex = (this.currentIndex + 1) % this.updateQueue.length;
    }
  }
  
  public updatePerception(): void {
    // Update agent perception with nearby agents
    for (const agent of this.agents.values()) {
      const perception = agent.getPerception();
      perception.nearbyAgents = this.getNearbyAgents(agent, agent.config.visionRange);
    }
  }
  
  private getNearbyAgents(agent: Agent, range: number): Agent[] {
    const nearby: Agent[] = [];
    
    for (const otherAgent of this.agents.values()) {
      if (otherAgent === agent) continue;
      
      const distance = agent.getDistanceTo(otherAgent.position);
      if (distance <= range) {
        nearby.push(otherAgent);
      }
    }
    
    return nearby;
  }
  
  public getStats() {
    const agents = Array.from(this.agents.values());
    const activeAgents = agents.filter(agent => agent['isActive']);
    
    return {
      totalAgents: agents.length,
      activeAgents: activeAgents.length,
      maxAgentsPerFrame: this.maxAgentsPerFrame,
      averageUpdateTime: activeAgents.reduce((_sum, _agent) => 
        sum + agent.getStats().averageUpdateTime, 0) / Math.max(activeAgents.length, 1)
    };
  }
  
  public setMaxAgentsPerFrame(max: number): void {
    this.maxAgentsPerFrame = Math.max(1, max);
  }
  
  public dispose(): void {
    for (const agent of this.agents.values()) {
      agent.dispose();
    }
    
    this.agents.clear();
    this.updateQueue = [];
    this.currentIndex = 0;
  }
}

// Utility functions for creating common agent configurations
export function createBasicAgentConfig(_id: string, position: Vector2): AgentConfig {
  return {
    id,
    name: `Agent_${id}`,
    position,
    maxSpeed: 100,
    maxAcceleration: 200,
    visionRange: 150,
    updateInterval: 100, // 10 FPS
    enablePathfinding: true,
    enableBehaviorTree: true,
    enableStateMachine: true
  };
}

export function createFastAgentConfig(_id: string, position: Vector2): AgentConfig {
  return {
    id,
    name: `FastAgent_${id}`,
    position,
    maxSpeed: 200,
    maxAcceleration: 400,
    visionRange: 200,
    updateInterval: 50, // 20 FPS
    enablePathfinding: true,
    enableBehaviorTree: true,
    enableStateMachine: true
  };
}
