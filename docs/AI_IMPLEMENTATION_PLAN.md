# Comprehensive AI Provider Implementation Plan for VTT Platform

## Executive Summary
This document outlines the technical implementation plan for integrating modern AI providers (Anthropic Claude 4, Google Gemini 2.5, Azure OpenAI GPT-5, and Vertex AI) into the VTT platform's existing AI infrastructure.

## Current State Analysis

### Existing Architecture
- **Registry Pattern**: AIRegistry class for provider registration
- **Router Pattern**: AIRouter with weighted selection and capability-based routing
- **Provider Interface**: Modular AIProvider interface with capability declarations
- **Existing Providers**: OpenAI (GPT-4, DALL-E 3), Anthropic (Claude 3), Stability AI
- **Circuit Breaker**: Basic implementation exists but needs enhancement

### Key Gaps Identified
1. Outdated model versions (Claude 3 instead of Claude 4)
2. Missing Google Gemini integration
3. No Azure OpenAI support
4. Lack of model capability detection
5. No deprecation monitoring system
6. Missing multimodal support for newer models

## Implementation Architecture

### 1. Enhanced Provider Interface

```typescript
// Enhanced provider interface with extended capabilities
export interface AIProvider {
  name: string;
  version: string;
  deprecationDate?: Date;
  
  // Extended capability system
  capabilities(): AICapability[];
  
  // Core methods
  generateText?(req: TextGenerationRequest, ctx?: AIContext): Promise<TextGenerationResult>;
  generateImage?(req: ImageGenerationRequest, ctx?: AIContext): Promise<ImageGenerationResult>;
  generateAudio?(req: AudioGenerationRequest, ctx?: AIContext): Promise<AudioGenerationResult>;
  generateVideo?(req: VideoGenerationRequest, ctx?: AIContext): Promise<VideoGenerationResult>;
  
  // Multimodal methods
  analyzeImage?(req: ImageAnalysisRequest, ctx?: AIContext): Promise<ImageAnalysisResult>;
  analyzeAudio?(req: AudioAnalysisRequest, ctx?: AIContext): Promise<AudioAnalysisResult>;
  transcribe?(req: TranscriptionRequest, ctx?: AIContext): Promise<TranscriptionResult>;
  
  // Embedding methods
  generateEmbedding?(req: EmbeddingRequest, ctx?: AIContext): Promise<EmbeddingResult>;
  
  // Health check
  healthCheck(): Promise<HealthStatus>;
}

export interface AICapability {
  type: 'text' | 'image' | 'audio' | 'video' | 'embedding' | 'multimodal';
  subtype?: string; // e.g., 'generation', 'analysis', 'transcription'
  models: ModelInfo[];
  limits?: CapabilityLimits;
}

export interface ModelInfo {
  id: string;
  displayName: string;
  contextWindow: number;
  maxOutputTokens: number;
  supportedFormats?: string[];
  pricing: PricingInfo;
  deprecationDate?: Date;
  replacementModel?: string;
}
```

### 2. Provider-Agnostic Model Mapping System

```typescript
export class ModelMapper {
  private modelMappings: Map<string, ModelMapping>;
  
  constructor() {
    this.initializeMappings();
  }
  
  private initializeMappings() {
    // Universal model categories
    this.modelMappings.set('flagship-reasoning', {
      providers: {
        'anthropic': 'claude-4-opus-4.1',
        'openai': 'gpt-4o',
        'google': 'gemini-2.5-pro',
        'azure': 'gpt-5',
        'vertex': 'gemini-2.0-flash'
      },
      capabilities: ['text', 'multimodal', 'reasoning'],
      contextWindow: 1000000,
      fallbackChain: ['anthropic', 'google', 'openai', 'azure']
    });
    
    this.modelMappings.set('balanced-performance', {
      providers: {
        'anthropic': 'claude-4-sonnet-4',
        'openai': 'gpt-4o-mini',
        'google': 'gemini-2.5-flash',
        'azure': 'gpt-5-mini'
      },
      capabilities: ['text', 'multimodal'],
      contextWindow: 200000,
      fallbackChain: ['google', 'anthropic', 'openai']
    });
    
    this.modelMappings.set('cost-optimized', {
      providers: {
        'google': 'gemini-2.5-flash-lite',
        'azure': 'gpt-5-nano',
        'openai': 'gpt-4o-mini'
      },
      capabilities: ['text'],
      contextWindow: 100000,
      fallbackChain: ['google', 'azure', 'openai']
    });
  }
  
  getModelForCategory(category: string, provider: string): string | undefined {
    return this.modelMappings.get(category)?.providers[provider];
  }
  
  getFallbackChain(category: string): string[] {
    return this.modelMappings.get(category)?.fallbackChain || [];
  }
}
```

## Provider Implementations

### 3. Anthropic Claude 4 Provider

```typescript
export class AnthropicClaude4Provider implements AIProvider {
  name = 'anthropic';
  version = '4.1.0';
  
  private models = {
    'claude-4-opus-4.1': {
      contextWindow: 200000,
      maxOutput: 4096,
      pricing: { input: 0.015, output: 0.075 }
    },
    'claude-4-sonnet-4': {
      contextWindow: 200000,
      maxOutput: 4096,
      pricing: { input: 0.003, output: 0.015 }
    },
    'claude-4-opus-4': {
      contextWindow: 200000,
      maxOutput: 4096,
      pricing: { input: 0.012, output: 0.060 }
    }
  };
  
  async generateText(req: TextGenerationRequest, ctx?: AIContext): Promise<TextGenerationResult> {
    const model = req.model || 'claude-4-opus-4.1';
    
    // Enhanced request with new Claude 4 features
    const enhancedRequest = {
      model,
      messages: this.formatMessages(req),
      max_tokens: req.maxTokens || 4096,
      temperature: req.temperature || 0.7,
      system: req.systemPrompt,
      
      // Claude 4 specific features
      thinking_mode: req.reasoning ? 'explicit' : 'implicit',
      output_format: req.outputFormat || 'text',
      safety_level: req.safetyLevel || 'standard',
      
      // Tool use support
      tools: req.tools,
      tool_choice: req.toolChoice
    };
    
    // Implementation with retry logic and circuit breaker
    return await this.executeWithCircuitBreaker(async () => {
      const response = await this.makeAPICall('/messages', enhancedRequest, ctx);
      return this.parseResponse(response, model);
    });
  }
}
```

### 4. Google Gemini Provider

```typescript
export class GeminiProvider implements AIProvider {
  name = 'gemini';
  version = '2.5.0';
  
  private models = {
    'gemini-2.5-pro': {
      contextWindow: 1000000,
      maxOutput: 8192,
      pricing: { input: 0.00125, output: 0.005 },
      capabilities: ['text', 'image', 'audio', 'video']
    },
    'gemini-2.5-flash': {
      contextWindow: 1000000,
      maxOutput: 8192,
      pricing: { input: 0.00025, output: 0.001 },
      capabilities: ['text', 'image']
    },
    'gemini-2.5-flash-lite': {
      contextWindow: 1000000,
      maxOutput: 8192,
      pricing: { input: 0.0001, output: 0.0004 },
      capabilities: ['text']
    },
    'gemini-2.5-flash-live-001': {
      contextWindow: 1000000,
      capabilities: ['text', 'audio', 'video', 'realtime']
    }
  };
  
  async generateText(req: TextGenerationRequest, ctx?: AIContext): Promise<TextGenerationResult> {
    const model = req.model || 'gemini-2.5-pro';
    
    const request = {
      contents: this.formatContents(req),
      generationConfig: {
        temperature: req.temperature || 0.7,
        topK: req.topK || 40,
        topP: req.topP || 0.95,
        maxOutputTokens: req.maxTokens || 8192,
        stopSequences: req.stopSequences
      },
      safetySettings: this.getSafetySettings(req.safetyLevel),
      
      // Gemini specific features
      systemInstruction: req.systemPrompt,
      tools: req.tools,
      toolConfig: req.toolConfig,
      cachedContent: req.cachedContent // For context caching
    };
    
    return await this.executeWithRetry(async () => {
      const response = await this.makeAPICall(`/models/${model}:generateContent`, request, ctx);
      return this.parseResponse(response, model);
    });
  }
  
  async generateImage(req: ImageGenerationRequest, ctx?: AIContext): Promise<ImageGenerationResult> {
    const model = 'gemini-2.5-flash-image-preview';
    
    const request = {
      prompt: req.prompt,
      negativePrompt: req.negativePrompt,
      numberOfImages: req.count || 1,
      aspectRatio: req.aspectRatio || '1:1',
      outputFormat: req.format || 'png',
      
      // Gemini image specific
      stylePreset: req.stylePreset,
      guidanceScale: req.guidanceScale || 7.5
    };
    
    return await this.executeWithRetry(async () => {
      const response = await this.makeAPICall(`/models/${model}:generateImage`, request, ctx);
      return this.parseImageResponse(response, model);
    });
  }
}
```

### 5. Azure OpenAI Provider

```typescript
export class AzureOpenAIProvider implements AIProvider {
  name = 'azure-openai';
  version = '5.0.0';
  
  private deployments = new Map<string, DeploymentConfig>();
  
  constructor(private config: AzureConfig) {
    this.initializeDeployments();
  }
  
  private initializeDeployments() {
    // GPT-5 models (require registration)
    this.deployments.set('gpt-5', {
      endpoint: `${this.config.endpoint}/openai/deployments/gpt-5`,
      apiVersion: '2025-08-01-preview',
      requiresRegistration: true,
      capabilities: ['text', 'reasoning', 'tools'],
      limits: { rpm: 10, tpm: 150000 }
    });
    
    this.deployments.set('gpt-5-mini', {
      endpoint: `${this.config.endpoint}/openai/deployments/gpt-5-mini`,
      apiVersion: '2025-08-01-preview',
      capabilities: ['text', 'tools'],
      limits: { rpm: 100, tpm: 500000 }
    });
    
    // Multimodal models
    this.deployments.set('gpt-4o', {
      endpoint: `${this.config.endpoint}/openai/deployments/gpt-4o`,
      apiVersion: '2024-08-01-preview',
      capabilities: ['text', 'vision', 'tools'],
      limits: { rpm: 500, tpm: 300000 }
    });
  }
  
  async generateText(req: TextGenerationRequest, ctx?: AIContext): Promise<TextGenerationResult> {
    const deployment = req.model || 'gpt-5';
    const config = this.deployments.get(deployment);
    
    if (!config) {
      throw new Error(`Unknown deployment: ${deployment}`);
    }
    
    if (config.requiresRegistration && !this.config.registrationKey) {
      throw new Error(`Deployment ${deployment} requires registration`);
    }
    
    const request = {
      messages: this.formatMessages(req),
      max_tokens: req.maxTokens || 4096,
      temperature: req.temperature || 0.7,
      
      // Azure specific
      deployment_id: deployment,
      api_version: config.apiVersion,
      
      // GPT-5 features
      reasoning_effort: req.reasoningEffort || 'standard',
      output_structure: req.outputStructure,
      
      // Enhanced tool use
      tools: req.tools,
      tool_choice: req.toolChoice,
      parallel_tool_calls: req.parallelToolCalls !== false
    };
    
    return await this.executeWithRateLimit(deployment, async () => {
      const response = await this.makeAPICall(config.endpoint, request, ctx);
      return this.parseResponse(response, deployment);
    });
  }
}
```

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
1. **Update Core Interfaces**
   - Extend AIProvider interface with new capabilities
   - Implement ModelInfo and deprecation tracking
   - Create enhanced AIContext with tracing

2. **Implement Model Mapper**
   - Create provider-agnostic model categories
   - Build fallback chain logic
   - Add model equivalence mappings

### Phase 2: Provider Implementation (Week 3-4)
1. **Anthropic Claude 4**
   - Update to Claude 4 models
   - Implement enhanced reasoning features
   - Add tool use support

2. **Google Gemini**
   - Implement Gemini 2.5 series
   - Add multimodal capabilities
   - Integrate specialized variants (TTS, image)

3. **Azure OpenAI**
   - Implement GPT-5 series (with registration)
   - Add deployment management
   - Implement rate limiting per deployment

### Phase 3: Advanced Features (Week 5-6)
1. **Capability Detection**
   - Build automatic capability discovery
   - Implement task-to-provider matching
   - Add constraint-based selection

2. **Deprecation Monitoring**
   - Create deprecation scanner
   - Build migration plan generator
   - Add notification system

3. **Enhanced Circuit Breaker**
   - Implement per-provider circuit states
   - Add metrics collection
   - Build automatic fallback chains

### Phase 4: VTT Integration (Week 7-8)
1. **Game Content Generation**
   - Adapt providers for VTT-specific content
   - Implement specialized prompts for NPCs, locations, quests
   - Add D&D 5e rule compliance

2. **Real-time Features**
   - Integrate Gemini Live API for real-time interactions
   - Add voice transcription for game sessions
   - Implement AI-powered combat narration

3. **Asset Generation**
   - Connect image generation for tokens and maps
   - Implement style consistency across providers
   - Add batch generation support

## Configuration Management

### Environment-Based Configuration
```typescript
export interface AIConfig {
  providers: {
    anthropic?: {
      apiKey: string;
      baseURL?: string;
      models: string[];
    };
    google?: {
      apiKey: string;
      projectId?: string;
      models: string[];
    };
    azure?: {
      apiKey: string;
      endpoint: string;
      deployments: Record<string, string>;
      registrationKey?: string;
    };
    vertex?: {
      projectId: string;
      location: string;
      serviceAccountKey: string;
    };
  };
  routing: {
    defaultPolicy: RoutingPolicy;
    categoryPolicies: Record<string, RoutingPolicy>;
  };
  circuitBreaker: {
    failureThreshold: number;
    resetTimeoutMs: number;
    monitoringWindowMs: number;
  };
  caching: {
    enabled: boolean;
    ttlMs: number;
    maxSize: number;
  };
}
```

## Success Metrics
- **Reliability**: 99.9% uptime across all providers
- **Performance**: <2s average response time for text generation
- **Cost**: 20% reduction in AI costs through optimal routing
- **User Satisfaction**: Seamless integration with VTT workflows
