/**
 * Exported API for the AI package. At present we include simple
 * placeholders for behavior tree and utility AI. These serve only to
 * illustrate how one might organise these systems.
 */
export interface BehaviorTreeNode {
    tick(): boolean;
}
export declare class SequenceNode implements BehaviorTreeNode {
    private children;
    constructor(children: BehaviorTreeNode[]);
    tick(): boolean;
}
export declare class SelectorNode implements BehaviorTreeNode {
    private children;
    constructor(children: BehaviorTreeNode[]);
    tick(): boolean;
}
export declare class UtilityAI {
    evaluate(options: Record<string, number>): string | undefined;
}
//# sourceMappingURL=index.d.ts.map