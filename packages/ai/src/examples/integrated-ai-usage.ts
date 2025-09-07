/**
 * Integrated AI Systems Usage Example
 * Demonstrates how to use the connected AI systems for dynamic NPCs, vision analysis, and caching
 */

import { 
  ProductionProviderRegistry, 
  IntelligentProviderRouter, 
  createProductionAISystem 
} from '../providers/RealProviders';
import { CampaignAssistant } from '../campaign/CampaignAssistant';
import { NPCBehaviorSystem } from '../NPCBehaviorSystem';
import { VisionStore, VisionData, EntityId } from '@vtt/core-ecs';
import { CacheManager, CacheConfig } from '@vtt/performance';

// Simplified interfaces that work with existing types
export interface SimpleAIProvider {
  name: string;
  generateText?: (params: any) => Promise<{ text?: string; tokens?: number; cost?: number }>;
  analyzeImage?: (params: any) => Promise<{ analysis?: string; success: boolean }>;
}

export interface SimpleNPCConfig {
  aiProvider: SimpleAIProvider;
  campaignAssistant: CampaignAssistant;
  behaviorSystem: NPCBehaviorSystem;
  updateInterval: number;
  maxContextLength: number;
  creativityLevel: number;
}

export interface SimpleVisionConfig {
  aiProvider: SimpleAIProvider;
  visionStore: VisionStore;
  cacheManager: CacheManager;
  analysisInterval: number;
  enableAutoAnalysis: boolean;
  detectionThreshold: number;
  maxAnalysisDistance: number;
}

/**
 * Simplified Dynamic NPC Manager for practical usage
 */
export class IntegratedNPCManager {
  private config: SimpleNPCConfig;
  private behaviorCache = new Map<string, any>();

  constructor(config: SimpleNPCConfig) {
    this.config = config;
  }

  async generateNPCDialogue(
    npcId: string, 
    context: { 
      mood: string; 
      situation: string; 
      playerInput?: string;
    }
  ): Promise<string[]> {
    if (!this.config.aiProvider.generateText) {
      return [`${npcId} remains silent.`];
    }

    const prompt = `Generate dialogue for NPC ${npcId} who is ${context.mood} in situation: ${context.situation}
    ${context.playerInput ? `Player said: "${context.playerInput}"` : ''}
    
    Return 1-3 dialogue options as JSON array: ["line1", "line2", "line3"]`;

    try {
      const response = await this.config.aiProvider.generateText({
        prompt,
        maxTokens: 300,
        temperature: this.config.creativityLevel
      });

      if (response.text) {
        try {
          const parsed = JSON.parse(response.text);
          return Array.isArray(parsed) ? parsed : [response.text];
        } catch {
          return [response.text];
        }
      }
      return [`${npcId} looks thoughtful.`];
    } catch (error) {
      console.warn('Failed to generate NPC dialogue:', error);
      return [`${npcId} seems distracted.`];
    }
  }

  async generateNPCBehavior(
    npcId: string,
    context: {
      location: string;
      nearbyEntities: string[];
      currentGoal: string;
      threatLevel: 'none' | 'low' | 'medium' | 'high';
    }
  ): Promise<{ action: string; description: string; priority: number }> {
    const cacheKey = `${npcId}_${context.location}_${context.threatLevel}`;
    
    // Check cache first
    if (this.behaviorCache.has(cacheKey)) {
      return this.behaviorCache.get(cacheKey);
    }

    if (!this.config.aiProvider.generateText) {
      return {
        action: 'idle',
        description: `${npcId} stands around.`,
        priority: 0.1
      };
    }

    const prompt = `Generate behavior for NPC ${npcId}:
    Location: ${context.location}
    Current Goal: ${context.currentGoal}
    Threat Level: ${context.threatLevel}
    Nearby: ${context.nearbyEntities.join(', ')}
    
    Return JSON: {"action": "action_name", "description": "what they do", "priority": 0.8}`;

    try {
      const response = await this.config.aiProvider.generateText({
        prompt,
        maxTokens: 200,
        temperature: this.config.creativityLevel
      });

      if (response.text) {
        try {
          const behavior = JSON.parse(response.text);
          this.behaviorCache.set(cacheKey, behavior);
          return behavior;
        } catch {
          const fallback = {
            action: 'observe',
            description: response.text,
            priority: 0.5
          };
          this.behaviorCache.set(cacheKey, fallback);
          return fallback;
        }
      }
    } catch (error) {
      console.warn('Failed to generate NPC behavior:', error);
    }

    return {
      action: 'idle',
      description: `${npcId} waits quietly.`,
      priority: 0.2
    };
  }
}

/**
 * Simplified Vision AI Integration
 */
export class IntegratedVisionAI {
  private config: SimpleVisionConfig;
  private analysisCache = new Map<string, any>();

  constructor(config: SimpleVisionConfig) {
    this.config = config;
  }

  async analyzeTokenImage(
    tokenId: string,
    imageDescription: string,
    context?: { lighting: 'bright' | 'dim' | 'dark'; distance: number }
  ): Promise<{
    species: string;
    threatLevel: 'none' | 'low' | 'medium' | 'high';
    equipment: string[];
    emotions: string[];
  }> {
    const cacheKey = `${tokenId}_${imageDescription.slice(0, 50)}`;
    
    if (this.analysisCache.has(cacheKey)) {
      return this.analysisCache.get(cacheKey);
    }

    if (!this.config.aiProvider.analyzeImage && !this.config.aiProvider.generateText) {
      return {
        species: 'unknown',
        threatLevel: 'none',
        equipment: [],
        emotions: ['neutral']
      };
    }

    const prompt = `Analyze this character/token: ${imageDescription}
    ${context ? `Lighting: ${context.lighting}, Distance: ${context.distance}` : ''}
    
    Identify:
    - Species/race
    - Threat level (none/low/medium/high)
    - Visible equipment
    - Apparent emotions
    
    Return JSON: {
      "species": "human",
      "threatLevel": "low", 
      "equipment": ["sword", "armor"],
      "emotions": ["alert", "cautious"]
    }`;

    try {
      let responseText: string | undefined;

      if (this.config.aiProvider.analyzeImage) {
        const response = await this.config.aiProvider.analyzeImage({
          prompt,
          image: imageDescription
        });
        responseText = response.analysis;
      } else if (this.config.aiProvider.generateText) {
        const response = await this.config.aiProvider.generateText({
          prompt,
          maxTokens: 300
        });
        responseText = response.text;
      }

      if (responseText) {
        try {
          const analysis = JSON.parse(responseText);
          this.analysisCache.set(cacheKey, analysis);
          return analysis;
        } catch {
          // Fallback parsing from text
          const fallback = {
            species: this.extractFromText(responseText, 'species') || 'unknown',
            threatLevel: (this.extractFromText(responseText, 'threat') || 'none') as any,
            equipment: this.extractArrayFromText(responseText, 'equipment'),
            emotions: this.extractArrayFromText(responseText, 'emotion')
          };
          this.analysisCache.set(cacheKey, fallback);
          return fallback;
        }
      }
    } catch (error) {
      console.warn('Failed to analyze token:', error);
    }

    return {
      species: 'unknown',
      threatLevel: 'none',
      equipment: [],
      emotions: ['neutral']
    };
  }

  async generateSceneDescription(
    entities: Array<{ id: string; analysis: any }>,
    environment: string
  ): Promise<string> {
    if (!this.config.aiProvider.generateText) {
      return `You see various entities in a ${environment}.`;
    }

    const entitiesDesc = entities.map(e => 
      `${e.analysis.species || 'creature'} (${e.analysis.threatLevel || 'unknown'} threat)`
    ).join(', ');

    const prompt = `Generate atmospheric description for RPG scene:
    Environment: ${environment}
    Visible entities: ${entitiesDesc}
    
    Create a 2-3 sentence description that captures mood and important details.`;

    try {
      const response = await this.config.aiProvider.generateText({
        prompt,
        maxTokens: 200,
        temperature: 0.7
      });

      return response.text || `You find yourself in a ${environment} with ${entities.length} visible entities.`;
    } catch (error) {
      console.warn('Failed to generate scene description:', error);
      return `The ${environment} stretches before you.`;
    }
  }

  private extractFromText(text: string, key: string): string | null {
    const regex = new RegExp(`${key}[:\\s]+([^\\n,]+)`, 'i');
    const match = text.match(regex);
    return match ? match[1]?.trim() ?? null : null;
  }

  private extractArrayFromText(text: string, key: string): string[] {
    const extracted = this.extractFromText(text, key);
    if (!extracted) {return [];}
    return extracted.split(/[,;]/).map(item => item.trim()).filter(Boolean);
  }
}

/**
 * Complete Integration Example
 */
export class AISystemExample {
  private npcManager: IntegratedNPCManager;
  private visionAI: IntegratedVisionAI;
  private cache: CacheManager;

  constructor() {
    // Initialize with mock provider for demonstration
    const mockProvider: SimpleAIProvider = {
      name: 'mock-ai',
      async generateText(params: any) {
        // Simulate AI responses based on prompt
        if (params.prompt.includes('dialogue')) {
          return {
            text: '["Hello there, traveler!", "What brings you to these parts?", "Be careful around here."]',
            tokens: 50
          };
        } else if (params.prompt.includes('behavior')) {
          return {
            text: '{"action": "patrol", "description": "The guard walks a steady patrol route", "priority": 0.7}',
            tokens: 30
          };
        } else if (params.prompt.includes('scene')) {
          return {
            text: 'The tavern bustles with activity as patrons enjoy their evening meals, while a hooded figure watches from the corner.',
            tokens: 40
          };
        }
        return { text: 'I understand.', tokens: 10 };
      },
      async analyzeImage(params: any) {
        return {
          analysis: '{"species": "human", "threatLevel": "low", "equipment": ["leather armor", "dagger"], "emotions": ["alert", "friendly"]}',
          success: true
        };
      }
    };

    this.cache = new CacheManager({
      maxMemorySize: 50 * 1024 * 1024,
      maxEntries: 100,
      defaultTtl: 300000,
      evictionPolicy: "lru",
      compressionEnabled: false,
      cleanupInterval: 60000
    });
    
    // Create campaign assistant and behavior system with minimal setup
    const campaignAssistant = new CampaignAssistant({} as any);
    const behaviorSystem = new NPCBehaviorSystem();
    const visionStore = new VisionStore(1000);

    this.npcManager = new IntegratedNPCManager({
      aiProvider: mockProvider,
      campaignAssistant,
      behaviorSystem,
      updateInterval: 5000,
      maxContextLength: 2000,
      creativityLevel: 0.7
    });

    this.visionAI = new IntegratedVisionAI({
      aiProvider: mockProvider,
      visionStore,
      cacheManager: this.cache,
      analysisInterval: 10000,
      enableAutoAnalysis: true,
      detectionThreshold: 0.5,
      maxAnalysisDistance: 100
    });
  }

  /**
   * Demonstrate complete AI integration workflow
   */
  async demonstrateIntegratedWorkflow(): Promise<void> {
    console.log('🤖 AI System Integration Demo Starting...\n');

    // 1. Generate NPC behavior
    console.log('📍 Step 1: Generate NPC Behavior');
    const behavior = await this.npcManager.generateNPCBehavior('guard_001', {
      location: 'tavern_entrance',
      nearbyEntities: ['player', 'bartender', 'hooded_figure'],
      currentGoal: 'maintain_security',
      threatLevel: 'low'
    });
    console.log('Generated behavior:', behavior);

    // 2. Analyze token with vision AI
    console.log('\n👁️ Step 2: Analyze Token with Vision AI');
    const analysis = await this.visionAI.analyzeTokenImage(
      'hooded_figure_001',
      'A person in a dark hooded cloak sitting alone at a corner table',
      { lighting: 'dim', distance: 20 }
    );
    console.log('Vision analysis:', analysis);

    // 3. Generate dialogue based on context
    console.log('\n💬 Step 3: Generate Contextual NPC Dialogue');
    const dialogue = await this.npcManager.generateNPCDialogue('guard_001', {
      mood: 'alert',
      situation: 'suspicious figure detected',
      playerInput: 'I need to speak with someone in private'
    });
    console.log('Generated dialogue:', dialogue);

    // 4. Create comprehensive scene description
    console.log('\n🎭 Step 4: Generate Scene Description');
    const sceneDesc = await this.visionAI.generateSceneDescription([
      { id: 'guard_001', analysis: { species: 'human', threatLevel: 'none' } },
      { id: 'hooded_figure_001', analysis }
    ], 'dimly lit tavern');
    console.log('Scene description:', sceneDesc);

    // 5. Show caching benefits
    console.log('\n⚡ Step 5: Demonstrate Caching (repeat analysis)');
    const cachedAnalysis = await this.visionAI.analyzeTokenImage(
      'hooded_figure_001',
      'A person in a dark hooded cloak sitting alone at a corner table',
      { lighting: 'dim', distance: 20 }
    );
    console.log('Cached analysis (faster):', cachedAnalysis);

    console.log('\n✅ AI System Integration Demo Complete!');
    console.log('\nKey Features Demonstrated:');
    console.log('• Dynamic NPC behavior generation');
    console.log('• Intelligent vision analysis with caching');
    console.log('• Context-aware dialogue generation');
    console.log('• Integrated scene description');
    console.log('• Performance optimization through caching');
  }

  /**
   * Show system metrics and performance
   */
  getSystemMetrics(): any {
    return {
      cacheStats: this.cache.getStats(),
      npcManagerCache: this.npcManager['behaviorCache'].size,
      visionCache: this.visionAI['analysisCache'].size,
      timestamp: new Date().toISOString()
    };
  }

  dispose(): void {
    this.cache.destroy();
  }
}

// Example usage function
export async function runAIIntegrationDemo(): Promise<void> {
  const demo = new AISystemExample();
  
  try {
    await demo.demonstrateIntegratedWorkflow();
    console.log('\n📊 System Metrics:', demo.getSystemMetrics());
  } catch (error) {
    console.error('Demo failed:', error);
  } finally {
    demo.dispose();
  }
}

// Export for easy testing
export { AISystemExample as default };
