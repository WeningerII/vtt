import type {
  AIContext,
  AIProvider,
  ImageDataRef,
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
  public readonly name = "stability" as const;
  private readonly engine: string;
  private readonly baseUrl: string;

  constructor(private readonly opts: StabilityProviderOptions) {
    this.engine = opts.engine ?? "stable-diffusion-v1-6";
    this.baseUrl = opts.baseUrl ?? "https://api.stability.ai";
  }

  capabilities() {
    return ["textToImage"] as const as Array<"textToImage" | "depth" | "segmentation">;
  }

  async textToImage(req: TextToImageRequest, ctx?: AIContext): Promise<TextToImageResult> {
    const started = Date.now();

    const width = clampTo64(req.width ?? 512);
    const height = clampTo64(req.height ?? 512);

    const body: any = {
      text_prompts: buildPrompts(req.prompt, req.negativePrompt),
      width,
      height,
      samples: 1,
    };
    if (typeof req.seed === "number") body.seed = req.seed;

    const url = `${this.baseUrl}/v1/generation/${this.engine}/text-to-image`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.opts.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      signal: ctx?.signal ?? null,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await safeText(res);
      throw new Error(`Stability textToImage ${res.status}: ${errText}`);
    }

    const json: any = await res.json();
    const artifact = json?.artifacts?.[0];
    if (!artifact?.base64) throw new Error("Stability returned no artifact");

    const uri = `data:image/png;base64,${artifact.base64}`;
    const image: ImageDataRef = { uri, width, height, mimeType: "image/png" };

    return {
      provider: this.name,
      model: this.engine,
      latencyMs: Date.now() - started,
      image,
    };
  }
}

function clampTo64(_n: number) {
  const x = Math.max(64, Math.min(2048, Math.floor(n)));
  return x - (x % 64);
}

function buildPrompts(_prompt: string, _negative?: string) {
  const arr: Array<{ text: string; weight?: number }> = [{ text: String(prompt ?? "") }];
  if (negative && negative.trim().length) arr.push({ text: negative, weight: -1 });
  return arr;
}

async function safeText(res: Response) {
  try {
    return await res.text();
  } catch {
    return "<no body>";
  }
}
