import { BehaviorTree, Blackboard } from './BehaviorTree';
import { StateMachine } from './StateMachine';
import { Vector2 } from './Pathfinding';
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
    shortTerm: Map<string, {
        value: any;
        timestamp: number;
        decay: number;
    }>;
    longTerm: Map<string, any>;
    experiences: Array<{
        event: string;
        outcome: string;
        timestamp: number;
        importance: number;
    }>;
    maxShortTermSize: number;
    shortTermDecay: number;
}
export declare class Agent {
    readonly id: string;
    readonly name: string;
    config: AgentConfig;
    private behaviorTree;
    private stateMachine;
    private pathfinding;
    private blackboard;
    position: Vector2;
    velocity: Vector2;
    acceleration: Vector2;
    rotation: number;
    private perception;
    private memory;
    private goals;
    private currentGoal;
    private lastUpdate;
    private isActive;
    private updateCount;
    private totalUpdateTime;
    private lastUpdateTime;
    constructor(config: AgentConfig);
    setBehaviorTree(behaviorTree: BehaviorTree): void;
    setStateMachine(stateMachine: StateMachine): void;
    update(deltaTime: number): void;
    private updatePerception;
    private updateMemory;
    private updateGoals;
    private updateBlackboard;
    private updateMovement;
    addGoal(goal: Goal): void;
    removeGoal(goalId: string): void;
    completeGoal(goalId: string): void;
    getCurrentGoal(): Goal | null;
    rememberShortTerm(key: string, value: any, decay?: number): void;
    rememberLongTerm(key: string, value: any): void;
    recall(key: string): any;
    forget(key: string): void;
    rememberExperience(event: string, outcome: string, importance?: number): void;
    moveTo(target: Vector2): void;
    stop(): void;
    applyForce(force: Vector2): void;
    findPathTo(target: Vector2, gridId?: string): Vector2[];
    canSee(position: Vector2): boolean;
    getNearbyAgents(range?: number): Agent[];
    getDistanceTo(position: Vector2): number;
    getAngleTo(position: Vector2): number;
    setActive(active: boolean): void;
    getBlackboard(): Blackboard;
    getPerception(): AgentPerception;
    getMemory(): AgentMemory;
    getStats(): {
        id: string;
        name: string;
        position: Vector2;
        velocity: Vector2;
        rotation: number;
        isActive: boolean;
        updateCount: number;
        lastUpdateTime: number;
        averageUpdateTime: number;
        goalCount: number;
        currentGoal: string | null;
        shortTermMemorySize: number;
        longTermMemorySize: number;
        experienceCount: number;
        behaviorTreeActive: boolean;
        stateMachineActive: boolean;
    };
    getDebugInfo(): {
        perception: AgentPerception;
        goals: Goal[];
        blackboard: import("./BehaviorTree").BlackboardData;
        behaviorTreeDebug: any;
        stateMachineDebug: {
            currentState: string | null;
            stateCount: number;
            transitionCount: number;
            historySize: number;
            stateStats: {
                [k: string]: any;
            };
            isRunning: boolean;
        } | undefined;
        id: string;
        name: string;
        position: Vector2;
        velocity: Vector2;
        rotation: number;
        isActive: boolean;
        updateCount: number;
        lastUpdateTime: number;
        averageUpdateTime: number;
        goalCount: number;
        currentGoal: string | null;
        shortTermMemorySize: number;
        longTermMemorySize: number;
        experienceCount: number;
        behaviorTreeActive: boolean;
        stateMachineActive: boolean;
    };
    dispose(): void;
}
export declare class AgentManager {
    private agents;
    private updateQueue;
    private maxAgentsPerFrame;
    private currentIndex;
    createAgent(config: AgentConfig): Agent;
    getAgent(id: string): Agent | null;
    removeAgent(id: string): void;
    getAllAgents(): Agent[];
    getActiveAgents(): Agent[];
    update(deltaTime: number): void;
    updatePerception(): void;
    private getNearbyAgents;
    getStats(): {
        totalAgents: number;
        activeAgents: number;
        maxAgentsPerFrame: number;
        averageUpdateTime: number;
    };
    setMaxAgentsPerFrame(max: number): void;
    dispose(): void;
}
export declare function createBasicAgentConfig(_id: string, _position: Vector2): AgentConfig;
export declare function createFastAgentConfig(_id: string, _position: Vector2): AgentConfig;
//# sourceMappingURL=Agent.d.ts.map