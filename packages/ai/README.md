# @vtt/ai

Advanced AI integration package for the Virtual Tabletop (VTT) platform with production-ready provider support and intelligent routing.

## Overview

This package provides comprehensive AI-powered features for enhancing VTT gameplay, including:

- **Modern AI Providers**: Anthropic Claude 4, Google Gemini 2.5, Azure OpenAI GPT-5
- **Intelligent Routing**: Provider-agnostic model mapping with automatic fallback chains
- **VTT Content Generation**: Specialized methods for NPCs, locations, quests, magic items, encounters
- **Production Features**: Circuit breaker patterns, health monitoring, cost tracking
- **Enhanced Reliability**: Per-provider state management and failover logic

## Installation

```bash
npm install @vtt/ai
```

## Quick Start

### Basic Setup

```typescript
import { 
  ProductionAIManager, 
  VTTContentGenerator,
  ProviderFactory 
} from '@vtt/ai';

// Initialize production AI system
const aiManager = new ProductionAIManager();
await aiManager.initialize();

// Generate VTT content
const npc = await aiManager.generateNPC({
  setting: 'Forgotten Realms',
  theme: 'High Fantasy',
  playerLevel: 5
});

console.log('Generated NPC:', npc);
```

### Environment Configuration

Set up your environment variables for AI providers:

```env
# Anthropic Claude 4
ANTHROPIC_API_KEY=your-anthropic-key

# Google Gemini 2.5
GOOGLE_API_KEY=your-google-key
GOOGLE_PROJECT_ID=your-project-id  # Optional

# Azure OpenAI GPT-5
AZURE_OPENAI_API_KEY=your-azure-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_REGISTRATION_KEY=your-registration-key  # Optional for GPT-5
```

## Advanced Usage

### Custom Provider Configuration

```typescript
import { 
  ProviderFactory, 
  ProductionProviderRegistry,
  IntelligentProviderRouter 
} from '@vtt/ai';

// Create providers with custom circuit breaker settings
const factory = ProviderFactory.getInstance({
  failureThreshold: 3,
  resetTimeoutMs: 30000,
  monitoringWindowMs: 120000
});

const providers = {
  claude: factory.createAnthropicProvider({
    apiKey: process.env.ANTHROPIC_API_KEY!,
    defaultModel: 'claude-4-opus-4.1'
  }),
  gemini: factory.createGeminiProvider({
    apiKey: process.env.GOOGLE_API_KEY!,
    projectId: process.env.GOOGLE_PROJECT_ID,
    defaultModel: 'gemini-2.5-pro'
  }),
  azure: factory.createAzureOpenAIProvider({
    apiKey: process.env.AZURE_OPENAI_API_KEY!,
    endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
    deployments: {
      'gpt-5': {
        deploymentName: 'gpt-5-deployment',
        modelName: 'gpt-5',
        apiVersion: '2024-12-01'
      }
    }
  })
};

// Set up intelligent routing
const registry = new ProductionProviderRegistry();
const router = new IntelligentProviderRouter(registry);

Object.values(providers).forEach(provider => {
  registry.registerProvider(provider);
});
```

### VTT Content Generation

#### Generate NPCs

```typescript
import { VTTContentGenerator } from '@vtt/ai';

const generator = new VTTContentGenerator(providers.claude, [
  providers.gemini, 
  providers.azure
]);

// Generate a detailed NPC
const npc = await generator.generateNPC('Create a mysterious merchant', {
  playerLevel: 8,
  role: 'vendor',
  detailLevel: 'detailed'
});

// Generate multiple NPCs for a settlement
const npcs = await Promise.all([
  generator.generateNPC('Tavern keeper', { role: 'neutral' }),
  generator.generateNPC('Local blacksmith', { role: 'ally' }),
  generator.generateNPC('Suspicious stranger', { role: 'enemy' })
]);
```

#### Generate Locations

```typescript
// Create a dungeon
const dungeon = await generator.generateLocation('Ancient dwarven ruins', {
  locationType: 'dungeon',
  scale: 'building',
  inhabitants: true
});

// Generate a settlement
const town = await generator.generateLocation('Frontier trading post', {
  locationType: 'settlement',
  scale: 'district',
  inhabitants: true
});
```

#### Generate Quests

```typescript
// Create a quest appropriate for the party level
const quest = await generator.generateQuest('Rescue the missing caravan', {
  difficulty: 'medium',
  tags: ['rescue', 'travel', 'combat'],
  references: ['The Merchant Guild', 'Goblin Raiders']
});
```

#### Generate Magic Items

```typescript
// Create magic items by rarity
const legendaryItem = await generator.generateMagicItem('Ancient artifact', {
  rarity: 'legendary',
  itemType: 'weapon',
  attunement: true
});

const commonPotion = await generator.generateMagicItem('Healing potion', {
  rarity: 'common',
  itemType: 'consumable'
});
```

#### Generate Encounters

```typescript
// Create combat encounters
const encounter = await generator.generateEncounter('Ambush in the forest', {
  difficulty: 'hard',
  environment: 'forest',
  encounterType: 'combat'
});

// Generate social encounters
const socialEncounter = await generator.generateEncounter('Negotiating with nobles', {
  difficulty: 'medium',
  environment: 'urban',
  encounterType: 'social'
});
```

### Campaign Content Generation

```typescript
// Generate campaign hooks
const hooks = await generator.generateCampaignHooks('Epic fantasy campaign');

// Batch generate content for a new campaign
const campaignContent = await Promise.all([
  generator.generateNPC('Campaign villain'),
  generator.generateLocation('Starting town'),
  generator.generateQuest('Opening adventure'),
  generator.generateMagicItem('Legendary artifact'),
  generator.generateCampaignHooks('Main storyline')
]);
```

### Health Monitoring and Cost Tracking

```typescript
// Monitor provider health
const healthStatus = await router.getHealthStatus();
console.log('Provider Health:', healthStatus);

// Track usage costs
const costs = aiManager.getTotalCosts();
console.log('Total AI costs:', costs);

// Get usage analytics
const analytics = aiManager.getUsageAnalytics();
console.log('Usage stats:', analytics);
```

## API Reference

### Core Classes

#### ProductionAIManager
High-level manager for AI operations with built-in provider management and monitoring.

**Methods:**
- `initialize()` - Initialize all providers and health monitoring
- `generateNPC(context)` - Generate NPC with intelligent provider selection
- `generateLocation(context)` - Create location content
- `generateQuest(context)` - Generate quest content
- `getTotalCosts()` - Get aggregated cost metrics
- `getHealthStatus()` - Check provider health status

#### VTTContentGenerator
Specialized content generator for VTT-specific content types.

**Methods:**
- `generateNPC(prompt, options?)` - Generate NPC content
- `generateLocation(prompt, options?)` - Generate location content  
- `generateQuest(prompt, options?)` - Generate quest content
- `generateMagicItem(prompt, options?)` - Generate magic item content
- `generateEncounter(prompt, options?)` - Generate encounter content
- `generateCampaignHooks(prompt, options?)` - Generate campaign hooks

#### ProviderFactory
Singleton factory for creating AI providers with circuit breaker integration.

**Methods:**
- `getInstance(config?)` - Get factory instance with optional circuit breaker config
- `createAnthropicProvider(options)` - Create Anthropic Claude 4 provider
- `createGeminiProvider(options)` - Create Google Gemini 2.5 provider  
- `createAzureOpenAIProvider(options)` - Create Azure OpenAI provider

### Provider Configuration

#### Anthropic Claude 4 Options
```typescript
{
  apiKey: string;
  baseURL?: string;
  defaultModel?: string; // 'claude-4-opus-4.1' | 'claude-4-sonnet-4'
}
```

#### Google Gemini 2.5 Options
```typescript
{
  apiKey: string;
  baseURL?: string;
  projectId?: string;
  defaultModel?: string; // 'gemini-2.5-pro' | 'gemini-2.5-flash'
}
```

#### Azure OpenAI Options
```typescript
{
  apiKey: string;
  endpoint: string;
  deployments?: Record<string, DeploymentConfig>;
  registrationKey?: string;
  apiVersion?: string;
}
```

### Content Generation Options

All generation methods support these common options:

```typescript
// NPC Options
{
  playerLevel?: number;
  role?: 'ally' | 'neutral' | 'enemy' | 'vendor' | 'quest_giver';
  detailLevel?: 'basic' | 'detailed' | 'full_stat_block';
}

// Location Options  
{
  locationType?: 'dungeon' | 'settlement' | 'wilderness' | 'building' | 'landmark';
  scale?: 'settlement' | 'building' | 'room' | 'district' | 'region';
  inhabitants?: boolean;
}

// Quest Options
{
  difficulty?: string;
  tags?: string[];
  references?: string[];
}
```

## Production Deployment

### Circuit Breaker Configuration

```typescript
const circuitBreakerConfig = {
  failureThreshold: 3,        // Failures before opening circuit
  resetTimeoutMs: 30000,      // Time before attempting reset
  monitoringWindowMs: 120000, // Sliding window for failure tracking  
  halfOpenMaxCalls: 2         // Max calls in half-open state
};
```

### Health Check Monitoring

The system automatically monitors provider health and routes requests to healthy providers:

```typescript
// Check overall system health
const health = await aiManager.getHealthStatus();

// Individual provider health
for (const [name, status] of Object.entries(health.providers)) {
  console.log(`${name}: ${status.status} (${status.responseTime}ms)`);
}
```

### Error Handling

All methods include comprehensive error handling with automatic fallback:

```typescript
try {
  const content = await generator.generateNPC('Create NPC');
} catch (error) {
  console.error('All providers failed:', error.message);
  // Implement fallback logic or user notification
}
```

## License

MIT
