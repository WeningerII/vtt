import type { AIContext, AIProvider, TextToImageRequest, TextToImageResult } from "../index";
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
export declare class StabilityProvider implements AIProvider {
    private readonly opts;
    readonly name: "stability";
    private readonly engine;
    private readonly baseUrl;
    constructor(opts: StabilityProviderOptions);
    capabilities(): Array<"textToImage" | "depth" | "segmentation">;
    textToImage(req: TextToImageRequest, ctx?: AIContext): Promise<TextToImageResult>;
}
//# sourceMappingURL=stability.d.ts.map