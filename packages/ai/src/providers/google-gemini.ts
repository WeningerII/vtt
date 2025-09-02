/**
 * Google Gemini 2.5 provider with multimodal capabilities
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
  AudioGenerationRequest,
  AudioGenerationResult,
  TranscriptionRequest,
  TranscriptionResult,
  HealthStatus,
  ModelInfo,
  Tool,
  ToolCall
} from '../types';

export interface GeminiProviderOptions {
  apiKey: string;
  baseURL?: string;
  projectId?: string;
  defaultModel?: string;
}

export class GeminiProvider implements AIProvider {
  name = 'gemini';
  version = '2.5.0';
  
  private apiKey: string;
  private baseURL: string;
  private projectId?: string;
  private defaultModel: string;

  private models: Record<string, ModelInfo> = {
    'gemini-2.5-pro': {
      id: 'gemini-2.5-pro',
      displayName: 'Gemini 2.5 Pro',
      contextWindow: 1000000,
      maxOutputTokens: 8192,
      supportedFormats: ['text', 'image', 'audio', 'video', 'pdf'],
      pricing: {
        input: 0.00125,
        output: 0.005,
        currency: 'USD',
        lastUpdated: new Date('2025-09-01')
      },
      features: [
        { name: 'multimodal', description: 'Text, image, audio, video processing', enabled: true },
        { name: 'long-context', description: '1M+ token context window', enabled: true },
        { name: 'tool-use', description: 'Function calling support', enabled: true },
        { name: 'reasoning', description: 'Advanced reasoning capabilities', enabled: true }
      ]
    },
    'gemini-2.5-flash': {
      id: 'gemini-2.5-flash',
      displayName: 'Gemini 2.5 Flash',
      contextWindow: 1000000,
      maxOutputTokens: 8192,
      supportedFormats: ['text', 'image'],
      pricing: {
        input: 0.00025,
        output: 0.001,
        currency: 'USD',
        lastUpdated: new Date('2025-09-01')
      },
      features: [
        { name: 'fast-inference', description: 'Optimized for speed', enabled: true },
        { name: 'multimodal', description: 'Text and image processing', enabled: true },
        { name: 'tool-use', description: 'Function calling support', enabled: true }
      ]
    },
    'gemini-2.5-flash-lite': {
      id: 'gemini-2.5-flash-lite',
      displayName: 'Gemini 2.5 Flash Lite',
      contextWindow: 1000000,
      maxOutputTokens: 8192,
      supportedFormats: ['text'],
      pricing: {
        input: 0.0001,
        output: 0.0004,
        currency: 'USD',
        lastUpdated: new Date('2025-09-01')
      },
      features: [
        { name: 'cost-optimized', description: 'Most cost-effective option', enabled: true },
        { name: 'text-only', description: 'Text processing only', enabled: true }
      ]
    },
    'gemini-2.5-flash-live-001': {
      id: 'gemini-2.5-flash-live-001',
      displayName: 'Gemini 2.5 Flash Live',
      contextWindow: 1000000,
      maxOutputTokens: 8192,
      supportedFormats: ['text', 'audio', 'video'],
      pricing: {
        input: 0.0005,
        output: 0.002,
        currency: 'USD',
        lastUpdated: new Date('2025-09-01')
      },
      features: [
        { name: 'realtime', description: 'Real-time audio/video processing', enabled: true },
        { name: 'streaming', description: 'Streaming responses', enabled: true },
        { name: 'live-api', description: 'Live API support', enabled: true }
      ]
    },
    'gemini-2.5-flash-image-preview': {
      id: 'gemini-2.5-flash-image-preview',
      displayName: 'Gemini 2.5 Flash Image',
      contextWindow: 100000,
      maxOutputTokens: 4096,
      supportedFormats: ['text'],
      pricing: {
        input: 0.001,
        output: 0.004,
        currency: 'USD',
        lastUpdated: new Date('2025-09-01')
      },
      features: [
        { name: 'image-generation', description: 'Text-to-image generation', enabled: true }
      ]
    },
    'gemini-2.5-flash-preview-tts': {
      id: 'gemini-2.5-flash-preview-tts',
      displayName: 'Gemini 2.5 Flash TTS',
      contextWindow: 100000,
      maxOutputTokens: 4096,
      supportedFormats: ['text'],
      pricing: {
        input: 0.0005,
        output: 0.002,
        currency: 'USD',
        lastUpdated: new Date('2025-09-01')
      },
      features: [
        { name: 'text-to-speech', description: 'High-quality TTS', enabled: true }
      ]
    }
  };

  constructor(options: GeminiProviderOptions) {
    this.apiKey = options.apiKey;
    this.baseURL = options.baseURL || 'https://generativelanguage.googleapis.com/v1beta';
    this.projectId = options.projectId ?? '';
    this.defaultModel = options.defaultModel || 'gemini-2.5-pro';
  }

  capabilities(): AICapability[] {
    return [
      {
        type: 'text',
        subtype: 'generation',
        models: Object.values(this.models).filter(m => 
          m.features?.some(f => f.name === 'text-only' || f.name === 'multimodal')
        ),
        limits: {
          maxRequestsPerMinute: 60,
          maxTokensPerRequest: 1000000,
          maxConcurrentRequests: 10
        }
      },
      {
        type: 'image',
        subtype: 'generation',
        models: Object.values(this.models).filter(m => m.id === 'gemini-2.5-flash-image-preview'),
        limits: {
          maxRequestsPerMinute: 20,
          maxFileSize: 20 * 1024 * 1024
        }
      },
      {
        type: 'audio',
        subtype: 'generation',
        models: Object.values(this.models).filter(m => m.id === 'gemini-2.5-flash-preview-tts'),
        limits: {
          maxRequestsPerMinute: 30
        }
      },
      {
        type: 'multimodal',
        subtype: 'analysis',
        models: Object.values(this.models).filter(m => 
          m.features?.some(f => f.name === 'multimodal')
        ),
        limits: {
          maxRequestsPerMinute: 40,
          maxFileSize: 50 * 1024 * 1024
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
      const contents = this.formatContents(req);
      const requestBody = {
        contents,
        generationConfig: {
          temperature: req.temperature || 0.7,
          topK: req.topK || 40,
          topP: req.topP || 0.95,
          maxOutputTokens: Math.min(req.maxTokens || 8192, modelInfo.maxOutputTokens),
          stopSequences: req.stopSequences
        },
        safetySettings: this.getSafetySettings(req.safetyLevel),
        systemInstruction: req.systemPrompt ? {
          parts: [{ text: req.systemPrompt }]
        } : undefined,
        tools: req.tools ? this.formatTools(req.tools) : undefined,
        toolConfig: req.toolChoice ? this.formatToolConfig(req.toolChoice) : undefined,
        cachedContent: req.cachedContent
      };

      const response = await this.makeAPICall(`/models/${model}:generateContent`, requestBody, ctx);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const candidate = data.candidates?.[0];
      
      if (!candidate) {
        throw new Error('No response candidate generated');
      }

      const text = this.extractText(candidate);
      const usage = data.usageMetadata || { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 };

      const costUSD = this.calculateCost(usage, modelInfo);

      const result: TextGenerationResult = {
        provider: this.name,
        model,
        costUSD,
        latencyMs: Date.now() - start,
        tokensUsed: {
          input: usage.promptTokenCount,
          output: usage.candidatesTokenCount,
          total: usage.totalTokenCount
        },
        text,
        finishReason: data.candidates?.[0]?.finishReason === 'STOP' ? 'stop' : 
                   data.candidates?.[0]?.finishReason === 'MAX_TOKENS' ? 'length' :
                   data.candidates?.[0]?.finishReason === 'SAFETY' ? 'content_filter' : 'stop',
        toolCalls: this.extractToolCalls(candidate) || []
      };

      return result;
    } catch (error) {
      throw new Error(
        `Gemini text generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async generateImage(req: ImageGenerationRequest, ctx?: AIContext): Promise<ImageGenerationResult> {
    const start = Date.now();
    const model = 'gemini-2.5-flash-image-preview';
    const modelInfo = this.models[model];

    try {
      const requestBody = {
        prompt: req.prompt,
        negativePrompt: req.negativePrompt,
        numberOfImages: req.count || 1,
        aspectRatio: req.aspectRatio || '1:1',
        outputFormat: req.format || 'png',
        stylePreset: req.stylePreset,
        guidanceScale: req.guidanceScale || 7.5,
        seed: req.seed
      };

      const response = await this.makeAPICall(`/models/${model}:generateImage`, requestBody, ctx);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const images = data.images?.map((img: any, index: number) => ({
        uri: img.uri || `data:image/${req.format || 'png'};base64,${img.data}`,
        width: req.width || 1024,
        height: req.height || 1024,
        mimeType: `image/${req.format || 'png'}`
      })) || [];

      // Estimate cost for image generation
      const estimatedCost = (req.count || 1) * 0.01; // Rough estimate

      return {
        provider: this.name,
        model,
        costUSD: estimatedCost,
        latencyMs: Date.now() - start,
        images,
        seed: 0,
        revisedPrompt: data.data?.[0]?.revised_prompt
      };
    } catch (error) {
      throw new Error(
        `Gemini image generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async generateAudio(req: AudioGenerationRequest, ctx?: AIContext): Promise<AudioGenerationResult> {
    const start = Date.now();
    const model = 'gemini-2.5-flash-preview-tts';
    const modelInfo = this.models[model];

    if (!req.text) {
      throw new Error('Text is required for audio generation');
    }

    try {
      const requestBody = {
        input: {
          text: req.text
        },
        voice: {
          languageCode: 'en-US',
          name: req.voice || 'en-US-Standard-A',
          ssmlGender: 'NEUTRAL'
        },
        audioConfig: {
          audioEncoding: req.format?.toUpperCase() || 'MP3',
          speakingRate: req.speed || 1.0,
          pitch: 0.0,
          volumeGainDb: 0.0
        }
      };

      const response = await this.makeAPICall(`/models/${model}:synthesize`, requestBody, ctx);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const audioContent = data.audioContent;

      if (!audioContent) {
        throw new Error('No audio content generated');
      }

      // Estimate cost based on character count
      const charCount = req.text.length;
      const estimatedCost = (charCount / 1000000) * 16; // $16 per 1M characters

      return {
        provider: this.name,
        model,
        costUSD: estimatedCost,
        latencyMs: Date.now() - start,
        audio: {
          uri: `data:audio/${req.format || 'mp3'};base64,${audioContent}`,
          mimeType: `audio/${req.format || 'mp3'}`
        }
      };
    } catch (error) {
      throw new Error(
        `Gemini audio generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async analyzeImage(req: ImageAnalysisRequest, ctx?: AIContext): Promise<ImageAnalysisResult> {
    const start = Date.now();
    const model = req.model || 'gemini-2.5-pro';
    const modelInfo = this.models[model];

    if (!modelInfo) {
      throw new Error(`Unknown model: ${model}`);
    }

    try {
      const contents = [{
        parts: [
          { text: req.prompt },
          {
            inlineData: {
              mimeType: req.image.mimeType || 'image/jpeg',
              data: await this.imageToBase64(req.image.uri)
            }
          }
        ]
      }];

      const requestBody = {
        contents,
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: req.maxTokens || 1000
        }
      };

      const response = await this.makeAPICall(`/models/${model}:generateContent`, requestBody, ctx);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const candidate = data.candidates?.[0];
      
      if (!candidate) {
        throw new Error('No analysis generated');
      }

      const analysis = this.extractText(candidate);
      const usage = data.usageMetadata || { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 };

      const costUSD = this.calculateCost(usage, modelInfo);

      return {
        provider: this.name,
        model,
        costUSD,
        latencyMs: Date.now() - start,
        tokensUsed: {
          input: usage.promptTokenCount,
          output: usage.candidatesTokenCount,
          total: usage.totalTokenCount
        },
        analysis,
        confidence: 0.85
      };
    } catch (error) {
      throw new Error(
        `Gemini image analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async healthCheck(): Promise<HealthStatus> {
    const start = Date.now();
    
    try {
      const response = await fetch(`${this.baseURL}/models/gemini-2.5-flash:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: 'Health check' }]
          }],
          generationConfig: {
            maxOutputTokens: 10
          }
        })
      });

      const latency = Date.now() - start;

      if (response.ok) {
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
            seed: 0,
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
    const url = `${this.baseURL}${endpoint}?key=${this.apiKey}`;
    
    const requestOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
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

  private formatContents(req: TextGenerationRequest): any[] {
    const parts = [{ text: req.prompt }];
    
    if (req.context) {
      return [
        { parts: [{ text: req.context }] },
        { parts }
      ];
    }
    
    return [{ parts }];
  }

  private formatTools(tools: Tool[]): any[] {
    return [{
      functionDeclarations: tools.map(tool => ({
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters
      }))
    }];
  }

  private formatToolConfig(toolChoice: any): any {
    if (toolChoice === 'auto') {
      return { functionCallingConfig: { mode: 'AUTO' } };
    } else if (toolChoice === 'none') {
      return { functionCallingConfig: { mode: 'NONE' } };
    } else if (typeof toolChoice === 'object' && toolChoice.function) {
      return {
        functionCallingConfig: {
          mode: 'ANY',
          allowedFunctionNames: [toolChoice.function.name]
        }
      };
    }
    return undefined;
  }

  private getSafetySettings(level?: string): any[] {
    const threshold = level === 'high' ? 'BLOCK_LOW_AND_ABOVE' :
                     level === 'low' ? 'BLOCK_ONLY_HIGH' :
                     'BLOCK_MEDIUM_AND_ABOVE';

    return [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold }
    ];
  }

  private extractText(candidate: any): string {
    return candidate.content?.parts
      ?.filter((part: any) => part.text)
      ?.map((part: any) => part.text)
      ?.join('') || '';
  }

  private extractToolCalls(candidate: any): ToolCall[] | undefined {
    const functionCalls = candidate.content?.parts
      ?.filter((part: any) => part.functionCall)
      ?.map((part: any, index: number) => ({
        id: `call_${index}`,
        type: 'function' as const,
        function: {
          name: part.functionCall.name,
          arguments: JSON.stringify(part.functionCall.args || {})
        }
      }));
    
    return functionCalls?.length > 0 ? functionCalls : undefined;
  }

  private mapFinishReason(reason: string): TextGenerationResult['finishReason'] {
    switch (reason) {
      case 'STOP':
        return 'stop';
      case 'MAX_TOKENS':
        return 'length';
      case 'SAFETY':
        return 'content_filter';
      case 'RECITATION':
        return 'content_filter';
      default:
        return 'stop';
    }
  }

  private calculateCost(usage: any, modelInfo: ModelInfo): number {
    const inputCost = (usage.promptTokenCount / 1000) * modelInfo.pricing.input;
    const outputCost = (usage.candidatesTokenCount / 1000) * modelInfo.pricing.output;
    return inputCost + outputCost;
  }

  private async imageToBase64(uri: string): Promise<string> {
    if (uri.startsWith('data:')) {
      return uri?.split(',')[1] || '';
    }
    
    const response = await fetch(uri);
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer).toString('base64');
  }
}
