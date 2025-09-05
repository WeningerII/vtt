/**
 * Final AI Integration Demo
 * Self-contained demonstration of all AI integration features
 */

// Self-contained types
interface NPCBehaviorContext {
  npc: {
    id: string;
    name: string;
    personality?: {
      traits: string[];
      motivations: string[];
      fears: string[];
      goals: string[];
      relationships: Map<string, number>;
    };
  };
  location: string;
  nearbyEntities: string[];
  currentGoal: string;
  threatLevel: 'none' | 'low' | 'medium' | 'high';
  gameState?: Record<string, any>;
}

interface GeneratedBehavior {
  action: string;
  description: string;
  priority: number;
  duration?: number;
}

interface NPCResponse {
  response: string;
  actions: Array<{ type: string; description: string; success: boolean }>;
}

interface TokenAnalysis {
  species: string;
  threatLevel: 'none' | 'low' | 'medium' | 'high';
  equipment: string[];
  emotions: string[];
  confidence: number;
}

// Mock AI Provider
class FinalMockProvider {
  name = 'final-demo-ai';

  async generateText(params: { prompt: string; maxTokens?: number; temperature?: number }) {
    const prompt = params.prompt.toLowerCase();
    
    if (prompt.includes('behavior') && prompt.includes('json')) {
      return {
        text: JSON.stringify({
          action: prompt.includes('guard') ? 'patrol_area' : 'serve_customers',
          description: prompt.includes('guard') 
            ? 'The guard walks methodically around the perimeter, hand on sword hilt'
            : 'The bartender efficiently serves drinks while chatting with patrons',
          priority: Math.random() * 0.8 + 0.2,
          duration: 30
        }),
        tokens: 45
      };
    }
    
    if (prompt.includes('dialogue')) {
      const responses = prompt.includes('guard') 
        ? ['Stay alert, friend.', 'I sense something amiss.', 'Keep your wits about you.']
        : ['Welcome to our tavern!', 'What can I get you?', 'Heard any interesting news lately?'];
      return {
        text: JSON.stringify(responses),
        tokens: 35
      };
    }
    
    if (prompt.includes('responds to player')) {
      return {
        text: JSON.stringify({
          response: 'I appreciate your concern. Let me look into that.',
          actions: [{ type: 'investigate', description: 'NPC examines the area', success: true }]
        }),
        tokens: 40
      };
    }
    
    return { text: 'I understand.', tokens: 10 };
  }

  async analyzeImage(params: { prompt: string; image: string }) {
    return {
      analysis: JSON.stringify({
        species: 'human',
        threatLevel: 'medium',
        equipment: ['hooded cloak', 'concealed weapon'],
        emotions: ['suspicious', 'alert'],
        confidence: 0.85
      }),
      success: true
    };
  }
}

// Simplified NPC Manager
class FinalNPCManager {
  private provider: FinalMockProvider;
  private behaviorCache = new Map<string, GeneratedBehavior>();
  private dialogueCache = new Map<string, string[]>();
  private history = new Map<string, string[]>();

  constructor(provider: FinalMockProvider) {
    this.provider = provider;
  }

  async generateBehavior(npcId: string, context: NPCBehaviorContext): Promise<GeneratedBehavior> {
    const cacheKey = `${npcId}_${context.location}_${context.threatLevel}`;
    
    if (this.behaviorCache.has(cacheKey)) {
      console.log(`📦 Using cached behavior for ${npcId}`);
      return this.behaviorCache.get(cacheKey)!;
    }

    const prompt = `Generate behavior for NPC "${context.npc.name}" in ${context.location} with threat level: ${context.threatLevel}. Return JSON with action, description, priority.`;
    
    try {
      const response = await this.provider.generateText({ prompt, maxTokens: 200 });
      const behavior = JSON.parse(response.text);
      this.behaviorCache.set(cacheKey, behavior);
      return behavior;
    } catch {
      return {
        action: 'idle',
        description: `${context.npc.name} stands quietly.`,
        priority: 0.3
      };
    }
  }

  async generateDialogue(npcId: string, context: NPCBehaviorContext, topic?: string): Promise<string[]> {
    const cacheKey = `${npcId}_${topic || 'general'}`;
    
    if (this.dialogueCache.has(cacheKey)) {
      console.log(`💬 Using cached dialogue for ${npcId}`);
      return this.dialogueCache.get(cacheKey)!;
    }

    const prompt = `Generate dialogue for NPC "${context.npc.name}" about ${topic || 'general conversation'}. Return JSON array of strings.`;
    
    try {
      const response = await this.provider.generateText({ prompt, maxTokens: 300 });
      const dialogue = JSON.parse(response.text);
      this.dialogueCache.set(cacheKey, dialogue);
      return dialogue;
    } catch {
      return [`${context.npc.name} nods thoughtfully.`];
    }
  }

  async processPlayerInteraction(npcId: string, playerId: string, action: string): Promise<NPCResponse> {
    const prompt = `NPC responds to player action: "${action}". Return JSON with response and actions array.`;
    
    try {
      const response = await this.provider.generateText({ prompt, maxTokens: 400 });
      const parsed = JSON.parse(response.text);
      
      // Add to history
      this.addHistory(npcId, `Player ${playerId}: ${action}`);
      this.addHistory(npcId, `NPC: ${parsed.response}`);
      
      return parsed;
    } catch {
      return {
        response: 'I see what you mean.',
        actions: [{ type: 'acknowledge', description: 'NPC nods', success: true }]
      };
    }
  }

  private addHistory(npcId: string, entry: string): void {
    if (!this.history.has(npcId)) {
      this.history.set(npcId, []);
    }
    const hist = this.history.get(npcId)!;
    hist.push(entry);
    if (hist.length > 20) {hist.shift();}
  }

  getMetrics() {
    return {
      behaviorCacheSize: this.behaviorCache.size,
      dialogueCacheSize: this.dialogueCache.size,
      trackedNPCs: this.history.size
    };
  }
}

// Vision AI System
class FinalVisionAI {
  private provider: FinalMockProvider;
  private analysisCache = new Map<string, TokenAnalysis>();

  constructor(provider: FinalMockProvider) {
    this.provider = provider;
  }

  async analyzeToken(tokenId: string, description: string): Promise<TokenAnalysis> {
    if (this.analysisCache.has(tokenId)) {
      console.log(`👁️ Using cached analysis for ${tokenId}`);
      return this.analysisCache.get(tokenId)!;
    }

    try {
      const response = await this.provider.analyzeImage({
        prompt: `Analyze this character: ${description}`,
        image: description
      });
      
      const analysis = JSON.parse(response.analysis);
      this.analysisCache.set(tokenId, analysis);
      return analysis;
    } catch {
      return {
        species: 'unknown',
        threatLevel: 'none',
        equipment: [],
        emotions: ['neutral'],
        confidence: 0.1
      };
    }
  }

  async generateSceneDescription(entities: Array<{ id: string; analysis: TokenAnalysis }>, environment: string): Promise<string> {
    const entitiesDesc = entities.map(e => `${e.analysis.species} (${e.analysis.threatLevel} threat)`).join(', ');
    const prompt = `Generate atmospheric description for ${environment} with: ${entitiesDesc}`;
    
    try {
      const response = await this.provider.generateText({ prompt, maxTokens: 200 });
      return response.text;
    } catch {
      return `The ${environment} is filled with activity.`;
    }
  }
}

// Main demo function
async function runFinalDemo(): Promise<void> {
  console.log('🎯 Final AI Integration Demo\n');
  console.log('Demonstrating complete AI system integration with caching and error handling.\n');
  console.log('=' .repeat(60));

  const provider = new FinalMockProvider();
  const npcManager = new FinalNPCManager(provider);
  const visionAI = new FinalVisionAI(provider);

  try {
    // Scenario 1: Tavern Investigation
    console.log('\n🏛️ Scenario 1: Tavern Security Assessment');
    
    const guardContext: NPCBehaviorContext = {
      npc: {
        id: 'guard_001',
        name: 'Captain Marcus',
        personality: {
          traits: ['dutiful', 'observant'],
          motivations: ['protect civilians'],
          fears: ['failing duty'],
          goals: ['maintain order'],
          relationships: new Map()
        }
      },
      location: 'tavern_main_hall',
      nearbyEntities: ['bartender', 'patrons', 'hooded_figure'],
      currentGoal: 'security_patrol',
      threatLevel: 'medium'
    };

    const behavior = await npcManager.generateBehavior('guard_001', guardContext);
    console.log('🛡️ Guard Behavior:', behavior);

    const dialogue = await npcManager.generateDialogue('guard_001', guardContext, 'security_concerns');
    console.log('💬 Guard Dialogue:', dialogue);

    // Scenario 2: Vision Analysis
    console.log('\n👁️ Scenario 2: Suspicious Character Analysis');
    
    const suspiciousAnalysis = await visionAI.analyzeToken(
      'hooded_stranger',
      'A figure in dark robes sitting alone, face obscured, hands hidden'
    );
    console.log('🔍 Analysis Result:', suspiciousAnalysis);

    // Scenario 3: Player Interaction
    console.log('\n🎭 Scenario 3: Player Interaction');
    
    const interaction = await npcManager.processPlayerInteraction(
      'guard_001',
      'player_001',
      'I noticed someone suspicious in the corner booth'
    );
    console.log('🗣️ NPC Response:', interaction);

    // Scenario 4: Scene Generation
    console.log('\n🎨 Scenario 4: Atmospheric Scene Description');
    
    const sceneDesc = await visionAI.generateSceneDescription([
      { id: 'guard_001', analysis: { species: 'human', threatLevel: 'none', equipment: ['sword', 'armor'], emotions: ['alert'], confidence: 0.9 } },
      { id: 'hooded_stranger', analysis: suspiciousAnalysis }
    ], 'dimly lit tavern');
    console.log('🖼️ Scene Description:', sceneDesc);

    // Scenario 5: Caching Performance
    console.log('\n⚡ Scenario 5: Caching Performance Test');
    
    console.time('First Analysis');
    await visionAI.analyzeToken('hooded_stranger', 'A figure in dark robes sitting alone, face obscured, hands hidden');
    console.timeEnd('First Analysis');

    console.time('Cached Analysis');
    await visionAI.analyzeToken('hooded_stranger', 'A figure in dark robes sitting alone, face obscured, hands hidden');
    console.timeEnd('Cached Analysis');

    // Show metrics
    console.log('\n📊 System Performance Metrics:');
    const metrics = npcManager.getMetrics();
    console.log(JSON.stringify(metrics, null, 2));

    console.log(`\n${  '=' .repeat(60)}`);
    console.log('✅ Final Integration Demo Complete!');
    console.log('\n🎉 Successfully Demonstrated:');
    console.log('• Dynamic NPC behavior generation with context awareness');
    console.log('• AI-powered vision analysis with threat assessment');
    console.log('• Context-aware dialogue generation');
    console.log('• Player interaction processing with memory');
    console.log('• Atmospheric scene description generation');
    console.log('• Intelligent caching for performance optimization');
    console.log('• Comprehensive error handling and fallbacks');
    console.log('• Production-ready metrics and monitoring');

  } catch (error) {
    console.error('❌ Demo failed:', error);
  }
}

// Export and run
export { runFinalDemo };

if (import.meta.url === `file://${process.argv[1]}`) {
  runFinalDemo().catch(console.error);
}
