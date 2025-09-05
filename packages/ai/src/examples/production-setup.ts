/**
 * Production AI System Setup Example
 * Demonstrates how to initialize and use the complete AI provider system
 */

import {
  createProductionAISystem,
  ProviderConfig,
  IntelligentProviderRouter,
  ProductionProviderRegistry,
  ModelMapper
} from '../providers/RealProviders';
import { VTTContentGenerator } from '../vtt-content-generator';
import { AIProvider } from '../types';

// Example configuration for production deployment
const productionConfig: ProviderConfig = {
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY!,
    defaultModel: 'claude-4-sonnet-4'
  },
  google: {
    apiKey: process.env.GOOGLE_API_KEY!,
    ...(process.env.GOOGLE_PROJECT_ID && { projectId: process.env.GOOGLE_PROJECT_ID }),
    defaultModel: 'gemini-2.5-flash'
  },
  azure: {
    apiKey: process.env.AZURE_OPENAI_API_KEY!,
    endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
    deployments: {
      'gpt-5': {
        deploymentName: 'gpt-5-deployment',
        modelName: 'gpt-5',
        apiVersion: '2024-08-01-preview',
        requiresRegistration: true,
        capabilities: ['text', 'reasoning', 'tools'],
        limits: { rpm: 10, tpm: 150000 }
      },
      'gpt-4o': {
        deploymentName: 'gpt-4o-deployment',
        modelName: 'gpt-4o',
        apiVersion: '2024-08-01-preview',
        capabilities: ['text', 'vision', 'tools'],
        limits: { rpm: 50, tpm: 300000 }
      },
      'dall-e-3': {
        deploymentName: 'dalle3-deployment',
        modelName: 'dall-e-3',
        apiVersion: '2024-08-01-preview',
        capabilities: ['image-generation'],
        limits: { rpm: 20, tpm: 0 }
      }
    },
    ...(process.env.AZURE_REGISTRATION_KEY && { registrationKey: process.env.AZURE_REGISTRATION_KEY }),
    apiVersion: '2024-08-01-preview'
  },
  circuitBreaker: {
    failureThreshold: 3,
    resetTimeoutMs: 30000,
    monitoringWindowMs: 120000,
    halfOpenMaxCalls: 2
  }
};

export class ProductionAIManager {
  private registry: ProductionProviderRegistry;
  private router: IntelligentProviderRouter; 
  private modelMapper: ModelMapper;
  private contentGenerator: VTTContentGenerator;
  private initialized = false;

  constructor() {
    // Will be initialized in init()
    this.registry = null as any;
    this.router = null as any;
    this.modelMapper = null as any;
    this.contentGenerator = null as any;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {return;}

    // Initialize the complete AI system
    const system = await createProductionAISystem(productionConfig);
    
    this.registry = system.registry;
    this.router = system.router;
    this.modelMapper = system.modelMapper;

    // Initialize VTT content generator with intelligent provider selection
    const { provider: primaryProvider } = await this.router.selectProvider('vtt-content-generation');
    
    this.contentGenerator = new VTTContentGenerator({
      defaultProvider: primaryProvider,
      fallbackProviders: await this.getFallbackProviders('vtt-content-generation'),
      systemPrompts: {
        npc: `You are a master D&D 5e game designer with deep knowledge of balanced character creation, rich storytelling, and mechanical precision. Create NPCs that feel alive and serve clear narrative purposes.`,
        location: `You are an expert world builder specializing in immersive, detailed environments that enhance gameplay and storytelling. Every location should feel lived-in and purposeful.`,
        quest: `You are a legendary adventure writer known for creating engaging, player-driven narratives with meaningful choices and satisfying resolutions.`,
        item: `You are a master artificer and game designer, creating magic items that are mechanically balanced, thematically appropriate, and narratively interesting.`,
        encounter: `You are a tactical combat expert and encounter designer, creating dynamic, engaging battles that challenge players while providing opportunities for creative solutions.`
      }
    });

    this.initialized = true;
    console.log('✅ Production AI system initialized successfully');
  }

  // High-level VTT Content Generation Methods
  async generateNPC(context: {
    setting?: string;
    theme?: string;
    playerLevel?: number;
    role?: 'ally' | 'neutral' | 'enemy' | 'vendor' | 'quest_giver';
  }) {
    await this.ensureInitialized();
    
    const roles = ['ally', 'neutral', 'enemy', 'vendor', 'quest_giver'] as const;
    for (const role of roles) {
      const npc = await this.contentGenerator.generateNPC({
        setting: context.setting || 'Forgotten Realms',
        theme: context.theme || 'High Fantasy',
        playerLevel: context.playerLevel || 5
      }, {
        role,
        detailLevel: 'detailed'
      });
    }

    return this.contentGenerator.generateNPC({
      setting: context.setting || 'Forgotten Realms',
      theme: context.theme || 'High Fantasy',
      playerLevel: context.playerLevel || 5
    }, {
      ...(context.role && { role: context.role }),
      detailLevel: 'detailed'
    });
  }

  async generateLocation(context: {
    setting?: string;
    theme?: string;
    locationType?: 'dungeon' | 'settlement' | 'wilderness' | 'building';
  }) {
    await this.ensureInitialized();
    
    const locationTypes = ['dungeon', 'settlement', 'wilderness', 'building'] as const;
    for (const locationType of locationTypes) {
      const location = await this.contentGenerator.generateLocation({
        setting: context.setting || 'Forgotten Realms',
        theme: context.theme || 'High Fantasy'
      }, {
        locationType,
        scale: 'building',
        inhabitants: true
      });
    }

    return this.contentGenerator.generateLocation({
      setting: context.setting || 'Forgotten Realms',
      theme: context.theme || 'High Fantasy'
    }, {
      ...(context.locationType && { locationType: context.locationType }),
      scale: 'building',
      inhabitants: true
    });
  }

  async generateQuest(context: {
    setting?: string;
    theme?: string;
    playerLevel?: number;
    difficulty?: string;
  }) {
    await this.ensureInitialized();
    
    return this.contentGenerator.generateQuest({
      setting: context.setting || 'Forgotten Realms',
      theme: context.theme || 'High Fantasy',
      playerLevel: context.playerLevel || 5,
      difficulty: context.difficulty || 'medium'
    }, {
      questType: 'main',
      structure: 'branching',
      duration: 'medium'
    });
  }

  // Intelligent Provider Selection Examples
  async generateWithOptimalProvider(task: 'reasoning' | 'creative' | 'cost-optimized' | 'multimodal') {
    await this.ensureInitialized();

    const categoryMap = {
      reasoning: 'flagship-reasoning',
      creative: 'vtt-content-generation', 
      'cost-optimized': 'cost-optimized',
      multimodal: 'multimodal-analysis'
    };

    const category = categoryMap[task];
    const { provider, fallbacks } = await this.router.selectProvider(category);

    console.log(`Selected ${provider.name} for ${task} task with ${fallbacks.length} fallbacks`);
    
    return provider;
  }

  // Health Monitoring and Diagnostics
  async getSystemHealth() {
    await this.ensureInitialized();
    
    const providerHealth = await this.registry.healthCheckAll();
    const routerHealth = this.router.getHealthStatus();
    
    return {
      providers: providerHealth,
      router: routerHealth,
      timestamp: new Date().toISOString()
    };
  }

  // Provider Performance Analytics
  async getProviderAnalytics() {
    await this.ensureInitialized();
    
    const categories = this.modelMapper.getAvailableCategories();
    const analytics: Record<string, any> = {};
    
    for (const category of categories) {
      const capabilities = this.modelMapper.getCategoryCapabilities(category);
      const fallbackChain = this.modelMapper.getFallbackChain(category);
      
      analytics[category] = {
        capabilities,
        fallbackChain,
        primaryProvider: fallbackChain[0],
        fallbackCount: fallbackChain.length - 1
      };
    }
    
    return analytics;
  }

  // Cost Tracking and Budget Management
  private costTracker = {
    totalSpent: 0,
    spentByProvider: {} as Record<string, number>,
    requestCount: 0
  };

  trackCost(provider: string, cost: number) {
    this.costTracker.totalSpent += cost;
    this.costTracker.spentByProvider[provider] = (this.costTracker.spentByProvider[provider] || 0) + cost;
    this.costTracker.requestCount++;
  }

  getCostSummary() {
    return {
      ...this.costTracker,
      averageCostPerRequest: this.costTracker.totalSpent / this.costTracker.requestCount || 0,
      lastUpdated: new Date().toISOString()
    };
  }

  // Advanced Use Cases
  async generateCampaignContent(campaignContext: {
    setting: string;
    theme: string;
    playerLevel: number;
    sessionCount: number;
  }) {
    await this.ensureInitialized();
    
    const results = await Promise.allSettled([
      this.contentGenerator.generateNPC(campaignContext, { role: 'quest_giver' }),
      this.contentGenerator.generateLocation(campaignContext, { locationType: 'settlement' }),
      this.contentGenerator.generateQuest(campaignContext),
      this.contentGenerator.generateMagicItem(campaignContext),
      this.contentGenerator.generateEncounter(campaignContext)
    ]);

    return {
      npc: results[0].status === 'fulfilled' ? results[0].value : null,
      location: results[1].status === 'fulfilled' ? results[1].value : null,
      quest: results[2].status === 'fulfilled' ? results[2].value : null,
      item: results[3].status === 'fulfilled' ? results[3].value : null,
      encounter: results[4].status === 'fulfilled' ? results[4].value : null,
      errors: results.filter(r => r.status === 'rejected').map(r => (r as any).reason)
    };
  }

  // Utility Methods
  private async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private async getFallbackProviders(category: string): Promise<AIProvider[]> {
    const fallbackChain = this.modelMapper.getFallbackChain(category);
    const providers: AIProvider[] = [];
    
    for (const providerName of fallbackChain.slice(1)) {
      const provider = this.registry.getProvider(providerName);
      if (provider) {
        providers.push(provider);
      }
    }
    
    return providers;
  }

  // Cleanup
  async shutdown() {
    console.log('🔄 Shutting down AI system...');
    // Stop health monitoring and cleanup resources
    this.initialized = false;
    console.log('✅ AI system shutdown complete');
  }
}

// Usage Examples
export async function exampleUsage() {
  const aiManager = new ProductionAIManager();
  await aiManager.initialize();

  try {
    // Example 1: Generate an NPC for a gothic horror campaign
    const npc = await aiManager.generateNPC({
      setting: 'Ravenloft',
      theme: 'Gothic Horror',
      playerLevel: 8,
      role: 'enemy'
    });
    console.log('Generated NPC:', npc.content.name);

    // Example 2: Generate a complete quest
    const quest = await aiManager.generateQuest({
      setting: 'Eberron',
      theme: 'Noir Investigation',
      playerLevel: 6,
      difficulty: 'hard'
    });
    console.log('Generated Quest:', quest.content.title);

    // Example 3: Generate campaign content bundle
    const campaignBundle = await aiManager.generateCampaignContent({
      setting: 'Sword Coast',
      theme: 'Political Intrigue',
      playerLevel: 10,
      sessionCount: 8
    });
    console.log('Campaign Bundle Generated:', Object.keys(campaignBundle));

    // Example 4: Health monitoring
    const health = await aiManager.getSystemHealth();
    console.log('System Health:', health);

    // Example 5: Cost tracking
    const costs = aiManager.getCostSummary();
    console.log('Cost Summary:', costs);

  } catch (error) {
    console.error('Example failed:', error);
  } finally {
    await aiManager.shutdown();
  }
}

// Environment validation
export function validateEnvironment(): { valid: boolean; missing: string[] } {
  const required = [
    'ANTHROPIC_API_KEY',
    'GOOGLE_API_KEY', 
    'AZURE_OPENAI_API_KEY',
    'AZURE_OPENAI_ENDPOINT'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  return {
    valid: missing.length === 0,
    missing
  };
}

// Export for use in other modules
export default ProductionAIManager;
