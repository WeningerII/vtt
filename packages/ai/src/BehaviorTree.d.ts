export declare enum NodeStatus {
    SUCCESS = "SUCCESS",
    FAILURE = "FAILURE",
    RUNNING = "RUNNING",
    INVALID = "INVALID"
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
export declare abstract class BehaviorNode {
    protected name: string;
    protected parent: BehaviorNode | null;
    protected children: BehaviorNode[];
    protected status: NodeStatus;
    protected blackboard: Blackboard;
    protected executionCount: number;
    protected lastExecutionTime: number;
    protected totalExecutionTime: number;
    protected isRunning: boolean;
    constructor(name: string, blackboard: Blackboard);
    abstract tick(): NodeStatus;
    protected onEnter(): void;
    protected onExit(): void;
    protected onUpdate(): NodeStatus;
    execute(): NodeStatus;
    addChild(child: BehaviorNode): void;
    removeChild(child: BehaviorNode): void;
    reset(): void;
    getName(): string;
    getStatus(): NodeStatus;
    getChildren(): BehaviorNode[];
    getParent(): BehaviorNode | null;
    getExecutionCount(): number;
    getLastExecutionTime(): number;
    getTotalExecutionTime(): number;
    getAverageExecutionTime(): number;
}
export declare class SequenceNode extends BehaviorNode {
    private currentChildIndex;
    tick(): NodeStatus;
    reset(): void;
}
export declare class SelectorNode extends BehaviorNode {
    private currentChildIndex;
    tick(): NodeStatus;
    reset(): void;
}
export declare class ParallelNode extends BehaviorNode {
    private requiredSuccesses;
    private allowFailure;
    constructor(name: string, blackboard: Blackboard, requiredSuccesses?: number, allowFailure?: boolean);
    tick(): NodeStatus;
}
export declare class InverterNode extends BehaviorNode {
    tick(): NodeStatus;
}
export declare class RepeatNode extends BehaviorNode {
    private maxRepeats;
    private currentRepeats;
    constructor(name: string, blackboard: Blackboard, maxRepeats?: number);
    tick(): NodeStatus;
    reset(): void;
}
export declare class RetryNode extends BehaviorNode {
    private maxRetries;
    private currentRetries;
    constructor(name: string, blackboard: Blackboard, maxRetries?: number);
    tick(): NodeStatus;
    reset(): void;
}
export declare class TimeoutNode extends BehaviorNode {
    private timeoutMs;
    private startTime;
    constructor(name: string, blackboard: Blackboard, timeoutMs: number);
    protected onEnter(): void;
    tick(): NodeStatus;
}
export declare abstract class ActionNode extends BehaviorNode {
    tick(): NodeStatus;
}
export declare abstract class ConditionNode extends BehaviorNode {
    tick(): NodeStatus;
    protected abstract evaluate(): boolean;
}
export declare class Blackboard {
    private data;
    private observers;
    set<T>(key: string, value: T): void;
    get<T>(key: string, defaultValue?: T): T;
    has(key: string): boolean;
    delete(key: string): void;
    clear(): void;
    observe(_key: string, _callback: (value: any) => void): void;
    unobserve(_key: string, _callback: (value: any) => void): void;
    private notifyObservers;
    increment(key: string, amount?: number): number;
    decrement(key: string, amount?: number): number;
    toggle(key: string): boolean;
    getKeys(): string[];
    getData(): BlackboardData;
}
export declare class BehaviorTree {
    private root;
    private blackboard;
    private config;
    private isRunning;
    private tickCount;
    private lastTickTime;
    private totalTickTime;
    constructor(config?: Partial<BehaviorTreeConfig>);
    setRoot(root: BehaviorNode): void;
    getRoot(): BehaviorNode | null;
    getBlackboard(): Blackboard;
    tick(): NodeStatus;
    start(): void;
    stop(): void;
    reset(): void;
    findNodeByName(name: string): BehaviorNode | null;
    private findNodeByNameRecursive;
    getAllNodes(): BehaviorNode[];
    private collectNodesRecursive;
    getDebugInfo(): any;
    getNodeDebugInfo(): Array<{
        name: string;
        status: NodeStatus;
        executionCount: number;
        lastExecutionTime: number;
        averageExecutionTime: number;
    }>;
    private log;
    serialize(): any;
    private serializeNode;
    dispose(): void;
}
export declare class BehaviorTreeBuilder {
    private stack;
    private blackboard;
    constructor(blackboard: Blackboard);
    sequence(name: string): this;
    selector(name: string): this;
    parallel(name: string, requiredSuccesses?: number, allowFailure?: boolean): this;
    inverter(name: string): this;
    repeat(name: string, maxRepeats?: number): this;
    retry(name: string, maxRetries?: number): this;
    timeout(name: string, timeoutMs: number): this;
    action(_name: string, _actionFn: () => NodeStatus): this;
    condition(_name: string, _conditionFn: () => boolean): this;
    end(): this;
    build(): BehaviorNode | null;
    private addNode;
}
export declare function createBehaviorTreeBuilder(_blackboard?: Blackboard): BehaviorTreeBuilder;
//# sourceMappingURL=BehaviorTree.d.ts.map