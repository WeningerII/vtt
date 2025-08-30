/**
 * Stability AI text-to-image provider.
 * Docs: https://platform.stability.ai/docs/api-reference#tag/v1generation/operation/textToImage
 */
export class StabilityProvider {
    constructor(opts) {
        this.opts = opts;
        this.name = "stability";
        this.engine = opts.engine ?? "stable-diffusion-v1-6";
        this.baseUrl = opts.baseUrl ?? "https://api.stability.ai";
    }
    capabilities() {
        return ["textToImage"];
    }
    async textToImage(req, ctx) {
        const started = Date.now();
        const width = clampTo64(req.width ?? 512);
        const height = clampTo64(req.height ?? 512);
        const body = {
            text_prompts: buildPrompts(req.prompt, req.negativePrompt),
            width,
            height,
            samples: 1,
        };
        if (typeof req.seed === "number")
            body.seed = req.seed;
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
        const json = await res.json();
        const artifact = json?.artifacts?.[0];
        if (!artifact?.base64)
            throw new Error("Stability returned no artifact");
        const uri = `data:image/png;base64,${artifact.base64}`;
        const image = { uri, width, height, mimeType: "image/png" };
        return {
            provider: this.name,
            model: this.engine,
            latencyMs: Date.now() - started,
            image,
        };
    }
}
function clampTo64(n) {
    const x = Math.max(64, Math.min(2048, Math.floor(n)));
    return x - (x % 64);
}
function buildPrompts(prompt, negative) {
    const arr = [{ text: String(prompt ?? "") }];
    if (negative && negative.trim().length)
        arr.push({ text: negative, weight: -1 });
    return arr;
}
async function safeText(res) {
    try {
        return await res.text();
    }
    catch {
        return "<no body>";
    }
}
//# sourceMappingURL=stability.js.map