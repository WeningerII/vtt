/**
 * Anthropic Claude 4 provider with latest models and enhanced features
 */

import {
  AIProvider,
  AICapability,
  AIContext,
  TextGenerationRequest,
  TextGenerationResult,
  ImageAnalysisRequest,
  ImageAnalysisResult,
  HealthStatus,
  ModelInfo,
  ProviderCallMeta,
  Tool,
  ToolCall
} from '../types';

export interface AnthropicClaude4Options {
  apiKey: string;
  baseURL?: string;
  defaultModel?: string;
}

export class AnthropicClaude4Provider implements AIProvider {
  name = 'anthropic';
  version = '4.1.0';
  
  private apiKey: string;
  private baseURL: string;
  private defaultModel: string;

  private models: Record<string, ModelInfo> = {
    'claude-4-opus-4.1': {
      id: 'claude-4-opus-4.1',
      displayName: 'Claude 4 Opus 4.1',
      contextWindow: 200000,
      maxOutputTokens: 4096,
      supportedFormats: ['text', 'image', 'pdf'],
      pricing: {
        input: 0.015,
        output: 0.075,
        currency: 'USD',
        lastUpdated: new Date('2025-09-01')
      },
      features: [
        { name: 'enhanced-reasoning', description: 'Advanced reasoning capabilities', enabled: true },
        { name: 'tool-use', description: 'Function calling and tool integration', enabled: true },
        { name: 'vision', description: 'Image analysis and understanding', enabled: true },
        { name: 'thinking-mode', description: 'Explicit reasoning traces', enabled: true }
      ]
    },
    'claude-4-sonnet-4': {
      id: 'claude-4-sonnet-4',
      displayName: 'Claude 4 Sonnet 4',
      contextWindow: 200000,
      maxOutputTokens: 4096,
      supportedFormats: ['text', 'image'],
      pricing: {
        input: 0.003,
        output: 0.015,
        currency: 'USD',
        lastUpdated: new Date('2025-09-01')
      },
      features: [
        { name: 'balanced-performance', description: 'Optimal speed-quality balance', enabled: true },
        { name: 'tool-use', description: 'Function calling support', enabled: true },
        { name: 'vision', description: 'Image analysis', enabled: true }
      ]
    },
    'claude-4-opus-4': {
      id: 'claude-4-opus-4',
      displayName: 'Claude 4 Opus 4',
      contextWindow: 200000,
      maxOutputTokens: 4096,
      supportedFormats: ['text', 'image'],
      pricing: {
        input: 0.012,
        output: 0.060,
        currency: 'USD',
        lastUpdated: new Date('2025-09-01')
      },
      features: [
        { name: 'high-reasoning', description: 'Superior reasoning capabilities', enabled: true },
        { name: 'tool-use', description: 'Advanced tool integration', enabled: true },
        { name: 'vision', description: 'Image understanding', enabled: true }
      ]
    }
  };

  constructor(options: AnthropicClaude4Options) {
    this.apiKey = options.apiKey;
    this.baseURL = options.baseURL || 'https://api.anthropic.com/v1';
    this.defaultModel = options.defaultModel || 'claude-4-opus-4.1';
  }

  capabilities(): AICapability[] {
    return [
      {
        type: 'text',
        subtype: 'generation',
        models: Object.values(this.models),
        limits: {
          maxRequestsPerMinute: 50,
          maxTokensPerRequest: 200000,
          maxConcurrentRequests: 5
        }
      },
      {
        type: 'multimodal',
        subtype: 'analysis',
        models: Object.values(this.models),
        limits: {
          maxRequestsPerMinute: 30,
          maxFileSize: 20 * 1024 * 1024 // 20MB
        }
      }
    ];
  }

  async generateText(req: TextGenerationRequest, ctx?: AIContext): Promise<TextGenerationResult> {
    const start = Date.now();
    const model = req.model || this.defaultModel;
    const modelInfo = this.models[model];

    if (!modelInfo) {
      throw new Error(`Unknown model: ${model}`);
    }

    try {
      const messages = this.formatMessages(req);
      const requestBody = {
        model,
        messages,
        max_tokens: Math.min(req.maxTokens || 4096, modelInfo.maxOutputTokens),
        temperature: req.temperature || 0.7,
        top_p: req.topP,
        top_k: req.topK,
        stop_sequences: req.stopSequences,
        system: req.systemPrompt,
        
        // Claude 4 specific features
        thinking_mode: req.reasoning ? 'explicit' : 'implicit',
        output_format: req.outputFormat || 'text',
        safety_level: req.safetyLevel || 'standard',
        
        // Tool use support
        tools: req.tools ? req.tools.map(tool => ({
        name: tool.function.name,
        description: tool.function.description,
        input_schema: tool.function.parameters
      })) : undefined,
        tool_choice: req.toolChoice
      };

      const response = await this.makeAPICall('/messages', requestBody, ctx);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Anthropic API error: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const text = data.content?.[0]?.text || '';
      const usage = data.usage || { input_tokens: 0, output_tokens: 0 };

      // Calculate cost based on model pricing
      const costUSD = this.calculateCost(usage, modelInfo);

      const result: TextGenerationResult = {
        provider: this.name,
        model,
        costUSD,
        latencyMs: Date.now() - start,
        tokensUsed: {
          input: usage.input_tokens,
          output: usage.output_tokens,
          total: usage.input_tokens + usage.output_tokens
        },
        text,
        finishReason: data.stop_reason === 'end_turn' ? 'stop' : 
                   data.stop_reason === 'max_tokens' ? 'length' :
                   data.stop_reason === 'tool_use' ? 'tool_calls' : 'stop',
        toolCalls: this.extractToolCalls(data) || [],
        reasoning: data.thinking || undefined
      };

      return result;
    } catch (error) {
      throw new Error(
        `Anthropic Claude 4 text generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async analyzeImage(req: ImageAnalysisRequest, ctx?: AIContext): Promise<ImageAnalysisResult> {
    const start = Date.now();
    const model = req.model || this.defaultModel;
    const modelInfo = this.models[model];

    if (!modelInfo) {
      throw new Error(`Unknown model: ${model}`);
    }

    try {
      const messages = [
        {
          role: 'user',
          content: [
            { type: 'text', text: req.prompt },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: req.image.mimeType || 'image/jpeg',
                data: await this.imageToBase64(req.image.uri)
              }
            }
          ]
        }
      ];

      const requestBody = {
        model,
        messages,
        max_tokens: req.maxTokens || 1000,
        temperature: 0.1 // Lower temperature for analysis tasks
      };

      const response = await this.makeAPICall('/messages', requestBody, ctx);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Anthropic API error: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const analysis = data.content?.[0]?.text || '';
      const usage = data.usage || { input_tokens: 0, output_tokens: 0 };

      const costUSD = this.calculateCost(usage, modelInfo);

      return {
        provider: this.name,
        model,
        costUSD,
        latencyMs: Date.now() - start,
        tokensUsed: {
          input: usage.input_tokens,
          output: usage.output_tokens,
          total: usage.input_tokens + usage.output_tokens
        },
        analysis,
        confidence: 0.9 // Claude typically has high confidence
      };
    } catch (error) {
      throw new Error(
        `Anthropic Claude 4 image analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async healthCheck(): Promise<HealthStatus> {
    const start = Date.now();
    
    try {
      const response = await fetch(`${this.baseURL}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-4-sonnet-4',
          messages: [{ role: 'user', content: 'Health check' }],
          max_tokens: 10
        })
      });

      const latency = Date.now() - start;

      if (response.ok || response.status === 400) {
        // 400 is expected for minimal request, indicates API is responding
        return {
          status: 'healthy',
          latency,
          lastCheck: new Date(),
          details: {
            statusCode: response.status,
            responseTime: latency
          }
        };
      } else {
        return {
          status: 'degraded',
          latency,
          lastCheck: new Date(),
          details: {
            statusCode: response.status,
            error: response.statusText
          }
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        lastCheck: new Date(),
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  private async makeAPICall(endpoint: string, body: any, ctx?: AIContext): Promise<Response> {
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    };

    const requestOptions: RequestInit = {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    };

    if (ctx?.signal) {
      requestOptions.signal = ctx.signal;
    }

    if (ctx?.timeoutMs) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), ctx.timeoutMs);
      requestOptions.signal = controller.signal;
      
      try {
        const response = await fetch(`${this.baseURL}${endpoint}`, requestOptions);
        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    }

    return fetch(`${this.baseURL}${endpoint}`, requestOptions);
  }

  private formatMessages(req: TextGenerationRequest): any[] {
    const messages: Array<{role: string; content: string}> = [];
    if (req.systemPrompt) {
      messages.push({ role: 'system', content: req.systemPrompt });
    }
    if (req.context) {
      messages.push({ role: 'user', content: req.context });
      messages.push({ role: 'assistant', content: 'I understand the context.' });
    }
    messages.push({ role: 'user', content: req.prompt });
    
    return messages;
  }

// ...

  private extractToolCalls(data: any): ToolCall[] | undefined {
    if (!data.content) {return undefined;}
    
    const toolCalls = data.content
      .filter((item: any) => item.type === 'tool_use')
      .map((item: any) => ({
        id: item.id,
        type: 'function' as const,
        function: {
          name: item.name,
          arguments: JSON.stringify(item.input)
        }
      }));
    
    return toolCalls.length > 0 ? toolCalls : undefined;
  }

  private mapFinishReason(stopReason: string): TextGenerationResult['finishReason'] {
    switch (stopReason) {
      case 'end_turn':
      case 'stop_sequence':
        return 'stop';
      case 'max_tokens':
        return 'length';
      case 'tool_use':
        return 'tool_calls';
      default:
        return 'stop';
    }
  }

  private calculateCost(usage: any, modelInfo: ModelInfo): number {
    const inputCost = (usage.input_tokens / 1000) * modelInfo.pricing.input;
    const outputCost = (usage.output_tokens / 1000) * modelInfo.pricing.output;
    return inputCost + outputCost;
  }

  private async imageToBase64(uri: string): Promise<string> {
    if (uri.startsWith('data:')) {
      // Extract base64 data from data URI
      return uri?.split(',')[1] || '';
    }
    
    // Fetch image and convert to base64
    const response = await fetch(uri);
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    return base64;
  }

  // VTT-specific content generation
  async generateVTTContent(
    contentType: 'npc' | 'location' | 'quest' | 'item' | 'encounter',
    context: {
      setting?: string;
      theme?: string;
      difficulty?: string;
      playerLevel?: number;
      additionalContext?: string;
    },
    ctx?: AIContext
  ): Promise<{
    content: any;
    model: string;
    costUSD: number;
    latencyMs: number;
  }> {
    const prompts = {
      npc: `Create a detailed D&D 5e NPC for a ${context.setting || 'fantasy'} setting with ${context.theme || 'neutral'} theme. Include name, race, class, background, personality traits, ideals, bonds, flaws, and stat block. Make it appropriate for level ${context.playerLevel || 5} characters. Format as JSON.`,
      location: `Design a detailed location for a ${context.setting || 'fantasy'} D&D campaign. Include description, notable features, inhabitants, secrets, and potential plot hooks. Theme: ${context.theme || 'neutral'}. Format as JSON.`,
      quest: `Create a ${context.difficulty || 'medium'} difficulty quest for level ${context.playerLevel || 5} D&D characters in a ${context.setting || 'fantasy'} setting. Include objective, background, key NPCs, challenges, and rewards. Format as JSON.`,
      item: `Design a magic item for D&D 5e appropriate for level ${context.playerLevel || 5} characters. Include name, rarity, description, properties, and lore. Theme: ${context.theme || 'neutral'}. Format as JSON.`,
      encounter: `Create a balanced combat encounter for ${context.playerLevel || 5} level D&D characters. Include enemies, tactics, environment, and potential complications. Difficulty: ${context.difficulty || 'medium'}. Format as JSON.`
    };

    const systemPrompt = `You are an expert D&D 5e game master and content creator. Generate high-quality, balanced, and creative content that follows official D&D 5e rules and conventions. Always respond with valid JSON that can be parsed programmatically.`;

    const prompt = prompts[contentType] + 
      (context.additionalContext ? `\n\nAdditional context: ${context.additionalContext}` : '');

    const result = await this.generateText({
      prompt,
      systemPrompt,
      maxTokens: 2000,
      temperature: 0.8,
      outputFormat: 'json'
    }, ctx);

    try {
      const content = JSON.parse(result.text);
      return {
        content,
        model: result.model,
        costUSD: result.costUSD,
        latencyMs: result.latencyMs
      };
    } catch {
      // If JSON parsing fails, return structured text
      return {
        content: { 
          type: contentType,
          raw: result.text,
          parsed: false 
        },
        model: result.model,
        costUSD: result.costUSD,
        latencyMs: result.latencyMs
      };
    }
  }
}
