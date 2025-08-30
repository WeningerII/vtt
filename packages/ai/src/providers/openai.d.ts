/**
 * OpenAI provider for text generation and image analysis
 */
import { AIProvider, TextToImageRequest, TextToImageResult, AIContext } from "../index";
export interface OpenAIProviderOptions {
  apiKey: string;
  baseURL?: string;
  organization?: string;
}
export declare class OpenAIProvider implements AIProvider {
  name: string;
  private apiKey;
  private baseURL;
  private organization;
  constructor(options: OpenAIProviderOptions);
  capabilities(): Array<"textToImage" | "depth" | "segmentation">;
  textToImage(req: TextToImageRequest, ctx?: AIContext): Promise<TextToImageResult>;
  generateText(
    prompt: string,
    options?: {
      model?: string;
      maxTokens?: number;
      temperature?: number;
      systemPrompt?: string;
    },
    ctx?: AIContext,
  ): Promise<{
    text: string;
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    model: string;
    costUSD: number;
    latencyMs: number;
  }>;
  analyzeImage(
    imageUrl: string,
    prompt: string,
    ctx?: AIContext,
  ): Promise<{
    analysis: string;
    model: string;
    costUSD: number;
    latencyMs: number;
  }>;
}
//# sourceMappingURL=openai.d.ts.map
