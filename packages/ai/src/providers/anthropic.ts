/**
 * Anthropic Claude provider for text generation
 */

import { AIContext } from '../index';

export interface AnthropicProviderOptions {
  apiKey: string;
  baseURL?: string;
}

export class AnthropicProvider {
  name = 'anthropic';
  private apiKey: string;
  private baseURL: string;

  constructor(options: AnthropicProviderOptions) {
    this.apiKey = options.apiKey;
    this.baseURL = options.baseURL || 'https://api.anthropic.com/v1';
  }

  capabilities() {
    return ['textGeneration'] as const;
  }

  async generateText(prompt: string, options: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    systemPrompt?: string;
  } = {}, ctx?: AIContext): Promise<{
    text: string;
    usage: { inputTokens: number; outputTokens: number };
    model: string;
    costUSD: number;
    latencyMs: number;
  }> {
    const start = Date.now();
    const model = options.model || 'claude-3-sonnet-20240229';

    try {
      const response = await fetch(`${this.baseURL}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: options.maxTokens || 1000,
          temperature: options.temperature || 0.7,
          system: options.systemPrompt,
          messages: [
            { role: 'user', content: prompt },
          ],
        }),
        ...(ctx?.signal && { signal: ctx.signal }),
      });

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const text = data.content[0]?.text || '';
      const usage = data.usage || { input_tokens: 0, output_tokens: 0 };

      // Cost calculation for Claude models
      const inputCostPer1k = model.includes('opus') ? 0.015 : model.includes('sonnet') ? 0.003 : 0.00025;
      const outputCostPer1k = model.includes('opus') ? 0.075 : model.includes('sonnet') ? 0.015 : 0.00125;
      
      const costUSD = (usage.input_tokens / 1000) * inputCostPer1k + 
                     (usage.output_tokens / 1000) * outputCostPer1k;

      return {
        text,
        usage: {
          inputTokens: usage.input_tokens,
          outputTokens: usage.output_tokens,
        },
        model,
        costUSD,
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      throw new Error(`Anthropic text generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateGameContent(contentType: 'npc' | 'location' | 'quest' | 'item', context: {
    setting?: string;
    theme?: string;
    difficulty?: string;
    playerLevel?: number;
    additionalContext?: string;
  }, ctx?: AIContext): Promise<{
    content: any;
    model: string;
    costUSD: number;
    latencyMs: number;
  }> {
    const prompts = {
      npc: `Create a detailed D&D 5e NPC for a ${context.setting || 'fantasy'} setting with ${context.theme || 'neutral'} theme. Include name, race, class, background, personality traits, ideals, bonds, flaws, and stat block. Make it appropriate for level ${context.playerLevel || 5} characters.`,
      location: `Design a detailed location for a ${context.setting || 'fantasy'} D&D campaign. Include description, notable features, inhabitants, secrets, and potential plot hooks. Theme: ${context.theme || 'neutral'}.`,
      quest: `Create a ${context.difficulty || 'medium'} difficulty quest for level ${context.playerLevel || 5} D&D characters in a ${context.setting || 'fantasy'} setting. Include objective, background, key NPCs, challenges, and rewards.`,
      item: `Design a magic item for D&D 5e appropriate for level ${context.playerLevel || 5} characters. Include name, rarity, description, properties, and lore. Theme: ${context.theme || 'neutral'}.`
    };

    const systemPrompt = `You are an expert D&D 5e game master and content creator. Generate high-quality, balanced, and creative content that follows official D&D 5e rules and conventions. Format your response as structured JSON.`;

    const prompt = prompts[contentType] + (context.additionalContext ? `\n\nAdditional context: ${context.additionalContext}` : '');

    const result = await this.generateText(prompt, {
      systemPrompt,
      maxTokens: 2000,
      temperature: 0.8,
    }, ctx);

    try {
      const content = JSON.parse(result.text);
      return {
        content,
        model: result.model,
        costUSD: result.costUSD,
        latencyMs: result.latencyMs,
      };
    } catch {
      // If JSON parsing fails, return raw text
      return {
        content: { raw: result.text },
        model: result.model,
        costUSD: result.costUSD,
        latencyMs: result.latencyMs,
      };
    }
  }
}
