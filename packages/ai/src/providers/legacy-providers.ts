/**
 * Legacy Provider Implementations - Stub versions for compatibility
 */
import { 
  AIProvider, 
  AICapability, 
  HealthStatus,
  TextGenerationRequest,
  TextGenerationResult,
  ImageGenerationRequest,
  ImageGenerationResult,
  AIContext,
  ImageDataRef
} from '../types';

export class OpenAIProvider implements AIProvider {
  name = "openai" as const;
  version = "1.0.0";

  constructor(private config: { apiKey: string; baseUrl?: string }) {}

  capabilities(): AICapability[] {
    return [
      {
        type: 'text',
        subtype: 'generation',
        models: [{
          id: 'gpt-3.5-turbo',
          displayName: 'GPT-3.5 Turbo',
          contextWindow: 4096,
          maxOutputTokens: 1000,
          pricing: { input: 0.001, output: 0.002, currency: 'USD', lastUpdated: new Date() }
        }]
      }
    ];
  }

  async healthCheck(): Promise<HealthStatus> {
    return { status: 'healthy', lastCheck: new Date() };
  }

  async generateImage(req: ImageGenerationRequest, ctx?: AIContext): Promise<ImageGenerationResult> {
    const startTime = Date.now();
    const response = await fetch(`${this.config.baseUrl || 'https://api.openai.com'}/v1/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        prompt: req.prompt,
        n: req.count || 1,
        size: `${req.width || 1024}x${req.height || 1024}`,
        response_format: 'url'
      }),
      signal: ctx?.signal || null
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
    }
    
    const data = await response.json();
    const images: ImageDataRef[] = data.data.map((img: any) => ({
      url: img.url,
      type: 'url' as const
    }));
    
    return {
      images,
      provider: 'openai',
      model: req.model || 'dall-e-3',
      costUSD: 0.04 * (req.count || 1),
      latencyMs: Date.now() - startTime,
      revisedPrompt: data.data[0]?.revised_prompt
    };
  }

  async generateText(req: TextGenerationRequest, ctx?: AIContext): Promise<TextGenerationResult> {
    const startTime = Date.now();
    const messages: any[] = [];
    if (req.systemPrompt) {
      messages.push({ role: 'system', content: req.systemPrompt });
    }
    messages.push({ role: 'user', content: req.prompt });
    
    const response = await fetch(`${this.config.baseUrl || 'https://api.openai.com'}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model: req.model || 'gpt-3.5-turbo',
        messages,
        temperature: req.temperature || 0.7,
        max_tokens: req.maxTokens || 1000,
        top_p: req.topP,
        stop: req.stopSequences,
        tools: req.tools,
        tool_choice: req.toolChoice
      }),
      signal: ctx?.signal || null
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
    }
    
    const data = await response.json();
    const choice = data.choices[0];
    const usage = data.usage;
    
    return {
      text: choice.message.content || '',
      finishReason: choice.finish_reason as any,
      toolCalls: choice.message.tool_calls,
      provider: 'openai',
      model: req.model || 'gpt-3.5-turbo',
      costUSD: (usage.prompt_tokens * 0.001 + usage.completion_tokens * 0.002) / 1000,
      latencyMs: Date.now() - startTime,
      tokensUsed: {
        input: usage.prompt_tokens,
        output: usage.completion_tokens,
        total: usage.total_tokens
      }
    };
  }
}

export class AnthropicProvider implements AIProvider {
  name = "anthropic" as const;
  version = "1.0.0";

  constructor(private config: { apiKey: string; baseUrl?: string }) {}

  capabilities(): AICapability[] {
    return [
      {
        type: 'text',
        subtype: 'generation',
        models: [{
          id: 'claude-3',
          displayName: 'Claude 3',
          contextWindow: 200000,
          maxOutputTokens: 4000,
          pricing: { input: 0.003, output: 0.015, currency: 'USD', lastUpdated: new Date() }
        }]
      }
    ];
  }

  async healthCheck(): Promise<HealthStatus> {
    return { status: 'healthy', lastCheck: new Date() };
  }

  async generateText(req: TextGenerationRequest, ctx?: AIContext): Promise<TextGenerationResult> {
    const startTime = Date.now();
    const response = await fetch(`${this.config.baseUrl || 'https://api.anthropic.com'}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: req.model || 'claude-3-sonnet-20240229',
        messages: [
          { role: 'user', content: req.prompt }
        ],
        max_tokens: req.maxTokens || 4000,
        temperature: req.temperature || 0.7
      }),
      signal: ctx?.signal || null
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`);
    }
    
    const data = await response.json();
    return {
      text: data.content[0].text,
      finishReason: data.stop_reason as any,
      provider: 'anthropic',
      model: req.model || 'claude-3-sonnet-20240229',
      costUSD: (data.usage.input_tokens * 0.003 + data.usage.output_tokens * 0.015) / 1000,
      latencyMs: Date.now() - startTime,
      tokensUsed: {
        input: data.usage.input_tokens,
        output: data.usage.output_tokens,
        total: data.usage.input_tokens + data.usage.output_tokens
      }
    };
  }
}

export class StabilityAIProvider implements AIProvider {
  name = "stability-ai" as const;
  version = "1.0.0";

  constructor(private config: { apiKey: string; baseUrl?: string; model?: string }) {}

  capabilities(): AICapability[] {
    return [
      {
        type: 'image',
        subtype: 'generation',
        models: [{
          id: 'stable-diffusion-xl',
          displayName: 'Stable Diffusion XL',
          contextWindow: 1000,
          maxOutputTokens: 0,
          pricing: { input: 0.04, output: 0, currency: 'USD', lastUpdated: new Date() }
        }]
      }
    ];
  }

  async healthCheck(): Promise<HealthStatus> {
    return { status: 'healthy', lastCheck: new Date() };
  }

  async textToImage(prompt: string, options?: any): Promise<any> {
    const formData = new FormData();
    formData.append('text_prompts[0][text]', prompt);
    formData.append('cfg_scale', String(options?.cfg_scale || 7));
    formData.append('height', String(options?.height || 1024));
    formData.append('width', String(options?.width || 1024));
    formData.append('samples', String(options?.samples || 1));
    formData.append('steps', String(options?.steps || 30));
    
    const response = await fetch(
      `${this.config.baseUrl || 'https://api.stability.ai'}/v1/generation/${this.config.model || 'stable-diffusion-xl-1024-v1-0'}/text-to-image`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Accept': 'application/json'
        },
        body: formData
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`StabilityAI API error: ${error.message || response.statusText}`);
    }
    
    const data = await response.json();
    return data.artifacts.map((artifact: any) => ({
      base64: artifact.base64,
      finishReason: artifact.finishReason
    }));
  }
}

export class HuggingFaceProvider implements AIProvider {
  name = "huggingface" as const;
  version = "1.0.0";

  constructor(private config: { apiKey: string; baseUrl?: string }) {}

  capabilities(): AICapability[] {
    return [
      {
        type: 'text',
        subtype: 'generation',
        models: [{
          id: 'mistral-7b',
          displayName: 'Mistral 7B',
          contextWindow: 8192,
          maxOutputTokens: 2000,
          pricing: { input: 0.0002, output: 0.0002, currency: 'USD', lastUpdated: new Date() }
        }]
      }
    ];
  }

  async healthCheck(): Promise<HealthStatus> {
    return { status: 'healthy', lastCheck: new Date() };
  }

  async generateText(req: TextGenerationRequest, ctx?: AIContext): Promise<TextGenerationResult> {
    const startTime = Date.now();
    const response = await fetch(
      `${this.config.baseUrl || 'https://api-inference.huggingface.co'}/models/${req.model || 'mistralai/Mistral-7B-Instruct-v0.1'}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: req.prompt,
          parameters: {
            max_new_tokens: req.maxTokens || 500,
            temperature: req.temperature || 0.7,
            top_p: req.topP || 0.95,
            do_sample: true
          }
        }),
        signal: ctx?.signal || null
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`HuggingFace API error: ${error.error || response.statusText}`);
    }
    
    const data = await response.json();
    const text = Array.isArray(data) ? data[0].generated_text : data.generated_text;
    
    return {
      text: text || '',
      finishReason: 'stop' as any,
      provider: 'huggingface',
      model: req.model || 'mistralai/Mistral-7B-Instruct-v0.1',
      costUSD: 0.0001, // Estimate
      latencyMs: Date.now() - startTime,
      tokensUsed: {
        input: Math.ceil(req.prompt.length / 4),
        output: Math.ceil((text || '').length / 4),
        total: Math.ceil((req.prompt + (text || '')).length / 4)
      }
    };
  }
}

export class ReplicateProvider implements AIProvider {
  name = "replicate" as const;
  version = "1.0.0";

  constructor(private apiKey: string) {}

  capabilities(): AICapability[] {
    return [
      {
        type: 'image',
        subtype: 'generation',
        models: [{
          id: 'sdxl',
          displayName: 'SDXL on Replicate',
          contextWindow: 1000,
          maxOutputTokens: 0,
          pricing: { input: 0.0023, output: 0, currency: 'USD', lastUpdated: new Date() }
        }]
      }
    ];
  }

  async healthCheck(): Promise<HealthStatus> {
    return { status: 'healthy', lastCheck: new Date() };
  }

  async textToImage(prompt: string, options?: any): Promise<any> {
    // Start prediction
    const createResponse = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: options?.version || 'stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b',
        input: {
          prompt,
          negative_prompt: options?.negative_prompt || '',
          width: options?.width || 1024,
          height: options?.height || 1024,
          num_outputs: options?.num_outputs || 1,
          scheduler: options?.scheduler || 'DPMSolverMultistep',
          num_inference_steps: options?.steps || 25,
          guidance_scale: options?.guidance_scale || 7.5
        }
      })
    });
    
    if (!createResponse.ok) {
      const error = await createResponse.json();
      throw new Error(`Replicate API error: ${error.detail || createResponse.statusText}`);
    }
    
    const prediction = await createResponse.json();
    
    // Poll for completion
    let result = prediction;
    while (result.status === 'starting' || result.status === 'processing') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${result.id}`, {
        headers: {
          'Authorization': `Token ${this.apiKey}`
        }
      });
      
      if (!statusResponse.ok) {
        throw new Error(`Failed to check prediction status: ${statusResponse.statusText}`);
      }
      
      result = await statusResponse.json();
    }
    
    if (result.status === 'failed') {
      throw new Error(`Prediction failed: ${result.error || 'Unknown error'}`);
    }
    
    return result.output;
  }
}

export function createProviders(config: any) {
  const providers: AIProvider[] = [];
  
  if (config.openai?.apiKey) {
    providers.push(new OpenAIProvider(config.openai));
  }
  
  if (config.anthropic?.apiKey) {
    providers.push(new AnthropicProvider(config.anthropic));
  }
  
  if (config.stability?.apiKey) {
    providers.push(new StabilityAIProvider(config.stability));
  }
  
  if (config.huggingface?.apiKey) {
    providers.push(new HuggingFaceProvider(config.huggingface));
  }
  
  if (config.replicate?.apiKey) {
    providers.push(new ReplicateProvider(config.replicate.apiKey));
  }
  
  return providers;
}
