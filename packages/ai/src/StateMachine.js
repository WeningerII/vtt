export class State {
  constructor(name) {
    // Timing
    this.enterTime = 0;
    this.totalTime = 0;
    this.executionCount = 0;
    this.name = name;
  }
  setMachine(machine) {
    this.machine = machine;
  }
  setContext(context) {
    this.context = context;
  }
  onEnter() {
    this.enterTime = Date.now();
    this.executionCount++;
  }
  onExit() {
    this.totalTime += Date.now() - this.enterTime;
  }
  getExecutionStats() {
    return {
      executionCount: this.executionCount,
      totalTime: this.totalTime,
      averageTime: this.executionCount > 0 ? this.totalTime / this.executionCount : 0,
      currentTime: Date.now() - this.enterTime,
    };
  }
}
export class StateMachine {
  constructor() {
    this.states = new Map();
    this.transitions = [];
    this.currentState = null;
    this.context = {};
    this.isRunning = false;
    // Debug and monitoring
    this.transitionHistory = [];
    this.maxHistorySize = 100;
  }
  addState(state) {
    state.setMachine(this);
    state.setContext(this.context);
    this.states.set(state.name, state);
  }
  removeState(stateName) {
    this.states.delete(stateName);
    this.transitions = this.transitions.filter((t) => t.from !== stateName && t.to !== stateName);
  }
  addTransition(transition) {
    this.transitions.push(transition);
    this.transitions.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }
  setState(stateName) {
    const newState = this.states.get(stateName);
    if (!newState) return false;
    const oldStateName = this.currentState?.name || "none";
    if (this.currentState) {
      this.currentState.onExit();
    }
    this.currentState = newState;
    this.currentState.onEnter();
    // Record transition
    this.recordTransition(oldStateName, stateName);
    return true;
  }
  getCurrentState() {
    return this.currentState;
  }
  getContext() {
    return this.context;
  }
  setContext(context) {
    this.context = { ...context };
    for (const state of this.states.values()) {
      state.setContext(this.context);
    }
  }
  updateContext(updates) {
    Object.assign(this.context, updates);
  }
  start(initialState) {
    if (!this.states.has(initialState)) return false;
    this.isRunning = true;
    return this.setState(initialState);
  }
  stop() {
    this.isRunning = false;
    if (this.currentState) {
      this.currentState.onExit();
      this.currentState = null;
    }
  }
  update(deltaTime) {
    if (!this.isRunning || !this.currentState) return;
    // Update current state
    this.currentState.onUpdate(deltaTime);
    // Check for transitions
    this.checkTransitions();
  }
  checkTransitions() {
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
  recordTransition(from, to) {
    this.transitionHistory.push({
      from,
      to,
      timestamp: Date.now(),
    });
    // Keep history within limits
    if (this.transitionHistory.length > this.maxHistorySize) {
      this.transitionHistory.shift();
    }
  }
  getTransitionHistory() {
    return [...this.transitionHistory];
  }
  getStats() {
    const stateStats = new Map();
    for (const [name, state] of this.states) {
      stateStats.set(name, state.getExecutionStats());
    }
    return {
      currentState: this.currentState?.name || null,
      stateCount: this.states.size,
      transitionCount: this.transitions.length,
      historySize: this.transitionHistory.length,
      stateStats: Object.fromEntries(stateStats),
      isRunning: this.isRunning,
    };
  }
  reset() {
    this.stop();
    this.transitionHistory = [];
    this.context = {};
  }
  dispose() {
    this.reset();
    this.states.clear();
    this.transitions = [];
  }
}
// Hierarchical State Machine
export class HierarchicalStateMachine extends StateMachine {
  constructor() {
    super(...arguments);
    this.subMachines = new Map();
    this.parentMachine = null;
  }
  addSubMachine(stateName, subMachine) {
    if (subMachine instanceof HierarchicalStateMachine) {
      subMachine.parentMachine = this;
    }
    this.subMachines.set(stateName, subMachine);
  }
  getSubMachine(stateName) {
    return this.subMachines.get(stateName) || null;
  }
  update(deltaTime) {
    super.update(deltaTime);
    // Update sub-machine if current state has one
    if (this.getCurrentState()) {
      const subMachine = this.subMachines.get(this.getCurrentState().name);
      if (subMachine) {
        subMachine.update(deltaTime);
      }
    }
  }
  setState(stateName) {
    const success = super.setState(stateName);
    if (success) {
      // Start sub-machine if it exists
      const subMachine = this.subMachines.get(stateName);
      if (subMachine) {
        // Find a default initial state (first state added)
        const firstState = Array.from(subMachine["states"].keys())[0];
        if (firstState) {
          subMachine.start(firstState);
        }
      }
    }
    return success;
  }
  getParent() {
    return this.parentMachine;
  }
  getFullStatePath() {
    const path = [];
    if (this.parentMachine) {
      path.push(...this.parentMachine.getFullStatePath());
    }
    if (this.getCurrentState()) {
      path.push(this.getCurrentState().name);
    }
    return path;
  }
}
// Utility States
export class IdleState extends State {
  constructor() {
    super("idle");
  }
  onUpdate(deltaTime) {
    // Do nothing - idle state
  }
}
export class DelayState extends State {
  constructor(name, duration, onComplete) {
    super(name);
    this.elapsed = 0;
    this.duration = duration;
    this.onComplete = onComplete;
  }
  onEnter() {
    super.onEnter();
    this.elapsed = 0;
  }
  onUpdate(deltaTime) {
    this.elapsed += deltaTime;
    if (this.elapsed >= this.duration) {
      if (this.onComplete) {
        this.onComplete();
      }
      // Transition logic would be handled by the state machine
    }
  }
  getProgress() {
    return Math.min(this.elapsed / this.duration, 1);
  }
}
export class ConditionalState extends State {
  constructor(name, condition, onTrue, onFalse) {
    super(name);
    this.condition = condition;
    this.onTrue = onTrue;
    this.onFalse = onFalse;
  }
  onUpdate(deltaTime) {
    if (this.condition(this.context)) {
      if (this.onTrue) this.onTrue();
    } else {
      if (this.onFalse) this.onFalse();
    }
  }
}
// State Machine Builder
export class StateMachineBuilder {
  constructor(machine) {
    this.machine = machine || new StateMachine();
  }
  state(state) {
    this.machine.addState(state);
    return this;
  }
  transition(from, to, condition, action) {
    this.machine.addTransition({ from, to, condition, action });
    return this;
  }
  context(context) {
    this.machine.setContext(context);
    return this;
  }
  build() {
    return this.machine;
  }
}
// Factory functions
export function createStateMachine() {
  return new StateMachineBuilder();
}
export function createHierarchicalStateMachine() {
  return new StateMachineBuilder(new HierarchicalStateMachine());
}
//# sourceMappingURL=StateMachine.js.map
