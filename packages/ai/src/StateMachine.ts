export interface StateContext {
  [key: string]: any;
}

export interface StateTransition {
  from: string;
  to: string;
  condition?: (_context: StateContext) => boolean;
  action?: (_context: StateContext) => void;
  priority?: number;
}

export abstract class State {
  public readonly name: string;
  protected context: StateContext;
  protected machine: StateMachine;
  
  // Timing
  protected enterTime = 0;
  protected totalTime = 0;
  protected executionCount = 0;
  
  constructor(name: string) {
    this.name = name;
  }
  
  public setMachine(machine: StateMachine): void {
    this.machine = machine;
  }
  
  public setContext(context: StateContext): void {
    this.context = context;
  }
  
  public onEnter(): void {
    this.enterTime = Date.now();
    this.executionCount++;
  }
  
  public onExit(): void {
    this.totalTime += Date.now() - this.enterTime;
  }
  
  public abstract onUpdate(deltaTime: number): void;
  
  public getExecutionStats() {
    return {
      executionCount: this.executionCount,
      totalTime: this.totalTime,
      averageTime: this.executionCount > 0 ? this.totalTime / this.executionCount : 0,
      currentTime: Date.now() - this.enterTime
    };
  }
}

export class StateMachine {
  private states = new Map<string, State>();
  private transitions: StateTransition[] = [];
  private currentState: State | null = null;
  private context: StateContext = {};
  private isRunning = false;
  
  // Debug and monitoring
  private transitionHistory: Array<{ from: string; to: string; timestamp: number }> = [];
  private maxHistorySize = 100;
  
  public addState(state: State): void {
    state.setMachine(this);
    state.setContext(this.context);
    this.states.set(state.name, state);
  }
  
  public removeState(stateName: string): void {
    this.states.delete(stateName);
    this.transitions = this.transitions.filter(
      t => t.from !== stateName && t.to !== stateName
    );
  }
  
  public addTransition(transition: StateTransition): void {
    this.transitions.push(transition);
    this.transitions.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }
  
  public setState(stateName: string): boolean {
    const newState = this.states.get(stateName);
    if (!newState) return false;
    
    const oldStateName = this.currentState?.name || 'none';
    
    if (this.currentState) {
      this.currentState.onExit();
    }
    
    this.currentState = newState;
    this.currentState.onEnter();
    
    // Record transition
    this.recordTransition(oldStateName, stateName);
    
    return true;
  }
  
  public getCurrentState(): State | null {
    return this.currentState;
  }
  
  public getContext(): StateContext {
    return this.context;
  }
  
  public setContext(context: StateContext): void {
    this.context = { ...context };
    for (const state of this.states.values()) {
      state.setContext(this.context);
    }
  }
  
  public updateContext(updates: Partial<StateContext>): void {
    Object.assign(this.context, updates);
  }
  
  public start(initialState: string): boolean {
    if (!this.states.has(initialState)) return false;
    
    this.isRunning = true;
    return this.setState(initialState);
  }
  
  public stop(): void {
    this.isRunning = false;
    if (this.currentState) {
      this.currentState.onExit();
      this.currentState = null;
    }
  }
  
  public update(deltaTime: number): void {
    if (!this.isRunning || !this.currentState) return;
    
    // Update current state
    this.currentState.onUpdate(deltaTime);
    
    // Check for transitions
    this.checkTransitions();
  }
  
  private checkTransitions(): void {
    if (!this.currentState) return;
    
    for (const transition of this.transitions) {
      if (transition.from !== this.currentState.name) continue;
      
      if (!transition.condition || transition.condition(this.context)) {
        if (transition.action) {
          transition.action(this.context);
        }
        
        this.setState(transition.to);
        break; // Only execute first valid transition
      }
    }
  }
  
  private recordTransition(from: string, to: string): void {
    this.transitionHistory.push({
      from,
      to,
      timestamp: Date.now()
    });
    
    // Keep history within limits
    if (this.transitionHistory.length > this.maxHistorySize) {
      this.transitionHistory.shift();
    }
  }
  
  public getTransitionHistory(): Array<{ from: string; to: string; timestamp: number }> {
    return [...this.transitionHistory];
  }
  
  public getStats() {
    const stateStats = new Map<string, any>();
    
    for (const [name, state] of this.states) {
      stateStats.set(name, state.getExecutionStats());
    }
    
    return {
      currentState: this.currentState?.name || null,
      stateCount: this.states.size,
      transitionCount: this.transitions.length,
      historySize: this.transitionHistory.length,
      stateStats: Object.fromEntries(stateStats),
      isRunning: this.isRunning
    };
  }
  
  public reset(): void {
    this.stop();
    this.transitionHistory = [];
    this.context = {};
  }
  
  public dispose(): void {
    this.reset();
    this.states.clear();
    this.transitions = [];
  }
}

// Hierarchical State Machine
export class HierarchicalStateMachine extends StateMachine {
  private subMachines = new Map<string, StateMachine>();
  private parentMachine: HierarchicalStateMachine | null = null;
  
  public addSubMachine(stateName: string, subMachine: StateMachine): void {
    if (subMachine instanceof HierarchicalStateMachine) {
      subMachine.parentMachine = this;
    }
    this.subMachines.set(stateName, subMachine);
  }
  
  public getSubMachine(stateName: string): StateMachine | null {
    return this.subMachines.get(stateName) || null;
  }
  
  public update(deltaTime: number): void {
    super.update(deltaTime);
    
    // Update sub-machine if current state has one
    if (this.getCurrentState()) {
      const subMachine = this.subMachines.get(this.getCurrentState()!.name);
      if (subMachine) {
        subMachine.update(deltaTime);
      }
    }
  }
  
  public setState(stateName: string): boolean {
    const success = super.setState(stateName);
    
    if (success) {
      // Start sub-machine if it exists
      const subMachine = this.subMachines.get(stateName);
      if (subMachine) {
        // Find a default initial state (first state added)
        const firstState = Array.from(subMachine['states'].keys())[0];
        if (firstState) {
          subMachine.start(firstState);
        }
      }
    }
    
    return success;
  }
  
  public getParent(): HierarchicalStateMachine | null {
    return this.parentMachine;
  }
  
  public getFullStatePath(): string[] {
    const path: string[] = [];
    
    if (this.parentMachine) {
      path.push(...this.parentMachine.getFullStatePath());
    }
    
    if (this.getCurrentState()) {
      path.push(this.getCurrentState()!.name);
    }
    
    return path;
  }
}

// Utility States
export class IdleState extends State {
  constructor() {
    super('idle');
  }
  
  public onUpdate(_deltaTime: number): void {
    // Do nothing - idle state
  }
}

export class DelayState extends State {
  private duration: number;
  private elapsed = 0;
  private onComplete?: () => void;
  
  constructor(_name: string, _duration: number, _onComplete?: () => void) {
    super(name);
    this.duration = duration;
    this.onComplete = onComplete;
  }
  
  public onEnter(): void {
    super.onEnter();
    this.elapsed = 0;
  }
  
  public onUpdate(deltaTime: number): void {
    this.elapsed += deltaTime;
    
    if (this.elapsed >= this.duration) {
      if (this.onComplete) {
        this.onComplete();
      }
      // Transition logic would be handled by the state machine
    }
  }
  
  public getProgress(): number {
    return Math.min(this.elapsed / this.duration, 1);
  }
}

export class ConditionalState extends State {
  private condition: (_context: StateContext) => boolean;
  private onTrue?: () => void;
  private onFalse?: () => void;
  
  constructor(
    _name: string, 
    _condition: (context: StateContext) => boolean,
    onTrue?: () => void,
    onFalse?: () => void
  ) {
    super(name);
    this.condition = condition;
    this.onTrue = onTrue;
    this.onFalse = onFalse;
  }
  
  public onUpdate(_deltaTime: number): void {
    if (this.condition(this.context)) {
      if (this.onTrue) this.onTrue();
    } else {
      if (this.onFalse) this.onFalse();
    }
  }
}

// State Machine Builder
export class StateMachineBuilder {
  private machine: StateMachine;
  
  constructor(machine?: StateMachine) {
    this.machine = machine || new StateMachine();
  }
  
  public state(state: State): this {
    this.machine.addState(state);
    return this;
  }
  
  public transition(_from: string, _to: string, _condition?: (context: StateContext) => boolean, action?: (_context: StateContext) => void): this {
    this.machine.addTransition({ from, to, condition, action });
    return this;
  }
  
  public context(context: StateContext): this {
    this.machine.setContext(context);
    return this;
  }
  
  public build(): StateMachine {
    return this.machine;
  }
}

// Factory functions
export function createStateMachine(): StateMachineBuilder {
  return new StateMachineBuilder();
}

export function createHierarchicalStateMachine(): StateMachineBuilder {
  return new StateMachineBuilder(new HierarchicalStateMachine());
}
