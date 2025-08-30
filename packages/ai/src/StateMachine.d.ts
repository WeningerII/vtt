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
export declare abstract class State {
  readonly name: string;
  protected context: StateContext;
  protected machine: StateMachine;
  protected enterTime: number;
  protected totalTime: number;
  protected executionCount: number;
  constructor(name: string);
  setMachine(machine: StateMachine): void;
  setContext(context: StateContext): void;
  onEnter(): void;
  onExit(): void;
  abstract onUpdate(deltaTime: number): void;
  getExecutionStats(): {
    executionCount: number;
    totalTime: number;
    averageTime: number;
    currentTime: number;
  };
}
export declare class StateMachine {
  private states;
  private transitions;
  private currentState;
  private context;
  private isRunning;
  private transitionHistory;
  private maxHistorySize;
  addState(state: State): void;
  removeState(stateName: string): void;
  addTransition(transition: StateTransition): void;
  setState(stateName: string): boolean;
  getCurrentState(): State | null;
  getContext(): StateContext;
  setContext(context: StateContext): void;
  updateContext(updates: Partial<StateContext>): void;
  start(initialState: string): boolean;
  stop(): void;
  update(deltaTime: number): void;
  private checkTransitions;
  private recordTransition;
  getTransitionHistory(): Array<{
    from: string;
    to: string;
    timestamp: number;
  }>;
  getStats(): {
    currentState: string | null;
    stateCount: number;
    transitionCount: number;
    historySize: number;
    stateStats: {
      [k: string]: any;
    };
    isRunning: boolean;
  };
  reset(): void;
  dispose(): void;
}
export declare class HierarchicalStateMachine extends StateMachine {
  private subMachines;
  private parentMachine;
  addSubMachine(stateName: string, subMachine: StateMachine): void;
  getSubMachine(stateName: string): StateMachine | null;
  update(deltaTime: number): void;
  setState(stateName: string): boolean;
  getParent(): HierarchicalStateMachine | null;
  getFullStatePath(): string[];
}
export declare class IdleState extends State {
  constructor();
  onUpdate(deltaTime: number): void;
}
export declare class DelayState extends State {
  private duration;
  private elapsed;
  private onComplete?;
  constructor(_name: string, _duration: number, _onComplete?: () => void);
  onEnter(): void;
  onUpdate(deltaTime: number): void;
  getProgress(): number;
}
export declare class ConditionalState extends State {
  private condition;
  private onTrue?;
  private onFalse?;
  constructor(
    _name: string,
    _condition: (context: StateContext) => boolean,
    onTrue?: () => void,
    onFalse?: () => void,
  );
  onUpdate(deltaTime: number): void;
}
export declare class StateMachineBuilder {
  private machine;
  constructor(machine?: StateMachine);
  state(state: State): this;
  transition(
    _from: string,
    _to: string,
    _condition?: (context: StateContext) => boolean,
    action?: (_context: StateContext) => void,
  ): this;
  context(context: StateContext): this;
  build(): StateMachine;
}
export declare function createStateMachine(): StateMachineBuilder;
export declare function createHierarchicalStateMachine(): StateMachineBuilder;
//# sourceMappingURL=StateMachine.d.ts.map
