/**
 * Provider-agnostic model mapping system for intelligent model selection
 */

import { ModelInfo, ModelMapping, TaskConstraints, ModelSelection } from './types';

export class ModelMapper {
  private modelMappings: Map<string, ModelMapping> = new Map();
  
  constructor() {
    this.initializeMappings();
  }
  
  private initializeMappings() {
    // Universal model categories with fallback chains
    this.modelMappings.set('flagship-reasoning', {
      providers: {
        'anthropic': 'claude-4-opus-4.1',
        'openai': 'gpt-4o',
        'google': 'gemini-2.5-pro',
        'azure': 'gpt-5',
        'vertex': 'gemini-2.0-flash-001'
      },
      capabilities: ['text', 'multimodal', 'reasoning', 'long-context'],
      contextWindow: 200000,
      fallbackChain: ['anthropic', 'google', 'azure', 'openai'],
      costTier: 'high'
    });
    
    this.modelMappings.set('balanced-performance', {
      providers: {
        'anthropic': 'claude-4-sonnet-4',
        'openai': 'gpt-4o-mini',
        'google': 'gemini-2.5-flash',
        'azure': 'gpt-5-mini',
        'vertex': 'gemini-2.5-flash'
      },
      capabilities: ['text', 'multimodal', 'fast-inference'],
      contextWindow: 128000,
      fallbackChain: ['google', 'anthropic', 'azure', 'openai'],
      costTier: 'medium'
    });
    
    this.modelMappings.set('cost-optimized', {
      providers: {
        'google': 'gemini-2.5-flash-lite',
        'azure': 'gpt-5-nano',
        'openai': 'gpt-4o-mini',
        'anthropic': 'claude-4-sonnet-4'
      },
      capabilities: ['text', 'cost-efficient'],
      contextWindow: 64000,
      fallbackChain: ['google', 'azure', 'openai', 'anthropic'],
      costTier: 'low'
    });
    
    this.modelMappings.set('multimodal-analysis', {
      providers: {
        'google': 'gemini-2.5-pro',
        'openai': 'gpt-4o',
        'azure': 'gpt-4o',
        'anthropic': 'claude-4-opus-4.1'
      },
      capabilities: ['multimodal', 'vision', 'audio', 'analysis'],
      contextWindow: 128000,
      fallbackChain: ['google', 'openai', 'azure', 'anthropic'],
      costTier: 'medium'
    });
    
    this.modelMappings.set('image-generation', {
      providers: {
        'google': 'gemini-2.5-flash-image-preview',
        'azure': 'dall-e-3',
        'openai': 'dall-e-3'
      },
      capabilities: ['image-generation'],
      contextWindow: 4000,
      fallbackChain: ['google', 'azure', 'openai'],
      costTier: 'medium'
    });
    
    this.modelMappings.set('audio-generation', {
      providers: {
        'google': 'gemini-2.5-flash-preview-tts',
        'vertex': 'text-to-speech'
      },
      capabilities: ['audio-generation', 'tts'],
      contextWindow: 4000,
      fallbackChain: ['google', 'vertex'],
      costTier: 'low'
    });
    
    this.modelMappings.set('realtime-interaction', {
      providers: {
        'google': 'gemini-2.5-flash-live-001'
      },
      capabilities: ['realtime', 'streaming', 'live-api'],
      contextWindow: 100000,
      fallbackChain: ['google'],
      costTier: 'medium'
    });
    
    this.modelMappings.set('embeddings', {
      providers: {
        'azure': 'text-embedding-3-large',
        'openai': 'text-embedding-3-large'
      },
      capabilities: ['embeddings', 'similarity'],
      contextWindow: 8191,
      fallbackChain: ['azure', 'openai'],
      costTier: 'low'
    });
    
    // VTT-specific categories
    this.modelMappings.set('vtt-content-generation', {
      providers: {
        'anthropic': 'claude-4-sonnet-4',
        'google': 'gemini-2.5-flash',
        'azure': 'gpt-5-chat'
      },
      capabilities: ['text', 'creative-writing', 'structured-output'],
      contextWindow: 128000,
      fallbackChain: ['anthropic', 'google', 'azure'],
      costTier: 'medium'
    });
    
    this.modelMappings.set('vtt-image-assets', {
      providers: {
        'google': 'gemini-2.5-flash-image-preview',
        'azure': 'dall-e-3'
      },
      capabilities: ['image-generation', 'fantasy-art'],
      contextWindow: 4000,
      fallbackChain: ['google', 'azure'],
      costTier: 'medium'
    });
  }
  
  getModelForCategory(category: string, provider: string): string | undefined {
    const mapping = this.modelMappings.get(category);
    return mapping?.providers[provider];
  }
  
  getFallbackChain(category: string): string[] {
    const mapping = this.modelMappings.get(category);
    return mapping?.fallbackChain || [];
  }
  
  getCategoryCapabilities(category: string): string[] {
    const mapping = this.modelMappings.get(category);
    return mapping?.capabilities || [];
  }
  
  getAvailableCategories(): string[] {
    return Array.from(this.modelMappings.keys());
  }
  
  findCategoriesForCapability(capability: string): string[] {
    const categories: string[] = [];
    
    for (const [category, mapping] of this.modelMappings) {
      if (mapping.capabilities.includes(capability)) {
        categories.push(category);
      }
    }
    
    return categories;
  }
  
  getBestCategoryForTask(
    requiredCapabilities: string[],
    constraints?: TaskConstraints
  ): string | null {
    const candidateCategories = this.getAvailableCategories().filter(category => {
      const mapping = this.modelMappings.get(category)!;
      
      // Check if category supports all required capabilities
      const hasAllCapabilities = requiredCapabilities.every(cap => 
        mapping.capabilities.includes(cap)
      );
      
      if (!hasAllCapabilities) {return false;}
      
      // Apply constraints
      if (constraints?.minContextWindow && mapping.contextWindow < constraints.minContextWindow) {
        return false;
      }
      
      if (constraints?.maxCost) {
        const costTierLimits = { low: 0.01, medium: 0.05, high: 0.15 };
        const maxCostForTier = costTierLimits[mapping.costTier || 'medium'];
        if (maxCostForTier > constraints.maxCost) {
          return false;
        }
      }
      
      return true;
    });
    
    if (candidateCategories.length === 0) {return null;}
    
    // Score categories based on cost efficiency and capability match
    const scored = candidateCategories.map(category => {
      const mapping = this.modelMappings.get(category)!;
      
      let score = 0;
      
      // Prefer categories with exact capability matches
      const exactMatches = requiredCapabilities.filter(cap => 
        mapping.capabilities.includes(cap)
      ).length;
      score += exactMatches * 10;
      
      // Prefer lower cost tiers
      const costScore = mapping.costTier === 'low' ? 5 : 
                      mapping.costTier === 'medium' ? 3 : 1;
      score += costScore;
      
      return { category, score };
    }).sort((a, b) => b.score - a.score);
    
    return scored[0]?.category || 'general';
  }
  
  scoreCategory(category: string, constraints?: TaskConstraints): number {
    const mapping = this.modelMappings.get(category)!;
    
    let score = 0;
    
    // Prefer categories with exact capability matches
    const exactMatches = constraints?.requiredCapabilities?.filter(cap => 
      mapping.capabilities.includes(cap)
    ).length || 0;
    score += exactMatches * 10;
    
    // Prefer lower cost tiers
    const costScore = mapping.costTier === 'low' ? 5 : 
                    mapping.costTier === 'medium' ? 3 : 1;
    score += costScore;
    
    // Prefer categories with more fallback options
    score += mapping.fallbackChain.length;
    
    return score;
  }
  
  getProviderPreference(
    category: string,
    availableProviders: string[],
    constraints?: TaskConstraints
  ): { provider: string; model: string; fallbacks: string[] } | null {
    const mapping = this.modelMappings.get(category);
    if (!mapping) {return null;}
    
    const provider = this.selectProvider(category, constraints);
    const model = this.getModelForCategory(category, provider);
    
    return {
      provider,
      model: model || 'gpt-4',
      fallbacks: this.getFallbackChain(category)
    };
  }
  
  async selectModelWithFallback(request: any, constraints?: TaskConstraints): Promise<{ provider: string; model: string }> {
    const category = this.selectCategoryForRequest(request, constraints);
    const provider = this.selectProvider(category, constraints);
    const model = this.getModelForCategory(category, provider);
    
    // Return primary selection
    return { provider, model: model || 'gpt-4' };
  }
  
  private selectCategoryForRequest(request: any, constraints?: TaskConstraints): string {
    // Determine category based on request type and constraints
    if (constraints?.requiredCapabilities) {
      const categories = Array.from(this.modelMappings.keys());
      for (const category of categories) {
        const mapping = this.modelMappings.get(category)!;
        const hasAllCapabilities = constraints.requiredCapabilities.every(cap => 
          mapping.capabilities.includes(cap)
        );
        if (hasAllCapabilities) {
          return category;
        }
      }
    }
    
    // Default category selection based on request type
    if (request?.type === 'text') {return 'balanced-performance';}
    if (request?.type === 'image') {return 'vision-multimodal';}
    if (request?.type === 'audio') {return 'audio-processing';}
    if (request?.type === 'video') {return 'video-generation';}
    
    return 'general';
  }
  
  private getProvidersForCategory(category: string): string[] {
    const mapping = this.modelMappings.get(category);
    if (!mapping) {return ['openai'];}
    return Object.keys(mapping.providers);
  }
  
  private getDefaultModel(provider: string): string {
    // Default models for each provider
    const defaults: Record<string, string> = {
      'openai': 'gpt-4',
      'anthropic': 'claude-3-opus-20240229',
      'google': 'gemini-pro',
      'azure': 'gpt-4',
      'mistral': 'mistral-large-latest'
    };
    return defaults[provider] || 'gpt-4';
  }
  
  selectProvider(category: string, constraints?: TaskConstraints): string {
    // Provider selection logic based on category and constraints
    const mapping = this.modelMappings.get(category);
    if (!mapping) {return 'openai';}
    
    const providers = Object.keys(mapping.providers);
    
    if (constraints?.excludeProviders) {
      const filtered = providers.filter(p => !constraints.excludeProviders?.includes(p));
      if (filtered.length > 0) {return filtered[0]!;}
    }
    
    return providers[0] || 'openai';
  }
  
  getModelForTask(task: string, provider?: string): { provider: string; model: string } {
    // Map task to category - default to 'general' for unknown tasks
    const category = this.getDefaultCategoryForTask(task);
    const selectedProvider = provider || this.selectProvider(category);
    const model = this.getModelForCategory(category, selectedProvider);
    
    return { provider: selectedProvider, model: model || 'gpt-4' };
  }
  
  private getDefaultCategoryForTask(task: string): string {
    // Simple task to category mapping
    const taskMappings: Record<string, string> = {
      'reasoning': 'flagship-reasoning',
      'coding': 'coding-specialized',
      'chat': 'balanced-performance',
      'image': 'vision-multimodal',
      'audio': 'audio-processing',
      'video': 'video-generation',
      'embedding': 'embedding-specialized'
    };
    
    // Check if task contains any known keywords
    for (const [keyword, category] of Object.entries(taskMappings)) {
      if (task.toLowerCase().includes(keyword)) {
        return category;
      }
    }
    
    return 'general';
  }
  
  // Dynamic mapping updates
  updateMapping(category: string, mapping: Partial<ModelMapping>): void {
    const existing = this.modelMappings.get(category);
    if (existing) {
      this.modelMappings.set(category, { ...existing, ...mapping });
    } else {
      this.modelMappings.set(category, mapping as ModelMapping);
    }
  }
  
  addProviderToCategory(category: string, provider: string, model: string): void {
    const mapping = this.modelMappings.get(category);
    if (mapping) {
      mapping.providers[provider] = model;
      if (!mapping.fallbackChain.includes(provider)) {
        mapping.fallbackChain.push(provider);
      }
    }
  }
  
  removeProviderFromCategory(category: string, provider: string): void {
    const mapping = this.modelMappings.get(category);
    if (mapping) {
      delete mapping.providers[provider];
      mapping.fallbackChain = mapping.fallbackChain.filter(p => p !== provider);
    }
  }
  
  // Analytics and monitoring
  getCategoryUsageStats(): Record<string, { totalRequests: number; successRate: number }> {
    // This would be populated by actual usage tracking
    // For now, return empty stats
    return {};
  }
  
  getProviderPerformanceInCategory(category: string): Record<string, { 
    avgLatency: number; 
    successRate: number; 
    avgCost: number 
  }> {
    // This would be populated by actual performance tracking
    // For now, return empty stats
    return {};
  }
}
