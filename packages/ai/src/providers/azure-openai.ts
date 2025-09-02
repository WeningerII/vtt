/**
 * Azure OpenAI provider with GPT-5 series and enhanced deployment management
 */

import {
  AIProvider,
  AICapability,
  AIContext,
  TextGenerationRequest,
  TextGenerationResult,
  ImageGenerationRequest,
  ImageGenerationResult,
  ImageAnalysisRequest,
  ImageAnalysisResult,
  EmbeddingRequest,
  EmbeddingResult,
  HealthStatus,
  ModelInfo,
  Tool,
  ToolCall
} from '../types';

export interface AzureOpenAIOptions {
  apiKey: string;
  endpoint: string;
  deployments: Record<string, DeploymentConfig>;
  registrationKey?: string;
  apiVersion?: string;
}

export interface DeploymentConfig {
  deploymentName: string;
  modelName: string;
  apiVersion: string;
  requiresRegistration?: boolean;
  capabilities: string[];
  limits: {
    rpm: number; // Requests per minute
    tpm: number; // Tokens per minute
  };
}

export class AzureOpenAIProvider implements AIProvider {
  name = 'azure-openai';
  version = '5.0.0';
  
  private apiKey: string;
  private endpoint: string;
  private deployments: Map<string, DeploymentConfig>;
  private registrationKey?: string;
  private defaultApiVersion: string;

  private models: Record<string, ModelInfo> = {
    'gpt-5': {
      id: 'gpt-5',
      displayName: 'GPT-5',
      contextWindow: 200000,
      maxOutputTokens: 4096,
      supportedFormats: ['text'],
      pricing: {
        input: 0.05,
        output: 0.15,
        currency: 'USD',
        lastUpdated: new Date('2025-09-01')
      },
      features: [
        { name: 'flagship-reasoning', description: 'Most advanced reasoning model', enabled: true },
        { name: 'tool-use', description: 'Advanced function calling', enabled: true },
        { name: 'registration-required', description: 'Requires special registration', enabled: true }
      ]
    },
    'gpt-5-mini': {
      id: 'gpt-5-mini',
      displayName: 'GPT-5 Mini',
      contextWindow: 128000,
      maxOutputTokens: 4096,
      supportedFormats: ['text'],
      pricing: {
        input: 0.01,
        output: 0.03,
        currency: 'USD',
        lastUpdated: new Date('2025-09-01')
      },
      features: [
        { name: 'efficient-reasoning', description: 'Compact but capable', enabled: true },
        { name: 'tool-use', description: 'Function calling support', enabled: true }
      ]
    },
    'gpt-5-nano': {
      id: 'gpt-5-nano',
      displayName: 'GPT-5 Nano',
      contextWindow: 64000,
      maxOutputTokens: 2048,
      supportedFormats: ['text'],
      pricing: {
        input: 0.002,
        output: 0.008,
        currency: 'USD',
        lastUpdated: new Date('2025-09-01')
      },
      features: [
        { name: 'cost-optimized', description: 'Most economical option', enabled: true },
        { name: 'fast-inference', description: 'Optimized for speed', enabled: true }
      ]
    },
    'gpt-5-chat': {
      id: 'gpt-5-chat',
      displayName: 'GPT-5 Chat',
      contextWindow: 128000,
      maxOutputTokens: 4096,
      supportedFormats: ['text'],
      pricing: {
        input: 0.015,
        output: 0.045,
        currency: 'USD',
        lastUpdated: new Date('2025-09-01')
      },
      features: [
        { name: 'chat-optimized', description: 'Optimized for conversational AI', enabled: true },
        { name: 'tool-use', description: 'Function calling support', enabled: true }
      ]
    },
    'gpt-4o': {
      id: 'gpt-4o',
      displayName: 'GPT-4o',
      contextWindow: 128000,
      maxOutputTokens: 4096,
      supportedFormats: ['text', 'image', 'audio'],
      pricing: {
        input: 0.005,
        output: 0.015,
        currency: 'USD',
        lastUpdated: new Date('2025-09-01')
      },
      features: [
        { name: 'multimodal', description: 'Text, image, and audio processing', enabled: true },
        { name: 'vision', description: 'Advanced image understanding', enabled: true },
        { name: 'tool-use', description: 'Function calling support', enabled: true }
      ]
    },
    'gpt-4o-mini': {
      id: 'gpt-4o-mini',
      displayName: 'GPT-4o Mini',
      contextWindow: 128000,
      maxOutputTokens: 4096,
      supportedFormats: ['text', 'image'],
      pricing: {
        input: 0.00015,
        output: 0.0006,
        currency: 'USD',
        lastUpdated: new Date('2025-09-01')
      },
      features: [
        { name: 'multimodal', description: 'Text and image processing', enabled: true },
        { name: 'cost-efficient', description: 'Affordable multimodal option', enabled: true }
      ]
    },
    'dall-e-3': {
      id: 'dall-e-3',
      displayName: 'DALL-E 3',
      contextWindow: 4000,
      maxOutputTokens: 0,
      supportedFormats: ['text'],
      pricing: {
        input: 0.04,
        output: 0,
        currency: 'USD',
        lastUpdated: new Date('2025-09-01')
      },
      features: [
        { name: 'image-generation', description: 'High-quality image generation', enabled: true }
      ]
    },
    'text-embedding-3-large': {
      id: 'text-embedding-3-large',
      displayName: 'Text Embedding 3 Large',
      contextWindow: 8191,
      maxOutputTokens: 0,
      supportedFormats: ['text'],
      pricing: {
        input: 0.00013,
        output: 0,
        currency: 'USD',
        lastUpdated: new Date('2025-09-01')
      },
      features: [
        { name: 'embeddings', description: 'High-quality text embeddings', enabled: true }
      ]
    }
  };

  constructor(options: AzureOpenAIOptions) {
    this.apiKey = options.apiKey;
    this.endpoint = options.endpoint.replace(/\/$/, ''); // Remove trailing slash
    this.deployments = new Map(Object.entries(options.deployments));
    this.registrationKey = options.registrationKey ?? '';
    this.defaultApiVersion = options.apiVersion || '2024-08-01-preview';
  }

  capabilities(): AICapability[] {
    return [
      {
        type: 'text',
        subtype: 'generation',
        models: Object.values(this.models).filter(m => 
          m.features?.some(f => f.name.includes('reasoning') || f.name.includes('chat'))
        ),
        limits: {
          maxRequestsPerMinute: 100,
          maxTokensPerRequest: 200000,
          maxConcurrentRequests: 10
        }
      },
      {
        type: 'image',
        subtype: 'generation',
        models: Object.values(this.models).filter(m => m.id === 'dall-e-3'),
        limits: {
          maxRequestsPerMinute: 20
        }
      },
      {
        type: 'multimodal',
        subtype: 'analysis',
        models: Object.values(this.models).filter(m => ['gpt-4o', 'gpt-4o-mini'].includes(m.id)),
        limits: {
          maxRequestsPerMinute: 50,
          maxFileSize: 20 * 1024 * 1024
        }
      },
      {
        type: 'embedding',
        models: Object.values(this.models).filter(m => m.id === 'text-embedding-3-large'),
        limits: {
          maxRequestsPerMinute: 200
        }
      }
    ];
  }

  async generateText(req: TextGenerationRequest, ctx?: AIContext): Promise<TextGenerationResult> {
    const start = Date.now();
    const model = req.model || 'gpt-5';
    const modelInfo = this.models[model];
    const deployment = this.deployments.get(model);

    if (!modelInfo) {
      throw new Error(`Unknown model: ${model}`);
    }

    if (!deployment) {
      throw new Error(`No deployment configured for model: ${model}`);
    }

    if (deployment.requiresRegistration && !this.registrationKey) {
      throw new Error(`Model ${model} requires registration key`);
    }

    try {
      const messages = this.formatMessages(req);
      const requestBody = {
        messages,
        max_tokens: Math.min(req.maxTokens || 4096, modelInfo.maxOutputTokens),
        temperature: req.temperature || 0.7,
        top_p: req.topP,
        stop: req.stopSequences,
        
        // GPT-5 specific features
        reasoning_effort: req.reasoningEffort || 'standard',
        output_structure: req.outputStructure,
        
        // Tool use
        tools: req.tools ? this.formatTools(req.tools) : undefined,
        tool_choice: req.toolChoice,
        parallel_tool_calls: req.parallelToolCalls !== false,
        
        // Azure specific
        stream: false
      };

      const response = await this.makeAPICall(
        `/openai/deployments/${deployment.deploymentName}/chat/completions`,
        requestBody,
        deployment.apiVersion,
        ctx
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Azure OpenAI API error: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const choice = data.choices?.[0];
      
      if (!choice) {
        throw new Error('No response choice generated');
      }

      const text = choice.message?.content || '';
      const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

      const costUSD = this.calculateCost(usage, modelInfo);

      const result: TextGenerationResult = {
        provider: this.name,
        model,
        costUSD,
        latencyMs: Date.now() - start,
        tokensUsed: {
          input: usage.prompt_tokens,
          output: usage.completion_tokens,
          total: usage.total_tokens
        },
        text,
        finishReason: (choice.finish_reason as 'length' | 'stop' | 'tool_calls' | 'content_filter') || 'stop',
        reasoning: choice.reasoning || undefined
      };

      return result;
    } catch (error) {
      throw new Error(
        `Azure OpenAI text generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async generateImage(req: ImageGenerationRequest, ctx?: AIContext): Promise<ImageGenerationResult> {
    const start = Date.now();
    const model = 'dall-e-3';
    const modelInfo = this.models[model];
    const deployment = this.deployments.get(model);

    if (!deployment) {
      throw new Error(`No deployment configured for DALL-E 3`);
    }

    try {
      const requestBody = {
        prompt: req.prompt,
        n: req.count || 1,
        size: `${req.width || 1024}x${req.height || 1024}`,
        quality: 'standard',
        response_format: 'url',
        style: req.stylePreset || 'natural'
      };

      const response = await this.makeAPICall(
        `/openai/deployments/${deployment.deploymentName}/images/generations`,
        requestBody,
        deployment.apiVersion,
        ctx
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Azure OpenAI API error: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const images = data.data?.map((img: any) => ({
        uri: img.url,
        width: req.width || 1024,
        height: req.height || 1024,
        mimeType: 'image/png'
      })) || [];

      const estimatedCost = (req.count || 1) * (modelInfo?.pricing.input || 0);

      return {
        provider: this.name,
        model,
        costUSD: estimatedCost,
        latencyMs: Date.now() - start,
        images,
        revisedPrompt: data.data?.[0]?.revised_prompt
      };
    } catch (error) {
      throw new Error(
        `Azure OpenAI image generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async analyzeImage(req: ImageAnalysisRequest, ctx?: AIContext): Promise<ImageAnalysisResult> {
    const start = Date.now();
    const model = req.model || 'gpt-4o';
    const modelInfo = this.models[model];
    const deployment = this.deployments.get(model);

    if (!modelInfo) {
      throw new Error(`Unknown model: ${model}`);
    }

    if (!deployment) {
      throw new Error(`No deployment configured for model: ${model}`);
    }

    try {
      const messages = [{
        role: 'user',
        content: [
          { type: 'text', text: req.prompt },
          {
            type: 'image_url',
            image_url: {
              url: req.image.uri,
              detail: 'high'
            }
          }
        ]
      }];

      const requestBody = {
        messages,
        max_tokens: req.maxTokens || 1000,
        temperature: 0.1
      };

      const response = await this.makeAPICall(
        `/openai/deployments/${deployment.deploymentName}/chat/completions`,
        requestBody,
        deployment.apiVersion,
        ctx
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Azure OpenAI API error: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const choice = data.choices?.[0];
      
      if (!choice) {
        throw new Error('No analysis generated');
      }

      const analysis = choice.message?.content || '';
      const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

      const costUSD = this.calculateCost(usage, modelInfo);

      return {
        provider: this.name,
        model,
        costUSD,
        latencyMs: Date.now() - start,
        tokensUsed: {
          input: usage.prompt_tokens,
          output: usage.completion_tokens,
          total: usage.total_tokens
        },
        analysis,
        confidence: 0.9
      };
    } catch (error) {
      throw new Error(
        `Azure OpenAI image analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async generateEmbedding(req: EmbeddingRequest, ctx?: AIContext): Promise<EmbeddingResult> {
    const start = Date.now();
    const model = req.model || 'text-embedding-3-large';
    const modelInfo = this.models[model];
    const deployment = this.deployments.get(model);

    if (!deployment) {
      throw new Error(`No deployment configured for embedding model: ${model}`);
    }

    try {
      const requestBody = {
        input: Array.isArray(req.input) ? req.input : [req.input],
        dimensions: req.dimensions
      };

      const response = await this.makeAPICall(
        `/openai/deployments/${deployment.deploymentName}/embeddings`,
        requestBody,
        deployment.apiVersion,
        ctx
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Azure OpenAI API error: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const embeddings = data.data?.map((item: any) => item.embedding) || [];
      const usage = data.usage || { prompt_tokens: 0, total_tokens: 0 };

      const costUSD = (usage.prompt_tokens / 1000) * (modelInfo?.pricing.input || 0);

      return {
        provider: this.name,
        model,
        costUSD,
        latencyMs: Date.now() - start,
        tokensUsed: {
          input: usage.prompt_tokens,
          output: 0,
          total: usage.total_tokens
        },
        embeddings,
        dimensions: embeddings[0]?.length || 0
      };
    } catch (error) {
      throw new Error(
        `Azure OpenAI embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async healthCheck(): Promise<HealthStatus> {
    const start = Date.now();
    
    try {
      // Use a simple deployment for health check
      const testDeployment = Array.from(this.deployments.values())[0];
      
      if (!testDeployment) {
        return {
          status: 'unhealthy',
          lastCheck: new Date(),
          details: { error: 'No deployments configured' }
        };
      }

      const response = await fetch(
        `${this.endpoint}/openai/deployments/${testDeployment.deploymentName}/chat/completions?api-version=${testDeployment.apiVersion}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: 'Health check' }],
            max_tokens: 10
          })
        }
      );

      const latency = Date.now() - start;

      if (response.ok || response.status === 400) {
        return {
          status: 'healthy',
          latency,
          lastCheck: new Date(),
          details: {
            statusCode: response.status,
            deployment: testDeployment.deploymentName
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

  private async makeAPICall(
    endpoint: string,
    body: any,
    apiVersion: string,
    ctx?: AIContext
  ): Promise<Response> {
    const url = `${this.endpoint}${endpoint}?api-version=${apiVersion}`;
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };

    if (this.registrationKey) {
      headers['X-Registration-Key'] = this.registrationKey;
    }

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
        const response = await fetch(url, requestOptions);
        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    }

    return fetch(url, requestOptions);
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

  private formatTools(tools: Tool[]): any[] {
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters
      }
    }));
  }

  private extractToolCalls(choice: any): ToolCall[] | undefined {
    const toolCalls = choice.message?.tool_calls;
    
    if (!toolCalls || !Array.isArray(toolCalls)) {
      return undefined;
    }
    
    return toolCalls.map((call: any) => ({
      id: call.id,
      type: 'function',
      function: {
        name: call.function.name,
        arguments: call.function.arguments
      }
    }));
  }

  private mapFinishReason(reason: string): TextGenerationResult['finishReason'] {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'tool_calls':
        return 'tool_calls';
      case 'content_filter':
        return 'content_filter';
      default:
        return 'stop';
    }
  }

  private calculateCost(usage: any, modelInfo: ModelInfo): number {
    const inputCost = (usage.prompt_tokens / 1000) * modelInfo.pricing.input;
    const outputCost = (usage.completion_tokens / 1000) * modelInfo.pricing.output;
    return inputCost + outputCost;
  }

  // Rate limiting per deployment
  private rateLimiters = new Map<string, { requests: number; resetTime: number }>();

  private async checkRateLimit(deploymentName: string, deployment: DeploymentConfig): Promise<void> {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window
    
    let limiter = this.rateLimiters.get(deploymentName);
    
    if (!limiter || now > limiter.resetTime) {
      limiter = { requests: 0, resetTime: now + windowMs };
      this.rateLimiters.set(deploymentName, limiter);
    }
    
    if (limiter.requests >= deployment.limits.rpm) {
      const waitTime = limiter.resetTime - now;
      throw new Error(`Rate limit exceeded for deployment ${deploymentName}. Wait ${waitTime}ms`);
    }
    
    limiter.requests++;
  }
}
