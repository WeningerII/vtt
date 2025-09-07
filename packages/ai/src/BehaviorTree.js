export const NodeStatus = {};
NodeStatus.SUCCESS = "SUCCESS";
NodeStatus.FAILURE = "FAILURE";
NodeStatus.RUNNING = "RUNNING";
NodeStatus.INVALID = "INVALID";
export class BehaviorNode {
  constructor(name, blackboard) {
    this.parent = null;
    this.children = [];
    this.status = NodeStatus.INVALID;
    // Debug and profiling
    this.executionCount = 0;
    this.lastExecutionTime = 0;
    this.totalExecutionTime = 0;
    this.isRunning = false;
    this.name = name;
    this.blackboard = blackboard;
  }
  onEnter() {}
  onExit() {}
  onUpdate() {
    return NodeStatus.SUCCESS;
  }
  execute() {
    const startTime = performance.now();
    if (this.status !== NodeStatus.RUNNING) {
      this.onEnter();
    }
    this.isRunning = true;
    this.status = this.tick();
    if (this.status !== NodeStatus.RUNNING) {
      this.isRunning = false;
      this.onExit();
    }
    this.executionCount++;
    this.lastExecutionTime = performance.now() - startTime;
    this.totalExecutionTime += this.lastExecutionTime;
    return this.status;
  }
  addChild(child) {
    child.parent = this;
    this.children.push(child);
  }
  getNodeStats(nodeName) {
    const node = this.findNodeByName(nodeName);
    if (!node) {
      return null;
    }
    return {
      name: node.getName(),
      status: node.getStatus(),
      executionCount: node.getExecutionCount(),
      lastExecutionTime: node.getLastExecutionTime(),
      totalExecutionTime: node.getTotalExecutionTime(),
      averageExecutionTime: node.getAverageExecutionTime(),
    };
  }
  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) {
      this.children[index].parent = null;
      this.children.splice(index, 1);
    }
  }
  reset() {
    this.status = NodeStatus.INVALID;
    this.isRunning = false;
    for (const child of this.children) {
      child.reset();
    }
  }
  // Getters
  getName() {
    return this.name;
  }
  getStatus() {
    return this.status;
  }
  getChildren() {
    return [...this.children];
  }
  getParent() {
    return this.parent;
  }
  getExecutionCount() {
    return this.executionCount;
  }
  getLastExecutionTime() {
    return this.lastExecutionTime;
  }
  getTotalExecutionTime() {
    return this.totalExecutionTime;
  }
  getAverageExecutionTime() {
    return this.executionCount > 0 ? this.totalExecutionTime / this.executionCount : 0;
  }
}
// Composite Nodes
export class SequenceNode extends BehaviorNode {
  constructor() {
    super(...arguments);
    this.currentChildIndex = 0;
  }
  tick() {
    while (this.currentChildIndex < this.children.length) {
      const status = this.children[this.currentChildIndex].execute();
      switch (status) {
        case NodeStatus.SUCCESS:
          this.currentChildIndex++;
          break;
        case NodeStatus.FAILURE:
          this.reset();
          return NodeStatus.FAILURE;
        case NodeStatus.RUNNING:
          return NodeStatus.RUNNING;
      }
    }
    this.reset();
    return NodeStatus.SUCCESS;
  }
  reset() {
    super.reset();
    this.currentChildIndex = 0;
  }
}
export class SelectorNode extends BehaviorNode {
  constructor() {
    super(...arguments);
    this.currentChildIndex = 0;
  }
  tick() {
    while (this.currentChildIndex < this.children.length) {
      const status = this.children[this.currentChildIndex].execute();
      switch (status) {
        case NodeStatus.SUCCESS:
          this.reset();
          return NodeStatus.SUCCESS;
        case NodeStatus.FAILURE:
          this.currentChildIndex++;
          break;
        case NodeStatus.RUNNING:
          return NodeStatus.RUNNING;
      }
    }
    this.reset();
    return NodeStatus.FAILURE;
  }
  reset() {
    super.reset();
    this.currentChildIndex = 0;
  }
}
export class ParallelNode extends BehaviorNode {
  constructor(name, blackboard, requiredSuccesses = -1, allowFailure = false) {
    super(name, blackboard);
    this.requiredSuccesses = requiredSuccesses === -1 ? this.children.length : requiredSuccesses;
    this.allowFailure = allowFailure;
  }
  tick() {
    let successCount = 0;
    let failureCount = 0;
    let runningCount = 0;
    for (const child of this.children) {
      const status = child?.execute();
      switch (status) {
        case NodeStatus.SUCCESS:
          successCount++;
          break;
        case NodeStatus.FAILURE:
          failureCount++;
          break;
        case NodeStatus.RUNNING:
          runningCount++;
          break;
      }
    }
    if (successCount >= this.requiredSuccesses) {
      return NodeStatus.SUCCESS;
    }
    if (!this.allowFailure && failureCount > 0) {
      return NodeStatus.FAILURE;
    }
    if (runningCount > 0) {
      return NodeStatus.RUNNING;
    }
    return NodeStatus.FAILURE;
  }
}
// Decorator Nodes
export class InverterNode extends BehaviorNode {
  tick() {
    if (this.children.length !== 1) {
      return NodeStatus.FAILURE;
    }
    const status = this.children[0]?.execute();
    switch (status) {
      case NodeStatus.SUCCESS:
        return NodeStatus.FAILURE;
      case NodeStatus.FAILURE:
        return NodeStatus.SUCCESS;
      case NodeStatus.RUNNING:
        return NodeStatus.RUNNING;
      default:
        return NodeStatus.FAILURE;
    }
  }
}
export class RepeatNode extends BehaviorNode {
  constructor(name, blackboard, maxRepeats = -1) {
    super(name, blackboard);
    this.currentRepeats = 0;
    this.maxRepeats = maxRepeats;
  }
  tick() {
    if (this.children.length !== 1) {
      return NodeStatus.FAILURE;
    }
    const child = this.children[0];
    const status = child.execute();
    if (status === NodeStatus.RUNNING) {
      return NodeStatus.RUNNING;
    }
    if (status === NodeStatus.SUCCESS) {
      this.currentRepeats++;
      if (this.maxRepeats > 0 && this.currentRepeats >= this.maxRepeats) {
        this.reset();
        return NodeStatus.SUCCESS;
      }
      child.reset();
      return NodeStatus.RUNNING;
    }
    return NodeStatus.FAILURE;
  }
  reset() {
    super.reset();
    this.currentRepeats = 0;
  }
}
export class RetryNode extends BehaviorNode {
  constructor(name, blackboard, maxRetries = 3) {
    super(name, blackboard);
    this.currentRetries = 0;
    this.maxRetries = maxRetries;
  }
  tick() {
    if (this.children.length !== 1) {
      return NodeStatus.FAILURE;
    }
    const child = this.children[0];
    const status = child.execute();
    if (status === NodeStatus.SUCCESS || status === NodeStatus.RUNNING) {
      return status;
    }
    if (status === NodeStatus.FAILURE) {
      this.currentRetries++;
      if (this.currentRetries >= this.maxRetries) {
        this.reset();
        return NodeStatus.FAILURE;
      }
      child.reset();
      return NodeStatus.RUNNING;
    }
    return NodeStatus.FAILURE;
  }
  reset() {
    super.reset();
    this.currentRetries = 0;
  }
}
export class TimeoutNode extends BehaviorNode {
  constructor(name, blackboard, timeoutMs) {
    super(name, blackboard);
    this.startTime = 0;
    this.timeoutMs = timeoutMs;
  }
  onEnter() {
    this.startTime = Date.now();
  }
  tick() {
    if (this.children.length !== 1) {
      return NodeStatus.FAILURE;
    }
    const elapsed = Date.now() - this.startTime;
    if (elapsed >= this.timeoutMs) {
      return NodeStatus.FAILURE;
    }
    const status = this.children[0]?.execute();
    if (status === NodeStatus.RUNNING) {
      return NodeStatus.RUNNING;
    }
    return status;
  }
}
// Leaf Nodes (Action and Condition)
export class ActionNode extends BehaviorNode {
  tick() {
    return this.onUpdate();
  }
}
export class ConditionNode extends BehaviorNode {
  tick() {
    return this.evaluate() ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
  }
}
// Blackboard for shared state
export class Blackboard {
  constructor() {
    this.data = {};
    this.observers = new Map();
  }
  set(key, value) {
    const oldValue = this.data[key];
    this.data[key] = value;
    if (oldValue !== value) {
      this.notifyObservers(key, value);
    }
  }
  get(key, defaultValue) {
    return this.data[key] !== undefined ? this.data[key] : defaultValue;
  }
  has(key) {
    return Object.prototype.hasOwnProperty.call(this.data, key);
  }
  delete(key) {
    delete this.data[key];
    this.notifyObservers(key, undefined);
  }
  clear() {
    this.data = {};
    this.observers.clear();
  }
  observe(key, callback) {
    if (!this.observers.has(key)) {
      this.observers.set(key, []);
    }
    this.observers.get(key).push(callback);
  }
  unobserve(key, callback) {
    const observers = this.observers.get(key);
    if (observers) {
      const index = observers.indexOf(callback);
      if (index >= 0) {
        observers.splice(index, 1);
      }
    }
  }
  notifyObservers(key, value) {
    const observers = this.observers.get(key);
    if (observers) {
      for (const observer of observers) {
        observer(value);
      }
    }
  }
  // Utility methods
  increment(key, amount = 1) {
    const current = this.get(key, 0);
    const newValue = current + amount;
    this.set(key, newValue);
    return newValue;
  }
  decrement(key, amount = 1) {
    return this.increment(key, -amount);
  }
  toggle(key) {
    const current = this.get(key, false);
    const newValue = !current;
    this.set(key, newValue);
    return newValue;
  }
  getKeys() {
    return Object.keys(this.data);
  }
  getData() {
    return { ...this.data };
  }
}
// Behavior Tree
export class BehaviorTree {
  constructor(config) {
    this.root = null;
    this.isRunning = false;
    this.tickCount = 0;
    this.lastTickTime = 0;
    this.totalTickTime = 0;
    this.blackboard = new Blackboard();
    this.config = {
      tickRate: 60, // Hz
      maxTicksPerFrame: 10,
      enableDebug: false,
      logLevel: "error",
      ...config,
    };
  }
  setRoot(root) {
    this.root = root;
  }
  getRoot() {
    return this.root;
  }
  getBlackboard() {
    return this.blackboard;
  }
  tick() {
    if (!this.root) {
      return NodeStatus.FAILURE;
    }
    const startTime = performance.now();
    const status = this.root.execute();
    this.tickCount++;
    this.lastTickTime = performance.now() - startTime;
    this.totalTickTime += this.lastTickTime;
    if (this.config.enableDebug) {
      this.log("debug", `Tick ${this.tickCount}: ${status} (${this.lastTickTime.toFixed(2)}ms)`);
    }
    return status;
  }
  start() {
    this.isRunning = true;
    this.log("info", "Behavior tree started");
  }
  stop() {
    this.isRunning = false;
    if (this.root) {
      this.root.reset();
    }
    this.log("info", "Behavior tree stopped");
  }
  reset() {
    if (this.root) {
      this.root.reset();
    }
    this.tickCount = 0;
    this.totalTickTime = 0;
    this.log("info", "Behavior tree reset");
  }
  // Tree traversal and utilities
  findNodeByName(name) {
    if (!this.root) {
      return null;
    }
    return this.findNodeByNameRecursive(this.root, name) ?? null;
  }
  findNodeByNameRecursive(node, name) {
    if (node.getName() === name) {
      return node;
    }
    for (const child of node.getChildren()) {
      const result = this.findNodeByNameRecursive(child, name);
      if (result) {
        return result;
      }
    }
    return null;
  }
  getAllNodes() {
    if (!this.root) {
      return [];
    }
    const nodes = [];
    this.collectNodesRecursive(this.root, nodes);
    return nodes;
  }
  collectNodesRecursive(node, nodes) {
    nodes.push(node);
    for (const child of node.getChildren()) {
      this.collectNodesRecursive(child, nodes);
    }
  }
  // Debugging and profiling
  getDebugInfo() {
    return {
      tickCount: this.tickCount,
      lastTickTime: this.lastTickTime,
      totalTickTime: this.totalTickTime,
      averageTickTime: this.tickCount > 0 ? this.totalTickTime / this.tickCount : 0,
      isRunning: this.isRunning,
      nodeCount: this.getAllNodes().length,
      blackboardKeys: this.blackboard.getKeys().length,
    };
  }
  getNodeDebugInfo() {
    return this.getAllNodes().map((node) => ({
      name: node.getName(),
      status: node.getStatus(),
      executionCount: node.getExecutionCount(),
      lastExecutionTime: node.getLastExecutionTime(),
      averageExecutionTime: node.getAverageExecutionTime(),
    }));
  }
  log(level, message) {
    const levels = ["none", "error", "warn", "info", "debug"];
    const currentLevel = levels.indexOf(this.config.logLevel);
    const messageLevel = levels.indexOf(level);
    if (messageLevel <= currentLevel) {
      console.log(`[BehaviorTree:${level.toUpperCase()}] ${message}`);
    }
  }
  // Serialization
  serialize() {
    if (!this.root) {
      return null;
    }
    return this.serializeNode(this.root);
  }
  serializeNode(node) {
    return {
      name: node.getName(),
      type: node.constructor.name,
      children: node.getChildren().map((child) => this.serializeNode(child)),
    };
  }
  dispose() {
    this.stop();
    this.blackboard.clear();
    this.root = null;
  }
}
// Builder pattern for easier tree construction
export class BehaviorTreeBuilder {
  constructor(blackboard) {
    this.stack = [];
    this.blackboard = blackboard;
  }
  sequence(name) {
    const node = new SequenceNode(name, this.blackboard);
    this.addNode(node);
    return this;
  }
  selector(name) {
    const node = new SelectorNode(name, this.blackboard);
    this.addNode(node);
    return this;
  }
  parallel(name, requiredSuccesses, allowFailure) {
    const node = new ParallelNode(name, this.blackboard, requiredSuccesses, allowFailure);
    this.addNode(node);
    return this;
  }
  inverter(name) {
    const node = new InverterNode(name, this.blackboard);
    this.addNode(node);
    return this;
  }
  repeat(name, maxRepeats) {
    const node = new RepeatNode(name, this.blackboard, maxRepeats);
    this.addNode(node);
    return this;
  }
  retry(name, maxRetries) {
    const node = new RetryNode(name, this.blackboard, maxRetries);
    this.addNode(node);
    return this;
  }
  timeout(name, timeoutMs) {
    const node = new TimeoutNode(name, this.blackboard, timeoutMs);
    this.addNode(node);
    return this;
  }
  action(name, actionFn) {
    const node = new (class extends ActionNode {
      onUpdate() {
        return actionFn();
      }
    })(name, this.blackboard);
    this.addNode(node);
    return this;
  }
  condition(name, conditionFn) {
    const node = new (class extends ConditionNode {
      evaluate() {
        return conditionFn();
      }
    })(name, this.blackboard);
    this.addNode(node);
    return this;
  }
  end() {
    if (this.stack.length > 0) {
      this.stack.pop();
    }
    return this;
  }
  build() {
    return this.stack.length > 0 ? this.stack[0] : null;
  }
  addNode(node) {
    if (this.stack.length > 0) {
      this.stack[this.stack.length - 1].addChild(node);
    }
    this.stack.push(node);
  }
}
// Utility function to create a builder
export function createBehaviorTreeBuilder(blackboard) {
  return new BehaviorTreeBuilder(blackboard || new Blackboard());
}
//# sourceMappingURL=BehaviorTree.js.map
