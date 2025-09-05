import type {
  AIContext,
  AIProvider,
  AICapability,
  ImageDataRef,
  HealthStatus,
  TextToImageRequest,
  TextToImageResult,
} from "../index";

export type StabilityProviderOptions = {
  apiKey: string;
  /** Engine id, e.g. stable-diffusion-v1-6 or stable-diffusion-xl-1024-v1-0 */
  engine?: string;
  baseUrl?: string;
};

/**
 * Stability AI text-to-image provider.
 * Docs: https://platform.stability.ai/docs/api-reference#tag/v1generation/operation/textToImage
 */
export class StabilityProvider implements AIProvider {
  name = "stability" as const;
  version = "1.0.0";

  private readonly engine: string;
  private readonly baseUrl: string;

  constructor(private readonly opts: StabilityProviderOptions) {
    this.engine = opts.engine ?? "stable-diffusion-v1-6";
    this.baseUrl = opts.baseUrl ?? "https://api.stability.ai";
  }

  capabilities(): AICapability[] {
    return [{
      type: 'image',
      subtype: 'generation',
      models: [{
        id: 'stable-diffusion-xl',
        displayName: 'Stable Diffusion XL',
        contextWindow: 77,
        maxOutputTokens: 0,
        pricing: { input: 0.04, output: 0, currency: 'USD', lastUpdated: new Date() }
      }]
    }];
  }

  async healthCheck(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      lastCheck: new Date()
    };
  }

  async textToImage(req: TextToImageRequest, ctx?: AIContext): Promise<TextToImageResult> {
    const start = Date.now();
    const width = req.width || 1024;
    const height = req.height || 1024;

    // Stability AI API call would go here
    // For now, return a placeholder

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Create a simple colored rectangle as placeholder
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx2d = canvas.getContext("2d")!;
    ctx2d.fillStyle = `hsl(${Math.random() * 360}, 70%, 50%)`;
    ctx2d.fillRect(0, 0, width, height);
    ctx2d.fillStyle = "white";
    ctx2d.font = "16px Arial";
    ctx2d.textAlign = "center";
    ctx2d.fillText(req.prompt.slice(0, 50), width / 2, height / 2);

    const dataURL = canvas.toDataURL("image/png");

    return {
      provider: "stability",
      model: "stable-diffusion-xl-1024-v1-0",
      costUSD: 0.04,
      latencyMs: Date.now() - start,
      image: {
        uri: dataURL,
        width,
        height,
        mimeType: "image/png",
      },
    };
  }
}

function clampTo64(_n: number) {
  const x = Math.max(64, Math.min(2048, Math.floor(_n)));
  return x - (x % 64);
}

function buildPrompts(_prompt: string, _negative?: string) {
  const arr: Array<{ text: string; weight?: number }> = [{ text: String(_prompt ?? "") }];
  if (_negative && _negative.trim().length) {arr.push({ text: _negative, weight: -1 });}
  return arr;
}

async function safeText(res: Response) {
  try {
    return await res.text();
  } catch {
    return "<no body>";
  }
}
