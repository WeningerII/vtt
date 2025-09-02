#!/usr/bin/env node

/**
 * Production-Ready AI Integration Demo
 * Demonstrates the type-safe AI systems with comprehensive error handling
 */

import { TypeSafeDynamicNPCManager } from '../TypeSafeDynamicNPCManager.js';
import {
  NPCBehaviorContext,
  CompatibleAIProvider,
  DynamicNPCConfig
} from '../types/AIIntegration.js';

// Mock AI Provider for demonstration
class ProductionMockProvider implements CompatibleAIProvider {
  name = 'production-mock-ai';

  async generateText(params: {
    prompt: string;
    maxTokens?: number;
    temperature?: number;
    model?: string;
  }) {
    // Simulate realistic AI responses based on prompt analysis
    const prompt = params.prompt.toLowerCase();
    
    if (prompt.includes('behavior') && prompt.includes('json')) {
      return {
        text: JSON.stringify({
          action: this.selectBehaviorAction(prompt),
          description: this.generateBehaviorDescription(prompt),
          priority: Math.random() * 0.8 + 0.2,
          duration: Math.floor(Math.random() * 60) + 10
        }),
        tokens: 45,
        cost: 0.002
      };
    }
    
    if (prompt.includes('dialogue') && prompt.includes('json')) {
      return {
        text: JSON.stringify(this.generateDialogueOptions(prompt)),
        tokens: 35,
        cost: 0.0015
      };
    }
    
    if (prompt.includes('responds to player')) {
      return {
        text: JSON.stringify({
          response: this.generateContextualResponse(prompt),
          actions: [
            {
              type: 'verbal',
              description: 'NPC speaks to player',
              success: true
            }
          ]
        }),
        tokens: 40,
        cost: 0.0018
      };
    }
    
    return {
      text: 'I understand your request.',
      tokens: 10,
      cost: 0.0005
    };
  }

  async analyzeImage(params: { prompt: string; image: string }) {
    return {
      analysis: JSON.stringify({
        species: 'human',
        threatLevel: 'low',
        equipment: ['traveling clothes', 'walking stick'],
        emotions: ['curious', 'friendly']
      }),
      success: true
    };
  }

  private selectBehaviorAction(prompt: string): string {
    if (prompt.includes('threat') && prompt.includes('high')) return 'combat_ready';
    if (prompt.includes('threat') && prompt.includes('medium')) return 'alert_patrol';
    if (prompt.includes('patrol')) return 'patrol_area';
    if (prompt.includes('tavern')) return 'serve_customers';
    if (prompt.includes('guard')) return 'watch_entrance';
    return 'idle_observation';
  }

  private generateBehaviorDescription(prompt: string): string {
    const npcName = this.extractNPCName(prompt) || 'The character';
    const location = this.extractLocation(prompt) || 'the area';
    
    const descriptions = [
      `${npcName} moves purposefully through ${location}, alert to any changes.`,
      `${npcName} maintains a watchful stance while going about their duties in ${location}.`,
      `${npcName} performs their routine tasks while staying aware of their surroundings in ${location}.`
    ];
    
    return descriptions[Math.floor(Math.random() * descriptions.length)];
  }

  private generateDialogueOptions(prompt: string): string[] {
    const npcName = this.extractNPCName(prompt) || 'Character';
    const threatLevel = this.extractThreatLevel(prompt);
    
    if (threatLevel === 'high') {
      return [
        "Stay back! Something's not right here.",
        "We need to be very careful right now.",
        "I sense danger approaching."
      ];
    } else if (threatLevel === 'medium') {
      return [
        "Keep your eyes open, friend.",
        "Things seem a bit tense around here.",
        "Best to stay alert."
      ];
    } else {
      return [
        "Good day to you, traveler!",
        "Welcome to our establishment.",
        "How may I assist you today?"
      ];
    }
  }

  private generateContextualResponse(prompt: string): string {
    const playerAction = this.extractPlayerAction(prompt);
    
    if (playerAction?.includes('greet')) {
      return "Greetings! It's always good to meet a friendly face.";
    } else if (playerAction?.includes('ask')) {
      return "I'd be happy to help with what I know.";
    } else if (playerAction?.includes('buy')) {
      return "Let me see what we have available for you.";
    } else {
      return "I see what you're getting at. Let me think about that.";
    }
  }

  private extractNPCName(prompt: string): string | null {
    const match = prompt.match(/npc\s+"([^"]+)"/i);
    return match ? match[1] : null;
  }

  private extractLocation(prompt: string): string | null {
    const match = prompt.match(/location:\s*([^\n,]+)/i);
    return match ? match[1].trim() : null;
  }

  private extractThreatLevel(prompt: string): string {
    if (prompt.includes('threat level: high')) return 'high';
    if (prompt.includes('threat level: medium')) return 'medium';
    return 'low';
  }

  private extractPlayerAction(prompt: string): string | null {
    const match = prompt.match(/player action:\s*"([^"]+)"/i);
    return match ? match[1] : null;
  }
}

// Mock dependencies
class MockBehaviorSystem {
  private npcs = new Map([
    ['guard_001', {
      id: 'guard_001',
      name: 'Captain Marcus',
      personality: {
        traits: ['dutiful', 'observant', 'protective'],
        motivations: ['maintain order', 'protect civilians'],
        fears: ['failing in duty', 'innocent casualties'],
        goals: ['secure the area', 'train new recruits'],
        relationships: new Map()
      }
    }],
    ['bartender_001', {
      id: 'bartender_001',
      name: 'Innkeeper Sarah',
      personality: {
        traits: ['friendly', 'gossipy', 'business-minded'],
        motivations: ['profitable business', 'happy customers'],
        fears: ['losing customers', 'trouble in the tavern'],
        goals: ['expand the business', 'maintain reputation'],
        relationships: new Map()
      }
    }]
  ]);

  getNPC(id: string) {
    return this.npcs.get(id);
  }
}

class MockCampaignAssistant {
  context = {
    campaignName: 'The Shadowed Vale',
    currentAct: 'Investigation',
    majorNPCs: ['Captain Marcus', 'Innkeeper Sarah'],
    activeQuests: ['Find the Missing Merchant', 'Investigate Strange Sounds'],
    worldState: {
      tension: 'medium',
      economicState: 'stable',
      politicalClimate: 'uncertain'
    }
  };
}

async function runProductionDemo(): Promise<void> {
  console.log('🚀 Production-Ready AI Integration Demo\n');
  console.log('This demonstrates type-safe AI systems with comprehensive error handling and realistic scenarios.\n');
  console.log('=' .repeat(70));

  // Initialize the type-safe NPC manager
  const provider = new ProductionMockProvider();
  const behaviorSystem = new MockBehaviorSystem();
  const campaignAssistant = new MockCampaignAssistant();

  const config: DynamicNPCConfig = {
    aiProvider: provider,
    campaignAssistant,
    behaviorSystem,
    updateInterval: 30000, // 30 seconds
    maxContextLength: 2000,
    creativityLevel: 0.7
  };

  const npcManager = new TypeSafeDynamicNPCManager(config);

  // Set up event listeners
  npcManager.on('behaviorGenerated', (event) => {
    console.log(`📋 Behavior Generated: ${event.data.npcId} -> ${event.data.behavior.action}`);
  });

  npcManager.on('dialogueGenerated', (event) => {
    console.log(`💬 Dialogue Generated: ${event.data.npcId} (${event.data.dialogue.length} options)`);
  });

  npcManager.on('playerInteraction', (event) => {
    console.log(`🎭 Player Interaction: ${event.data.npcId} responded to ${event.data.playerId}`);
  });

  try {
    // Scenario 1: Tavern Guard Behavior
    console.log('\n📍 Scenario 1: Tavern Security Assessment');
    const guardContext: NPCBehaviorContext = {
      npc: {
        id: 'guard_001',
        name: 'Captain Marcus',
        personality: {
          traits: ['dutiful', 'observant', 'protective'],
          motivations: ['maintain order', 'protect civilians'],
          fears: ['failing in duty', 'innocent casualties'],
          goals: ['secure the area', 'train new recruits'],
          relationships: new Map()
        }
      },
      location: 'tavern_main_hall',
      nearbyEntities: ['bartender_001', 'patron_001', 'patron_002', 'hooded_stranger'],
      currentGoal: 'maintain_security',
      threatLevel: 'medium',
      gameState: {
        timeOfDay: 'evening',
        crowdLevel: 'moderate',
        recentEvents: ['stranger_arrived', 'unusual_quiet']
      }
    };

    const guardBehavior = await npcManager.generateNPCBehavior('guard_001', guardContext);
    console.log('Guard Behavior:', guardBehavior);

    // Scenario 2: Contextual Dialogue
    console.log('\n💬 Scenario 2: Contextual Dialogue Generation');
    const guardDialogue = await npcManager.generateNPCDialogue('guard_001', guardContext, 'security_concerns');
    console.log('Guard Dialogue Options:', guardDialogue);

    // Scenario 3: Player Interaction
    console.log('\n🎭 Scenario 3: Player Interaction Processing');
    const playerResponse = await npcManager.generateContextualResponse(
      'guard_001',
      'player_001',
      'I noticed someone suspicious in the corner. Should I be concerned?',
      { playerReputation: 'trusted', previousInteractions: 3 }
    );
    console.log('NPC Response:', playerResponse);

    // Scenario 4: Bartender in Different Context
    console.log('\n🍺 Scenario 4: Bartender During Busy Evening');
    const bartenderContext: NPCBehaviorContext = {
      npc: {
        id: 'bartender_001',
        name: 'Innkeeper Sarah',
        personality: {
          traits: ['friendly', 'gossipy', 'business-minded'],
          motivations: ['profitable business', 'happy customers'],
          fears: ['losing customers', 'trouble in the tavern'],
          goals: ['expand the business', 'maintain reputation'],
          relationships: new Map()
        }
      },
      location: 'tavern_bar',
      nearbyEntities: ['patron_001', 'patron_002', 'patron_003', 'guard_001'],
      currentGoal: 'serve_customers',
      threatLevel: 'low',
      gameState: {
        timeOfDay: 'evening',
        crowdLevel: 'busy',
        orderQueue: 5
      }
    };

    const bartenderBehavior = await npcManager.generateNPCBehavior('bartender_001', bartenderContext);
    console.log('Bartender Behavior:', bartenderBehavior);

    const bartenderDialogue = await npcManager.generateNPCDialogue('bartender_001', bartenderContext, 'local_gossip');
    console.log('Bartender Dialogue:', bartenderDialogue);

    // Scenario 5: Demonstrate Caching
    console.log('\n⚡ Scenario 5: Caching Performance');
    console.time('First Request');
    await npcManager.generateNPCBehavior('guard_001', guardContext);
    console.timeEnd('First Request');

    console.time('Cached Request');
    await npcManager.generateNPCBehavior('guard_001', guardContext);
    console.timeEnd('Cached Request');

    // Show system metrics
    console.log('\n📊 System Metrics:');
    const metrics = npcManager.getMetrics();
    console.log(JSON.stringify(metrics, null, 2));

    // Show NPC history
    console.log('\n📚 NPC Interaction History:');
    const guardHistory = npcManager.getNPCHistory('guard_001');
    guardHistory.forEach((entry, index) => {
      console.log(`  ${index + 1}. ${entry}`);
    });

    console.log('\n' + '=' .repeat(70));
    console.log('✅ Production Demo Completed Successfully!');
    console.log('\nKey Features Demonstrated:');
    console.log('• Type-safe AI integration with comprehensive error handling');
    console.log('• Context-aware NPC behavior generation');
    console.log('• Dynamic dialogue system with personality integration');
    console.log('• Player interaction processing with memory');
    console.log('• Intelligent caching for performance optimization');
    console.log('• Event-driven architecture for extensibility');
    console.log('• Production-ready metrics and monitoring');

  } catch (error) {
    console.error('❌ Demo failed:', error);
  } finally {
    npcManager.dispose();
  }
}

// Export for testing
export { runProductionDemo, ProductionMockProvider };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runProductionDemo().catch(console.error);
}
