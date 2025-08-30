/**
 * Minimal AI package exports for server compatibility
 */
// Core AI Registry and Router classes
export class AIRegistry {
    constructor() {
        this.providers = new Map();
    }
    register(p) {
        this.providers.set(p.name, p);
    }
    get(name) {
        return this.providers.get(name);
    }
    list() {
        return [...this.providers.values()];
    }
    byCapability(cap) {
        return this.list().filter((p) => p.capabilities().includes(cap));
    }
}
export class AIRouter {
    constructor(registry, policy = {}) {
        this.registry = registry;
        this.policy = policy;
    }
    pick(cap) {
        const candidates = this.registry
            .byCapability(cap)
            .filter((p) => !(this.policy.forbid ?? []).includes(p.name));
        if (candidates.length === 0)
            throw new Error(`No providers registered with capability ${cap}`);
        const preferred = (this.policy.preferred ?? []).find((n) => candidates.some((c) => c.name === n));
        if (preferred) {
            const found = candidates.find((c) => c.name === preferred);
            if (found)
                return found;
        }
        const weights = candidates.map((c) => ({
            p: c,
            w: this.policy.weights?.[c.name] ?? 1,
        }));
        const total = weights.reduce((s, x) => s + x.w, 0);
        let r = Math.random() * total;
        for (const { p, w } of weights) {
            r -= w;
            if (r <= 0)
                return p;
        }
        return candidates[0]; // Safe because we checked candidates.length > 0 above
    }
    async textToImage(req, ctx) {
        const p = this.pick("textToImage");
        if (!p.textToImage)
            throw new Error(`Provider ${p.name} lacks textToImage`);
        return p.textToImage(req, ctx);
    }
    async depth(req, ctx) {
        const p = this.pick("depth");
        if (!p.depth)
            throw new Error(`Provider ${p.name} lacks depth`);
        return p.depth(req, ctx);
    }
    async segmentation(req, ctx) {
        const p = this.pick("segmentation");
        if (!p.segmentation)
            throw new Error(`Provider ${p.name} lacks segmentation`);
        return p.segmentation(req, ctx);
    }
}
// Dummy provider for testing
export class DummyProvider {
    constructor() {
        this.name = "dummy";
    }
    capabilities() {
        return ["textToImage", "depth", "segmentation"];
    }
    async textToImage(req) {
        const start = Date.now();
        const w = req.width ?? 512;
        const h = req.height ?? 512;
        const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>` +
            `<rect width='100%' height='100%' fill='#222'/>` +
            `<text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#fff' font-size='16'>${(req.prompt || "prompt").slice(0, 64)}</text>` +
            `</svg>`;
        const uri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
        return {
            provider: this.name,
            model: "dummy-svg",
            costUSD: 0,
            latencyMs: Date.now() - start,
            image: { uri, width: w, height: h, mimeType: "image/svg+xml" },
        };
    }
    async depth(_) {
        const start = Date.now();
        const uri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";
        return {
            provider: this.name,
            model: "dummy-depth",
            costUSD: 0,
            latencyMs: Date.now() - start,
            depth: { uri, mimeType: "image/png" },
        };
    }
    async segmentation(_) {
        const start = Date.now();
        const uri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottQAAAABJRU5ErkJggg==";
        return {
            provider: this.name,
            model: "dummy-seg",
            costUSD: 0,
            latencyMs: Date.now() - start,
            mask: { uri, mimeType: "image/png" },
            classes: {},
        };
    }
}
export function createDefaultAIRouter(policy) {
    const registry = new AIRegistry();
    registry.register(new DummyProvider());
    return new AIRouter(registry, policy);
}
//# sourceMappingURL=index.js.map