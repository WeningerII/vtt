import { Blackboard } from "./BehaviorTree";
import { PathfindingManager } from "./Pathfinding";
export class Agent {
  constructor(config) {
    // Core systems
    this.behaviorTree = null;
    this.stateMachine = null;
    this.velocity = { x: 0, y: 0 };
    this.acceleration = { x: 0, y: 0 };
    this.rotation = 0;
    this.goals = [];
    this.currentGoal = null;
    this.lastUpdate = 0;
    this.isActive = true;
    // Performance tracking
    this.updateCount = 0;
    this.totalUpdateTime = 0;
    this.lastUpdateTime = 0;
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
      lastUpdate: 0,
    };
    // Initialize memory
    this.memory = {
      shortTerm: new Map(),
      longTerm: new Map(),
      experiences: [],
      maxShortTermSize: 100,
      shortTermDecay: 10000, // 10 seconds
    };
    // Set up blackboard with agent data
    this.blackboard.set("agent", this);
    this.blackboard.set("position", this.position);
    this.blackboard.set("velocity", this.velocity);
    this.blackboard.set("goals", this.goals);
  }
  setBehaviorTree(behaviorTree) {
    this.behaviorTree = behaviorTree;
  }
  setStateMachine(stateMachine) {
    this.stateMachine = stateMachine;
  }
  update(deltaTime) {
    if (!this.isActive) {
      return;
    }
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
  updatePerception() {
    // This would be implemented based on the game's world state
    // For now, we'll just update the timestamp
    this.perception.lastUpdate = Date.now();
    // Update goals in perception
    this.perception.goals = [...this.goals];
  }
  updateMemory() {
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
  updateGoals() {
    // Remove completed goals
    this.goals = this.goals.filter((goal) => !goal.isCompleted);
    // Sort goals by priority
    this.goals.sort((a, b) => b.priority - a.priority);
    // Update current goal
    const topGoal = this.goals.find((goal) => goal.isActive);
    if (topGoal && topGoal !== this.currentGoal) {
      this.currentGoal = topGoal;
      this.blackboard.set("currentGoal", this.currentGoal);
    } else if (!topGoal && this.currentGoal) {
      this.currentGoal = null;
      this.blackboard.set("currentGoal", null);
    }
  }
  updateBlackboard() {
    this.blackboard.set("position", this.position);
    this.blackboard.set("velocity", this.velocity);
    this.blackboard.set("rotation", this.rotation);
    this.blackboard.set("perception", this.perception);
    this.blackboard.set("goals", this.goals);
    this.blackboard.set("deltaTime", Date.now() - this.lastUpdate);
  }
  updateMovement(deltaTime) {
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
  addGoal(goal) {
    this.goals.push(goal);
    this.rememberShortTerm(`goal_added_${goal.id}`, goal);
  }
  removeGoal(goalId) {
    const index = this.goals.findIndex((goal) => goal.id === goalId);
    if (index >= 0) {
      const goal = this.goals[index];
      this.goals.splice(index, 1);
      this.rememberShortTerm(`goal_removed_${goalId}`, goal);
    }
  }
  completeGoal(goalId) {
    const goal = this.goals.find((g) => g.id === goalId);
    if (goal) {
      goal.isCompleted = true;
      this.rememberExperience(`goal_completed_${goalId}`, "success", 8);
    }
  }
  getCurrentGoal() {
    return this.currentGoal;
  }
  // Memory management
  rememberShortTerm(key, value, decay = this.memory.shortTermDecay) {
    this.memory.shortTerm.set(key, {
      value,
      timestamp: Date.now(),
      decay,
    });
  }
  rememberLongTerm(key, value) {
    this.memory.longTerm.set(key, value);
  }
  recall(key) {
    // Check short-term first
    const shortTerm = this.memory.shortTerm.get(key);
    if (shortTerm && Date.now() - shortTerm.timestamp < shortTerm.decay) {
      return shortTerm.value;
    }
    // Check long-term
    return this.memory.longTerm.get(key);
  }
  forget(key) {
    this.memory.shortTerm.delete(key);
    this.memory.longTerm.delete(key);
  }
  rememberExperience(event, outcome, importance = 5) {
    this.memory.experiences.push({
      event,
      outcome,
      timestamp: Date.now(),
      importance,
    });
    // Keep only the most recent/important experiences
    if (this.memory.experiences.length > 1000) {
      this.memory.experiences.sort(
        (a, b) =>
          b.importance * 0.7 +
          (Date.now() - b.timestamp) * 0.3 -
          (a.importance * 0.7 + (Date.now() - a.timestamp) * 0.3),
      );
      this.memory.experiences = this.memory.experiences.slice(0, 500);
    }
  }
  // Movement control
  moveTo(target) {
    const direction = {
      x: target.x - this.position.x,
      y: target.y - this.position.y,
    };
    const distance = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
    if (distance > 0.1) {
      this.acceleration.x = (direction.x / distance) * this.config.maxAcceleration;
      this.acceleration.y = (direction.y / distance) * this.config.maxAcceleration;
    }
  }
  stop() {
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.acceleration.x = 0;
    this.acceleration.y = 0;
  }
  applyForce(force) {
    this.acceleration.x += force.x;
    this.acceleration.y += force.y;
  }
  // Pathfinding
  findPathTo(target, gridId = "default") {
    if (!this.config.enablePathfinding) {
      return [this.position, target];
    }
    const result = this.pathfinding.findPath(gridId, this.position, target);
    return result.path;
  }
  // Perception queries
  canSee(position) {
    const distance = Math.sqrt(
      (position.x - this.position.x) ** 2 + (position.y - this.position.y) ** 2,
    );
    return distance <= this.config.visionRange;
  }
  getNearbyAgents(range) {
    const searchRange = range || this.config.visionRange;
    return this.perception.nearbyAgents.filter((agent) => {
      const distance = Math.sqrt(
        (agent.position.x - this.position.x) ** 2 + (agent.position.y - this.position.y) ** 2,
      );
      return distance <= searchRange;
    });
  }
  // Utility methods
  getDistanceTo(position) {
    return Math.sqrt((position.x - this.position.x) ** 2 + (position.y - this.position.y) ** 2);
  }
  getAngleTo(position) {
    return Math.atan2(position.y - this.position.y, position.x - this.position.x);
  }
  setActive(active) {
    this.isActive = active;
    if (!active && this.stateMachine) {
      this.stateMachine.stop();
    }
  }
  getBlackboard() {
    return this.blackboard;
  }
  getPerception() {
    return this.perception;
  }
  getMemory() {
    return this.memory;
  }
  // Performance and debugging
  getStats() {
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
      stateMachineActive: this.stateMachine !== null,
    };
  }
  getDebugInfo() {
    return {
      ...this.getStats(),
      perception: this.perception,
      goals: this.goals,
      blackboard: this.blackboard.getData(),
      behaviorTreeDebug: this.behaviorTree?.getDebugInfo(),
      stateMachineDebug: this.stateMachine?.getStats(),
    };
  }
  dispose() {
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
  constructor() {
    this.agents = new Map();
    this.updateQueue = [];
    this.maxAgentsPerFrame = 10;
    this.currentIndex = 0;
  }
  createAgent(config) {
    const agent = new Agent(config);
    this.agents.set(config.id, agent);
    this.updateQueue.push(agent);
    return agent;
  }
  getAgent(id) {
    return this.agents.get(id) || null;
  }
  removeAgent(id) {
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
  getAllAgents() {
    return Array.from(this.agents.values());
  }
  getActiveAgents() {
    return Array.from(this.agents.values()).filter((agent) => agent["isActive"]);
  }
  update(deltaTime) {
    const agentsToUpdate = Math.min(this.maxAgentsPerFrame, this.updateQueue.length);
    for (let i = 0; i < agentsToUpdate; i++) {
      const agent = this.updateQueue[this.currentIndex];
      if (agent) {
        agent.update(deltaTime);
      }
      this.currentIndex = (this.currentIndex + 1) % this.updateQueue.length;
    }
  }
  updatePerception() {
    // Update agent perception with nearby agents
    for (const agent of this.agents.values()) {
      const perception = agent.getPerception();
      perception.nearbyAgents = this.getNearbyAgents(agent, agent.config.visionRange);
    }
  }
  getNearbyAgents(agent, range) {
    const nearby = [];
    for (const otherAgent of this.agents.values()) {
      if (otherAgent === agent) {
        continue;
      }
      const distance = agent.getDistanceTo(otherAgent.position);
      if (distance <= range) {
        nearby.push(otherAgent);
      }
    }
    return nearby;
  }
  getStats() {
    const agents = Array.from(this.agents.values());
    const activeAgents = agents.filter((agent) => agent["isActive"]);
    return {
      totalAgents: agents.length,
      activeAgents: activeAgents.length,
      maxAgentsPerFrame: this.maxAgentsPerFrame,
      averageUpdateTime:
        activeAgents.reduce((sum, agent) => sum + agent.getStats().averageUpdateTime, 0) /
        Math.max(activeAgents.length, 1),
    };
  }
  setMaxAgentsPerFrame(max) {
    this.maxAgentsPerFrame = Math.max(1, max);
  }
  dispose() {
    for (const agent of this.agents.values()) {
      agent.dispose();
    }
    this.agents.clear();
    this.updateQueue = [];
    this.currentIndex = 0;
  }
}
// Utility functions for creating common agent configurations
export function createBasicAgentConfig(id, position) {
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
    enableStateMachine: true,
  };
}
export function createFastAgentConfig(id, position) {
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
    enableStateMachine: true,
  };
}
//# sourceMappingURL=Agent.js.map
