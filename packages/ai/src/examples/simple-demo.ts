/**
 * Simple AI Integration Demo
 * Standalone demonstration of integrated AI systems functionality
 */

interface MockAIProvider {
  name: string;
  generateText(params: { prompt: string; maxTokens?: number; temperature?: number }): Promise<{ text: string; tokens: number }>;
  analyzeImage(params: { prompt: string; image: string }): Promise<{ analysis: string; success: boolean }>;
}

class MockProvider implements MockAIProvider {
  name = 'mock-ai-provider';

  async generateText(params: { prompt: string; maxTokens?: number; temperature?: number }) {
    // Simulate different AI responses based on prompt content
    if (params.prompt.toLowerCase().includes('dialogue')) {
      return {
        text: '["Greetings, adventurer! What brings you to our humble tavern?", "I\'ve heard strange rumors from the north lately.", "Stay vigilant - dark times are ahead."]',
        tokens: 42
      };
    }
    
    if (params.prompt.toLowerCase().includes('behavior')) {
      return {
        text: '{"action": "patrol_area", "description": "The guard walks methodically around the perimeter, hand resting on sword hilt", "priority": 0.8}',
        tokens: 28
      };
    }
    
    if (params.prompt.toLowerCase().includes('scene')) {
      return {
        text: 'The tavern hums with quiet conversation as flickering candlelight dances across weathered wooden tables. A hooded figure sits alone in the corner, nursing a drink while watching the entrance with keen eyes.',
        tokens: 35
      };
    }
    
    return {
      text: 'The AI considers the request thoughtfully.',
      tokens: 8
    };
  }

  async analyzeImage(params: { prompt: string; image: string }) {
    return {
      analysis: '{"species": "human", "threatLevel": "medium", "equipment": ["hooded cloak", "concealed dagger", "leather boots"], "emotions": ["cautious", "alert", "secretive"]}',
      success: true
    };
  }
}

class SimpleDynamicNPC {
  private provider: MockAIProvider;
  private cache = new Map<string, any>();

  constructor(provider: MockAIProvider) {
    this.provider = provider;
  }

  async generateBehavior(npcId: string, context: any) {
    const cacheKey = `${npcId}_${context.location}_${context.threatLevel}`;
    
    if (this.cache.has(cacheKey)) {
      console.log(`📦 Using cached behavior for ${npcId}`);
      return this.cache.get(cacheKey);
    }

    const prompt = `Generate behavior for NPC ${npcId} in ${context.location} with threat level: ${context.threatLevel}`;
    
    try {
      const response = await this.provider.generateText({ prompt, maxTokens: 200, temperature: 0.7 });
      const behavior = JSON.parse(response.text);
      this.cache.set(cacheKey, behavior);
      return behavior;
    } catch (error) {
      return {
        action: 'idle',
        description: `${npcId} stands quietly.`,
        priority: 0.1
      };
    }
  }

  async generateDialogue(npcId: string, context: any) {
    const prompt = `Generate dialogue for ${npcId} who is ${context.mood} in situation: ${context.situation}`;
    
    try {
      const response = await this.provider.generateText({ prompt, maxTokens: 300, temperature: 0.8 });
      return JSON.parse(response.text);
    } catch (error) {
      return [`${npcId} nods silently.`];
    }
  }
}

class SimpleVisionAI {
  private provider: MockAIProvider;
  private analysisCache = new Map<string, any>();

  constructor(provider: MockAIProvider) {
    this.provider = provider;
  }

  async analyzeToken(tokenId: string, description: string) {
    if (this.analysisCache.has(tokenId)) {
      console.log(`👁️ Using cached analysis for ${tokenId}`);
      return this.analysisCache.get(tokenId);
    }

    try {
      const response = await this.provider.analyzeImage({
        prompt: `Analyze this character: ${description}`,
        image: description
      });
      
      const analysis = JSON.parse(response.analysis);
      this.analysisCache.set(tokenId, analysis);
      return analysis;
    } catch (error) {
      return {
        species: 'unknown',
        threatLevel: 'none',
        equipment: [],
        emotions: ['neutral']
      };
    }
  }

  async generateSceneDescription(entities: any[], environment: string) {
    const prompt = `Generate atmospheric description for RPG scene in ${environment} with entities: ${entities.map(e => e.species).join(', ')}`;
    
    try {
      const response = await this.provider.generateText({ prompt, maxTokens: 200, temperature: 0.7 });
      return response.text;
    } catch (error) {
      return `You find yourself in a ${environment}.`;
    }
  }
}

async function demonstrateIntegratedAI() {
  console.log('🤖 AI Integration Demo Starting...\n');

  // Initialize systems
  const provider = new MockProvider();
  const npcManager = new SimpleDynamicNPC(provider);
  const visionAI = new SimpleVisionAI(provider);

  // Demo scenario: Tavern with suspicious character
  console.log('📍 Scenario: Investigating a suspicious figure in a tavern\n');

  // Step 1: Analyze the suspicious character
  console.log('👁️ Step 1: Vision AI analyzes the hooded figure');
  const suspiciousAnalysis = await visionAI.analyzeToken(
    'hooded_stranger',
    'A figure in a dark hooded cloak sitting alone at a corner table, face obscured'
  );
  console.log('Analysis result:', suspiciousAnalysis);

  // Step 2: Generate guard behavior based on threat
  console.log('\n🛡️ Step 2: Generate guard behavior in response');
  const guardBehavior = await npcManager.generateBehavior('tavern_guard', {
    location: 'tavern_main_room',
    threatLevel: suspiciousAnalysis.threatLevel,
    context: 'suspicious_character_detected'
  });
  console.log('Guard behavior:', guardBehavior);

  // Step 3: Generate guard dialogue
  console.log('\n💬 Step 3: Generate contextual guard dialogue');
  const guardDialogue = await npcManager.generateDialogue('tavern_guard', {
    mood: 'alert',
    situation: `${suspiciousAnalysis.threatLevel} threat detected`,
    context: 'approaching_player'
  });
  console.log('Guard dialogue options:', guardDialogue);

  // Step 4: Create atmospheric scene description
  console.log('\n🎭 Step 4: Generate atmospheric scene description');
  const sceneDescription = await visionAI.generateSceneDescription([
    { species: 'human', role: 'guard' },
    suspiciousAnalysis
  ], 'dimly lit tavern');
  console.log('Scene description:', sceneDescription);

  // Step 5: Demonstrate caching (repeat analysis)
  console.log('\n⚡ Step 5: Demonstrate caching benefits');
  console.log('Repeating token analysis...');
  const cachedAnalysis = await visionAI.analyzeToken(
    'hooded_stranger',
    'A figure in a dark hooded cloak sitting alone at a corner table, face obscured'
  );
  console.log('Cached result matches:', JSON.stringify(cachedAnalysis) === JSON.stringify(suspiciousAnalysis));

  // Step 6: Show system metrics
  console.log('\n📊 Step 6: System Performance Metrics');
  console.log('NPC behavior cache size:', npcManager['cache'].size);
  console.log('Vision analysis cache size:', visionAI['analysisCache'].size);

  console.log('\n✅ AI Integration Demo Complete!');
  console.log('\nKey Features Demonstrated:');
  console.log('• Dynamic NPC behavior generation based on context');
  console.log('• AI-powered vision analysis of game tokens');
  console.log('• Context-aware dialogue generation');
  console.log('• Atmospheric scene description generation');
  console.log('• Performance optimization through intelligent caching');
  console.log('• Threat assessment and adaptive NPC responses');
}

export { demonstrateIntegratedAI };

// Run demo if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateIntegratedAI().catch(console.error);
}
