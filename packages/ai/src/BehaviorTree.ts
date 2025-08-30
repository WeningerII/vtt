import { logger } from '@vtt/logging';

export enum NodeStatus {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
  RUNNING = 'RUNNING',
  INVALID = 'INVALID'
}

export interface BlackboardData {
  [key: string]: any;
}

export interface BehaviorTreeConfig {
  tickRate: number;
  maxTicksPerFrame: number;
  enableDebug: boolean;
  logLevel: 'none' | 'error' | 'warn' | 'info' | 'debug';
}

export abstract class BehaviorNode {
  protected name: string;
  protected parent: BehaviorNode | null = null;
  protected children: BehaviorNode[] = [];
  protected status: NodeStatus = NodeStatus.INVALID;
  protected blackboard: Blackboard;
  
  // Debug and profiling
  protected executionCount = 0;
  protected lastExecutionTime = 0;
  protected totalExecutionTime = 0;
  protected isRunning = false;
  
  constructor(name: string, blackboard: Blackboard) {
    this.name = name;
    this.blackboard = blackboard;
  }

  abstract tick(): NodeStatus;

  protected onEnter(): void {}
  protected onExit(): void {}
  protected onUpdate(): NodeStatus { return NodeStatus.SUCCESS; }

  public execute(): NodeStatus {
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

  public addChild(child: BehaviorNode): void {
    child.parent = this;
    this.children.push(child);
  }

  public removeChild(child: BehaviorNode): void {
    const index = this.children.indexOf(child);
    if (index >= 0) {
      this.children[index].parent = null;
      this.children.splice(index, 1);
    }
  }

  public reset(): void {
    this.status = NodeStatus.INVALID;
    this.isRunning = false;
    for (const child of this.children) {
      child.reset();
    }
  }

  // Getters
  public getName(): string { return this.name; }
  public getStatus(): NodeStatus { return this.status; }
  public getChildren(): BehaviorNode[] { return [...this.children]; }
  public getParent(): BehaviorNode | null { return this.parent; }
  public getExecutionCount(): number { return this.executionCount; }
  public getLastExecutionTime(): number { return this.lastExecutionTime; }
  public getTotalExecutionTime(): number { return this.totalExecutionTime; }
  public getAverageExecutionTime(): number { 
    return this.executionCount > 0 ? this.totalExecutionTime / this.executionCount : 0;
  }
}

// Composite Nodes
export class SequenceNode extends BehaviorNode {
  private currentChildIndex = 0;

  tick(): NodeStatus {
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

  reset(): void {
    super.reset();
    this.currentChildIndex = 0;
  }
}

export class SelectorNode extends BehaviorNode {
  private currentChildIndex = 0;

  tick(): NodeStatus {
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

  reset(): void {
    super.reset();
    this.currentChildIndex = 0;
  }
}

export class ParallelNode extends BehaviorNode {
  private requiredSuccesses: number;
  private allowFailure: boolean;

  constructor(name: string, blackboard: Blackboard, requiredSuccesses: number = -1, allowFailure: boolean = false) {
    super(name, blackboard);
    this.requiredSuccesses = requiredSuccesses === -1 ? this.children.length : requiredSuccesses;
    this.allowFailure = allowFailure;
  }

  override tick(): NodeStatus {
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
  override tick(): NodeStatus {
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
  private maxRepeats: number;
  private currentRepeats = 0;

  constructor(name: string, blackboard: Blackboard, maxRepeats: number = -1) {
    super(name, blackboard);
    this.maxRepeats = maxRepeats;
  }

  tick(): NodeStatus {
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

  reset(): void {
    super.reset();
    this.currentRepeats = 0;
  }
}

export class RetryNode extends BehaviorNode {
  private maxRetries: number;
  private currentRetries = 0;

  constructor(name: string, blackboard: Blackboard, maxRetries: number = 3) {
    super(name, blackboard);
    this.maxRetries = maxRetries;
  }

  tick(): NodeStatus {
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

  reset(): void {
    super.reset();
    this.currentRetries = 0;
  }
}

export class TimeoutNode extends BehaviorNode {
  private timeoutMs: number;
  private startTime = 0;

  constructor(name: string, blackboard: Blackboard, timeoutMs: number) {
    super(name, blackboard);
    this.timeoutMs = timeoutMs;
  }

  protected onEnter(): void {
    this.startTime = Date.now();
  }

  override tick(): NodeStatus {
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
export abstract class ActionNode extends BehaviorNode {
  override tick(): NodeStatus {
    return this.onUpdate();
  }
}

export abstract class ConditionNode extends BehaviorNode {
  override tick(): NodeStatus {
    return this.evaluate() ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
  }

  protected abstract evaluate(): boolean;
}

// Blackboard for shared state
export class Blackboard {
  private data: BlackboardData = {};
  private observers = new Map<string, Array<(_value: any) => void>>();

  set<T>(key: string, value: T): void {
    const oldValue = this.data[key];
    this.data[key] = value;
    
    if (oldValue !== value) {
      this.notifyObservers(key, value);
    }
  }

  get<T>(key: string, defaultValue?: T): T {
    return this.data[key] !== undefined ? this.data[key] : defaultValue!;
  }

  has(key: string): boolean {
    return this.Object.prototype.hasOwnProperty.call(data, key);
  }

  delete(key: string): void {
    delete this.data[key];
    this.notifyObservers(key, undefined);
  }

  clear(): void {
    this.data = {};
    this.observers.clear();
  }

  observe(_key: string, _callback: (value: any) => void): void {
    if (!this.observers.has(key)) {
      this.observers.set(key, []);
    }
    this.observers.get(key)!.push(callback);
  }

  unobserve(_key: string, _callback: (value: any) => void): void {
    const observers = this.observers.get(key);
    if (observers) {
      const index = observers.indexOf(callback);
      if (index >= 0) {
        observers.splice(index, 1);
      }
    }
  }

  private notifyObservers(key: string, value: any): void {
    const observers = this.observers.get(key);
    if (observers) {
      for (const observer of observers) {
        observer(value);
      }
    }
  }

  // Utility methods
  increment(key: string, amount: number = 1): number {
    const current = this.get<number>(key, 0);
    const newValue = current + amount;
    this.set(key, newValue);
    return newValue;
  }

  decrement(key: string, amount: number = 1): number {
    return this.increment(key, -amount);
  }

  toggle(key: string): boolean {
    const current = this.get<boolean>(key, false);
    const newValue = !current;
    this.set(key, newValue);
    return newValue;
  }

  getKeys(): string[] {
    return Object.keys(this.data);
  }

  getData(): BlackboardData {
    return { ...this.data };
  }
}

// Behavior Tree
export class BehaviorTree {
  private root: BehaviorNode | null = null;
  private blackboard: Blackboard;
  private config: BehaviorTreeConfig;
  private isRunning = false;
  private tickCount = 0;
  private lastTickTime = 0;
  private totalTickTime = 0;
  
  constructor(config?: Partial<BehaviorTreeConfig>) {
    this.blackboard = new Blackboard();
    this.config = {
      tickRate: 60, // Hz
      maxTicksPerFrame: 10,
      enableDebug: false,
      logLevel: 'error',
      ...config
    };
  }

  setRoot(root: BehaviorNode): void {
    this.root = root;
  }

  getRoot(): BehaviorNode | null {
    return this.root;
  }

  getBlackboard(): Blackboard {
    return this.blackboard;
  }

  tick(): NodeStatus {
    if (!this.root) {
      return NodeStatus.FAILURE;
    }
    
    const startTime = performance.now();
    
    const status = this.root.execute();
    
    this.tickCount++;
    this.lastTickTime = performance.now() - startTime;
    this.totalTickTime += this.lastTickTime;
    
    if (this.config.enableDebug) {
      this.log('debug', `Tick ${this.tickCount}: ${status} (${this.lastTickTime.toFixed(2)}ms)`);
    }
    
    return status;
  }

  start(): void {
    this.isRunning = true;
    this.log('info', 'Behavior tree started');
  }

  stop(): void {
    this.isRunning = false;
    if (this.root) {
      this.root.reset();
    }
    this.log('info', 'Behavior tree stopped');
  }

  reset(): void {
    if (this.root) {
      this.root.reset();
    }
    this.tickCount = 0;
    this.totalTickTime = 0;
    this.log('info', 'Behavior tree reset');
  }

  // Tree traversal and utilities
  findNodeByName(name: string): BehaviorNode | null {
    if (!this.root) return null;
    return this.findNodeByNameRecursive(this.root, name) ?? null;
  }

  private findNodeByNameRecursive(node: BehaviorNode, name: string): BehaviorNode | null {
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

  getAllNodes(): BehaviorNode[] {
    if (!this.root) return [];
    
    const nodes: BehaviorNode[] = [];
    this.collectNodesRecursive(this.root, nodes);
    return nodes;
  }

  private collectNodesRecursive(node: BehaviorNode, nodes: BehaviorNode[]): void {
    nodes.push(node);
    for (const child of node.getChildren()) {
      this.collectNodesRecursive(child, nodes);
    }
  }

  // Debugging and profiling
  getDebugInfo(): any {
    return {
      tickCount: this.tickCount,
      lastTickTime: this.lastTickTime,
      totalTickTime: this.totalTickTime,
      averageTickTime: this.tickCount > 0 ? this.totalTickTime / this.tickCount : 0,
      isRunning: this.isRunning,
      nodeCount: this.getAllNodes().length,
      blackboardKeys: this.blackboard.getKeys().length
    };
  }

  getNodeDebugInfo(): Array<{
    name: string;
    status: NodeStatus;
    executionCount: number;
    lastExecutionTime: number;
    averageExecutionTime: number;
  }> {
    return this.getAllNodes().map(node => ({
      name: node.getName(),
      status: node.getStatus(),
      executionCount: node.getExecutionCount(),
      lastExecutionTime: node.getLastExecutionTime(),
      averageExecutionTime: node.getAverageExecutionTime()
    }));
  }

  private log(level: string, message: string): void {
    const levels = ['none', 'error', 'warn', 'info', 'debug'];
    const currentLevel = levels.indexOf(this.config.logLevel);
    const messageLevel = levels.indexOf(level);
    
    if (messageLevel <= currentLevel) {
      logger.info(`[BehaviorTree:${level.toUpperCase()}] ${message}`);
    }
  }

  // Serialization
  serialize(): any {
    if (!this.root) return null;
    return this.serializeNode(this.root);
  }

  private serializeNode(node: BehaviorNode): any {
    return {
      name: node.getName(),
      type: node.constructor.name,
      children: node.getChildren().map(child => this.serializeNode(child))
    };
  }

  dispose(): void {
    this.stop();
    this.blackboard.clear();
    this.root = null;
  }
}

// Builder pattern for easier tree construction
export class BehaviorTreeBuilder {
  private stack: BehaviorNode[] = [];
  private blackboard: Blackboard;

  constructor(blackboard: Blackboard) {
    this.blackboard = blackboard;
  }

  sequence(name: string): this {
    const node = new SequenceNode(name, this.blackboard);
    this.addNode(node);
    return this;
  }

  selector(name: string): this {
    const node = new SelectorNode(name, this.blackboard);
    this.addNode(node);
    return this;
  }

  parallel(name: string, requiredSuccesses?: number, allowFailure?: boolean): this {
    const node = new ParallelNode(name, this.blackboard, requiredSuccesses, allowFailure);
    this.addNode(node);
    return this;
  }

  inverter(name: string): this {
    const node = new InverterNode(name, this.blackboard);
    this.addNode(node);
    return this;
  }

  repeat(name: string, maxRepeats?: number): this {
    const node = new RepeatNode(name, this.blackboard, maxRepeats);
    this.addNode(node);
    return this;
  }

  retry(name: string, maxRetries?: number): this {
    const node = new RetryNode(name, this.blackboard, maxRetries);
    this.addNode(node);
    return this;
  }

  timeout(name: string, timeoutMs: number): this {
    const node = new TimeoutNode(name, this.blackboard, timeoutMs);
    this.addNode(node);
    return this;
  }

  action(_name: string, _actionFn: () => NodeStatus): this {
    const node = new (class extends ActionNode {
      protected override onUpdate(): NodeStatus {
        return actionFn();
      }
    })(name, this.blackboard);
    this.addNode(node);
    return this;
  }

  condition(_name: string, _conditionFn: () => boolean): this {
    const node = new (class extends ConditionNode {
      protected evaluate(): boolean {
        return conditionFn();
      }
    })(name, this.blackboard);
    this.addNode(node);
    return this;
  }

  end(): this {
    if (this.stack.length > 0) {
      this.stack.pop();
    }
    return this;
  }

  build(): BehaviorNode | null {
    return this.stack.length > 0 ? this.stack[0] : null;
  }

  private addNode(node: BehaviorNode): void {
    if (this.stack.length > 0) {
      this.stack[this.stack.length - 1].addChild(node);
    }
    this.stack.push(node);
  }
}

// Utility function to create a builder
export function createBehaviorTreeBuilder(_blackboard?: Blackboard): BehaviorTreeBuilder {
  return new BehaviorTreeBuilder(blackboard || new Blackboard());
}
