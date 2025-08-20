/**
 * Exported API for the AI package. At present we include simple
 * placeholders for behavior tree and utility AI. These serve only to
 * illustrate how one might organise these systems.
 */

export interface BehaviorTreeNode {
  tick(): boolean;
}

export class SequenceNode implements BehaviorTreeNode {
  constructor(private children: BehaviorTreeNode[]) {}
  tick(): boolean {
    return this.children.every(child => child.tick());
  }
}

export class SelectorNode implements BehaviorTreeNode {
  constructor(private children: BehaviorTreeNode[]) {}
  tick(): boolean {
    return this.children.some(child => child.tick());
  }
}

export class UtilityAI {
  evaluate(options: Record<string, number>): string | undefined {
    let best: string | undefined;
    let bestScore = -Infinity;
    for (const [option, score] of Object.entries(options)) {
      if (score > bestScore) {
        bestScore = score;
        best = option;
      }
    }
    return best;
  }
}