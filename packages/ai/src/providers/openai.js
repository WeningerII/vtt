/**
 * OpenAI provider for text generation and image analysis
 */
export class OpenAIProvider {
  constructor(options) {
    this.name = "openai";
    this.apiKey = options.apiKey;
    this.baseURL = options.baseURL || "https://api.openai.com/v1";
    this.organization = options.organization;
  }
  capabilities() {
    return ["textToImage"];
  }
  async textToImage(req, ctx) {
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
  async generateText(prompt, options = {}, ctx) {
    const start = Date.now();
    const model = options.model || "gpt-4";
    try {
      const messages = [
        ...(options.systemPrompt ? [{ role: "system", content: options.systemPrompt }] : []),
        { role: "user", content: prompt },
      ];
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
          max_tokens: options.maxTokens || 1000,
          temperature: options.temperature || 0.7,
        }),
        ...(ctx?.signal && { signal: ctx.signal }),
      });
      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      const text = data.choices[0]?.message?.content || "";
      const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
      // Rough cost calculation (varies by model)
      const costPer1kTokens = model.includes("gpt-4") ? 0.03 : 0.002;
      const costUSD = (usage.total_tokens / 1000) * costPer1kTokens;
      return {
        text,
        usage: {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
        },
        model,
        costUSD,
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      throw new Error(
        `OpenAI text generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
  async analyzeImage(imageUrl, prompt, ctx) {
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
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: imageUrl } },
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
        analysis,
        model: "gpt-4-vision-preview",
        costUSD: 0.01, // Approximate cost
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      throw new Error(
        `OpenAI image analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}
//# sourceMappingURL=openai.js.map
