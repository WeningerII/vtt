/**
 * Exported API for the AI package. At present we include simple
 * placeholders for behavior tree and utility AI. These serve only to
 * illustrate how one might organise these systems.
 */
export class SequenceNode {
    constructor(children) {
        this.children = children;
    }
    tick() {
        return this.children.every(child => child.tick());
    }
}
export class SelectorNode {
    constructor(children) {
        this.children = children;
    }
    tick() {
        return this.children.some(child => child.tick());
    }
}
export class UtilityAI {
    evaluate(options) {
        let best;
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
//# sourceMappingURL=index.js.map