/**
 * OpenAI provider for text generation and image analysis
 */

import {
  AIProvider,
  AIContext,
  AICapability,
  TextGenerationRequest,
  TextGenerationResult,
  ImageAnalysisRequest,
  ImageAnalysisResult,
  HealthStatus,
  DepthRequest,
  DepthResult,
  SegmentationRequest,
  SegmentationResult,
  TextToImageRequest,
  TextToImageResult,
} from "../index";

export interface OpenAIProviderOptions {
  apiKey: string;
  baseURL?: string;
  organization?: string;
}

export class OpenAIProvider implements AIProvider {
  name = "openai" as const;
  version = "1.0.0";

  capabilities(): AICapability[] {
    return [
      {
        type: "text",
        subtype: "generation",
        models: [
          {
            id: "gpt-4",
            displayName: "GPT-4",
            contextWindow: 8192,
            maxOutputTokens: 4096,
            pricing: {
              input: 0.03,
              output: 0.06,
              currency: "USD",
              lastUpdated: new Date(),
            },
          },
        ],
      },
      {
        type: "image",
        subtype: "generation",
        models: [
          {
            id: "dall-e-3",
            displayName: "DALL-E 3",
            contextWindow: 4000,
            maxOutputTokens: 0,
            pricing: {
              input: 0.04,
              output: 0,
              currency: "USD",
              lastUpdated: new Date(),
            },
          },
        ],
      },
    ];
  }

  async healthCheck(): Promise<HealthStatus> {
    return {
      status: "healthy",
      lastCheck: new Date(),
    };
  }

  private apiKey: string;
  private baseURL: string;
  private organization: string | undefined;

  constructor(options: OpenAIProviderOptions) {
    this.apiKey = options.apiKey;
    this.baseURL = options.baseURL || "https://api.openai.com/v1";
    this.organization = options.organization;
  }

  async textToImage(req: TextToImageRequest, ctx?: AIContext): Promise<TextToImageResult> {
    const start = Date.now();

    try {
      const response = await fetch(`${this.baseURL}/images/generations`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          ...(this.organization && { "OpenAI-Organization": this.organization }),
        },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt: req.prompt,
          n: 1,
          size: `${req.width || 1024}x${req.height || 1024}`,
          quality: "standard",
          response_format: "url",
        }),
        ...(ctx?.signal && { signal: ctx.signal }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const imageUrl = data.data[0]?.url;

      if (!imageUrl) {
        throw new Error("No image URL returned from OpenAI");
      }

      return {
        provider: this.name,
        model: "dall-e-3",
        costUSD: 0.04, // Approximate cost for DALL-E 3
        latencyMs: Date.now() - start,
        image: {
          uri: imageUrl,
          width: req.width || 1024,
          height: req.height || 1024,
          mimeType: "image/png",
        },
      };
    } catch (error) {
      throw new Error(
        `OpenAI text-to-image failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async generateText(req: TextGenerationRequest, ctx?: AIContext): Promise<TextGenerationResult> {
    const start = Date.now();
    const model = req.model || "gpt-4";
    const maxTokens = req.maxTokens || 150;
    const temperature = req.temperature || 0.7;

    const messages: any[] = [];
    if (req.systemPrompt) {
      messages.push({ role: "system", content: req.systemPrompt });
    }
    messages.push({ role: "user", content: req.prompt });

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          ...(this.organization && { "OpenAI-Organization": this.organization }),
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: maxTokens,
          temperature,
        }),
        ...(ctx?.signal && { signal: ctx.signal }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const choice = data.choices[0];

      // Rough cost calculation (varies by model)
      const costPer1kTokens = model.includes("gpt-4") ? 0.03 : 0.002;
      const costUSD = (data.usage.total_tokens / 1000) * costPer1kTokens;

      return {
        provider: this.name,
        model,
        costUSD,
        latencyMs: Date.now() - start,
        tokensUsed: {
          input: data.usage.prompt_tokens || 0,
          output: data.usage.completion_tokens || 0,
          total: data.usage.total_tokens || 0,
        },
        text: choice.message?.content || "",
        finishReason: choice.finish_reason === "stop" ? "stop" : "length",
      };
    } catch (error) {
      throw new Error(
        `OpenAI text generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async analyzeImage(req: ImageAnalysisRequest, ctx?: AIContext): Promise<ImageAnalysisResult> {
    const start = Date.now();

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          ...(this.organization && { "OpenAI-Organization": this.organization }),
        },
        body: JSON.stringify({
          model: "gpt-4-vision-preview",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: req.prompt,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: req.image.uri,
                  },
                },
              ],
            },
          ],
          max_tokens: 500,
        }),
        ...(ctx?.signal && { signal: ctx.signal }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const analysis = data.choices[0]?.message?.content || "";

      return {
        provider: this.name,
        model: "gpt-4-vision-preview",
        costUSD: 0.01,
        latencyMs: Date.now() - start,
        tokensUsed: {
          input: data.usage?.prompt_tokens || 0,
          output: data.usage?.completion_tokens || 0,
          total: data.usage?.total_tokens || 0,
        },
        analysis,
        confidence: 0.9
      };
    } catch (error) {
      throw new Error(
        `OpenAI image analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
