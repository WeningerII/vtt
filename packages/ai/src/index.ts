/**
 * Minimal AI package exports for server compatibility
 */

// Core AI Registry and Router classes
export class AIRegistry {
  private providers = new Map<string, AIProvider>();

  register(p: AIProvider): void {
    this.providers.set(p.name, p);
  }

  get(name: string): AIProvider | undefined {
    return this.providers.get(name);
  }

  list(): AIProvider[] {
    return [...this.providers.values()];
  }

  byCapability(cap: "textToImage" | "depth" | "segmentation"): AIProvider[] {
    return this.list().filter((p) => p.capabilities().includes(cap));
  }
}

export type RoutingPolicy = {
  weights?: Record<string, number>;
  preferred?: string[];
  forbid?: string[];
};

export class AIRouter {
  constructor(
    private registry: AIRegistry,
    private policy: RoutingPolicy = {},
  ) {}

  private pick(cap: "textToImage" | "depth" | "segmentation"): AIProvider {
    const candidates = this.registry
      .byCapability(cap)
      .filter((p) => !(this.policy.forbid ?? []).includes(p.name));

    if (candidates.length === 0) throw new Error(`No providers registered with capability ${cap}`);

    const preferred = (this.policy.preferred ?? []).find((n) =>
      candidates.some((c) => c.name === n),
    );
    if (preferred) {
      const found = candidates.find((c) => c.name === preferred);
      if (found) return found;
    }

    const weights = candidates.map((c) => ({
      p: c,
      w: this.policy.weights?.[c.name] ?? 1,
    }));
    const total = weights.reduce((s, x) => s + x.w, 0);
    let r = Math.random() * total;
    for (const { p, w } of weights) {
      r -= w;
      if (r <= 0) return p;
    }
    return candidates[0]!; // Safe because we checked candidates.length > 0 above
  }

  async textToImage(req: TextToImageRequest, ctx?: AIContext): Promise<TextToImageResult> {
    const p = this.pick("textToImage");
    if (!p.textToImage) throw new Error(`Provider ${p.name} lacks textToImage`);
    return p.textToImage(req, ctx);
  }

  async depth(req: DepthRequest, ctx?: AIContext): Promise<DepthResult> {
    const p = this.pick("depth");
    if (!p.depth) throw new Error(`Provider ${p.name} lacks depth`);
    return p.depth(req, ctx);
  }

  async segmentation(req: SegmentationRequest, ctx?: AIContext): Promise<SegmentationResult> {
    const p = this.pick("segmentation");
    if (!p.segmentation) throw new Error(`Provider ${p.name} lacks segmentation`);
    return p.segmentation(req, ctx);
  }
}

// Type definitions
export type AIContext = {
  traceId?: string;
  budgetUSD?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
};

export interface ProviderCallMeta {
  provider: string;
  model?: string;
  costUSD?: number;
  latencyMs?: number;
}

export type ImageDataRef = {
  uri: string;
  width?: number;
  height?: number;
  mimeType?: string;
};

export interface TextToImageRequest {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  seed?: number;
}

export interface TextToImageResult extends ProviderCallMeta {
  image: ImageDataRef;
}

export interface DepthRequest {
  image: ImageDataRef;
}

export interface DepthResult extends ProviderCallMeta {
  depth: ImageDataRef;
}

export interface SegmentationRequest {
  image: ImageDataRef;
  labels?: string[];
}

export interface SegmentationResult extends ProviderCallMeta {
  mask: ImageDataRef;
  classes?: Record<string, number>;
}

export interface AIProvider {
  name: string;
  capabilities(): Array<"textToImage" | "depth" | "segmentation">;
  textToImage?(req: TextToImageRequest, ctx?: AIContext): Promise<TextToImageResult>;
  depth?(req: DepthRequest, ctx?: AIContext): Promise<DepthResult>;
  segmentation?(req: SegmentationRequest, ctx?: AIContext): Promise<SegmentationResult>;
}

// Dummy provider for testing
export class DummyProvider implements AIProvider {
  name = "dummy" as const;

  capabilities(): Array<"textToImage" | "depth" | "segmentation"> {
    return ["textToImage", "depth", "segmentation"];
  }

  async textToImage(req: TextToImageRequest): Promise<TextToImageResult> {
    const start = Date.now();
    const w = req.width ?? 512;
    const h = req.height ?? 512;
    const svg =
      `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>` +
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

  async depth(_: DepthRequest): Promise<DepthResult> {
    const start = Date.now();
    const uri =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";
    return {
      provider: this.name,
      model: "dummy-depth",
      costUSD: 0,
      latencyMs: Date.now() - start,
      depth: { uri, mimeType: "image/png" },
    };
  }

  async segmentation(_: SegmentationRequest): Promise<SegmentationResult> {
    const start = Date.now();
    const uri =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottQAAAABJRU5ErkJggg==";
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

export function createDefaultAIRouter(policy?: RoutingPolicy): AIRouter {
  const registry = new AIRegistry();
  registry.register(new DummyProvider());
  return new AIRouter(registry, policy);
}
