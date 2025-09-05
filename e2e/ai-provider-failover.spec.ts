import { test, expect } from '@playwright/test';
import type { AIProvider, AITextOptions, AITextResponse, AICapability } from '../packages/core/src/index';

/**
 * Integration tests for AI provider failover and multi-provider support
 * Tests the robustness of the provider-agnostic AI system
 */

// Mock providers for testing failover scenarios
class MockSuccessProvider implements AIProvider {
  public readonly name = 'mock-success';
  public readonly type = 'chat' as const;
  public readonly capabilities: AICapability[] = ['text_generation'];

  async generateText(prompt: string, _options: AITextOptions = {}) {
    return {
      text: `Mock response: ${prompt}`,
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      model: 'mock-model',
      finishReason: 'stop' as const
    };
  }
}

class MockFailureProvider implements AIProvider {
  public readonly name = 'mock-failure';
  public readonly type = 'chat' as const;
  public readonly capabilities: AICapability[] = ['text_generation'];

  async generateText(_prompt: string, options?: AITextOptions): Promise<AITextResponse> {
    throw new Error('Mock provider failure');
  }
}

class MockSlowProvider implements AIProvider {
  public readonly name = 'mock-slow';
  public readonly type = 'chat' as const;
  public readonly capabilities: AICapability[] = ['text_generation'];

  async generateText(prompt: string, _options: AITextOptions = {}) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay
    return {
      text: `Slow response: ${prompt}`,
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      model: 'slow-model',
      finishReason: 'stop' as const
    };
  }
}

// Use dynamic import to load ESM module at runtime
let aiProviderRegistry: any;

test.beforeAll(async () => {
  ({ aiProviderRegistry } = await import('../packages/core/src/index'));
});

test.describe('AI Provider Failover System', () => {
  let originalProviders: Map<string, AIProvider>;

  test.beforeEach(async () => {
    // Store original providers for cleanup
    originalProviders = new Map();
    const registry = aiProviderRegistry as any;
    if (registry.providers) {
      for (const [name, provider] of registry.providers.entries()) {
        originalProviders.set(name, provider);
      }
    }
  });

  test.afterEach(async () => {
    // Restore original providers
    const registry = aiProviderRegistry as any;
    registry.providers.clear();
    registry.configs.clear();
    
    for (const [name, provider] of Array.from(originalProviders.entries())) {
      registry.providers.set(name, provider);
    }
  });

  test('should successfully use primary provider when available', async () => {
    // Register mock providers with different priorities
    aiProviderRegistry.registerProvider(
      new MockSuccessProvider(),
      { apiKey: 'test', timeout: 30000, maxRetries: 3, rateLimitPerMinute: 60, priority: 5, enabled: true }
    );

    const response = await aiProviderRegistry.generateText('Test prompt');
    
    expect(response.text).toBe('Mock response: Test prompt');
    expect(response.usage.totalTokens).toBe(30);
    expect(response.model).toBe('mock-model');
  });

  test('should failover to secondary provider when primary fails', async () => {
    // Register failure provider with higher priority
    aiProviderRegistry.registerProvider(
      new MockFailureProvider(),
      { apiKey: 'test', timeout: 30000, maxRetries: 1, rateLimitPerMinute: 60, priority: 5, enabled: true }
    );

    // Register success provider with lower priority
    aiProviderRegistry.registerProvider(
      new MockSuccessProvider(),
      { apiKey: 'test', timeout: 30000, maxRetries: 3, rateLimitPerMinute: 60, priority: 3, enabled: true }
    );

    const response = await aiProviderRegistry.generateText('Test prompt');
    
    expect(response.text).toBe('Mock response: Test prompt');
    expect(response.model).toBe('mock-model');
  });

  test('should track provider usage stats', async () => {
    aiProviderRegistry.registerProvider(
      new MockSuccessProvider(),
      { apiKey: 'test', timeout: 30000, maxRetries: 3, rateLimitPerMinute: 60, priority: 5, enabled: true }
    );

    // Make multiple requests
    await aiProviderRegistry.generateText('Test prompt 1');
    await aiProviderRegistry.generateText('Test prompt 2');
    
    const statsMap = aiProviderRegistry.getUsageStats('mock-success');
    const stats = statsMap.get('mock-success');
    expect(stats).toBeDefined();
    expect(stats!.totalRequests).toBe(2);
    expect(stats!.successfulRequests).toBe(2);
    expect(stats!.failedRequests).toBe(0);
    expect(stats!.totalTokensUsed).toBe(60); // 30 tokens per request
    expect(stats!.costEstimate).toBeGreaterThan(0);
  });

  test('should handle provider timeout gracefully', async () => {
    // Register slow provider that will timeout
    aiProviderRegistry.registerProvider(
      new MockSlowProvider(),
      { apiKey: 'test', timeout: 1000, maxRetries: 1, rateLimitPerMinute: 60, priority: 5, enabled: true }
    );

    // Register backup provider
    aiProviderRegistry.registerProvider(
      new MockSuccessProvider(),
      { apiKey: 'test', timeout: 30000, maxRetries: 3, rateLimitPerMinute: 60, priority: 3, enabled: true }
    );

    const response = await aiProviderRegistry.generateText('Test prompt');
    
    // Should failover to success provider
    expect(response.text).toBe('Mock response: Test prompt');
    expect(response.model).toBe('mock-model');
  });

  test('should respect provider enable/disable flags', async () => {
    // Register disabled provider
    aiProviderRegistry.registerProvider(
      new MockSuccessProvider(),
      { apiKey: 'test', timeout: 30000, maxRetries: 3, rateLimitPerMinute: 60, priority: 5, enabled: false }
    );

    // Should throw error since no enabled providers
    await expect(aiProviderRegistry.generateText('Test prompt')).rejects.toThrow('No text generation provider available');
  });

  test('should select provider by capability', async () => {
    class MockImageProvider implements AIProvider {
      public readonly name = 'mock-image';
      public readonly type = 'image' as const;
      public readonly capabilities: AICapability[] = ['image_generation'];

      async generateImage(_prompt: string) {
        return {
          images: [{ url: 'mock-image-url' }],
          created: Date.now()
        };
      }
    }

    aiProviderRegistry.registerProvider(
      new MockSuccessProvider(),
      { apiKey: 'test', timeout: 30000, maxRetries: 3, rateLimitPerMinute: 60, priority: 5, enabled: true }
    );

    const provider = aiProviderRegistry.getBestProvider('text_generation');
    expect(provider?.name).toBe('mock-success');

    const imageProvider = aiProviderRegistry.getBestProvider('image_generation');
    expect(imageProvider).toBeNull(); // No image provider registered
  });

  test('should handle concurrent requests properly', async () => {
    aiProviderRegistry.registerProvider(
      new MockSuccessProvider(),
      { apiKey: 'test', timeout: 30000, maxRetries: 3, rateLimitPerMinute: 60, priority: 5, enabled: true }
    );

    // Make concurrent requests
    const promises = Array.from({ length: 10 }, (_, i) => 
      aiProviderRegistry.generateText(`Concurrent prompt ${i}`)
    );

    const responses = await Promise.all(promises);
    
    expect(responses).toHaveLength(10);
    responses.forEach((response, i) => {
      expect(response.text).toBe(`Mock response: Concurrent prompt ${i}`);
    });

    const statsMap = aiProviderRegistry.getUsageStats();
    expect(statsMap.size).toBeGreaterThan(0);
    expect(statsMap.get('mock-success')).toBeDefined();
  });

  test('should provide comprehensive provider information', async () => {
    aiProviderRegistry.registerProvider(
      new MockSuccessProvider(),
      { apiKey: 'test', timeout: 30000, maxRetries: 3, rateLimitPerMinute: 60, priority: 5, enabled: true }
    );

    const providers = aiProviderRegistry.getAvailableProviders();
    expect(providers).toHaveLength(1);
    expect(providers[0].name).toBe('mock-success');

    const providerInfo = providers.find((p: any) => p.name === 'mock-success');
    expect(providerInfo).toMatchObject({
      name: 'mock-success',
      type: 'chat',
      capabilities: ['text_generation'],
      enabled: true,
      priority: 5
    });
  });
});

test.describe('Real Provider Integration', () => {
  test('should work with actual OpenRouter when configured', async () => {
    const openrouterKey = process.env.OPENROUTER_API_KEY;
    if (!openrouterKey) {
      test.skip(!process.env.OPENROUTER_API_KEY, 'OPENROUTER_API_KEY not configured');
    }

    const response = await aiProviderRegistry.generateText('Hello, this is a test message', {
      maxTokens: 50,
      temperature: 0.7
    });

    expect(response.text).toBeTruthy();
    expect(response.usage.totalTokens).toBeGreaterThan(0);
    expect(response.model).toBeTruthy();
  });

  test('should work with actual Anthropic when configured', async () => {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      test.skip(!process.env.ANTHROPIC_API_KEY, 'ANTHROPIC_API_KEY not configured');
    }

    const response = await aiProviderRegistry.generateText('Hello, this is a test message', {
      maxTokens: 50,
      temperature: 0.7
    });

    expect(response.text).toBeTruthy();
    expect(response.usage.totalTokens).toBeGreaterThan(0);
    expect(response.model).toBeTruthy();
  });

  test('should automatically failover between real providers', async () => {
    // This test requires multiple providers to be configured
    const hasMultipleProviders = !!(
      (process.env.OPENAI_API_KEY && process.env.ANTHROPIC_API_KEY) ||
      (process.env.OPENROUTER_API_KEY && process.env.GOOGLE_API_KEY) ||
      (process.env.ANTHROPIC_API_KEY && process.env.OPENROUTER_API_KEY)
    );

    if (!hasMultipleProviders) {
      test.skip(!process.env.OPENROUTER_API_KEY || !process.env.ANTHROPIC_API_KEY, 'Multiple AI providers not configured');
    }

    // Test that the system can handle provider selection and failover
    const response = await aiProviderRegistry.generateText('Generate a short greeting', {
      maxTokens: 20
    });

    expect(response.text).toBeTruthy();
    expect(response.usage.totalTokens).toBeGreaterThan(0);
    
    // Verify stats are being tracked
    const availableProviders = aiProviderRegistry.getAvailableProviders();
    expect(availableProviders.length).toBeGreaterThan(0);
  });
});

test.describe('Error Handling and Recovery', () => {
  test('should handle network errors gracefully', async () => {
    class MockNetworkErrorProvider implements AIProvider {
      public readonly name = 'mock-network-error';
      public readonly type = 'chat' as const;
      public readonly capabilities: AICapability[] = ['text_generation'];

      async generateText(_prompt: string, options?: AITextOptions): Promise<AITextResponse> {
        throw new Error('Network error: ECONNREFUSED');
      }
    }

    aiProviderRegistry.registerProvider(
      new MockNetworkErrorProvider(),
      { apiKey: 'test', timeout: 30000, maxRetries: 2, rateLimitPerMinute: 60, priority: 5, enabled: true }
    );

    aiProviderRegistry.registerProvider(
      new MockSuccessProvider(),
      { apiKey: 'test', timeout: 30000, maxRetries: 3, rateLimitPerMinute: 60, priority: 3, enabled: true }
    );

    const response = await aiProviderRegistry.generateText('Test prompt');
    expect(response.text).toBe('Mock response: Test prompt');

    // Verify failure was tracked
    const statsMap = aiProviderRegistry.getUsageStats('mock-network-error');
    const stats = statsMap.get('mock-network-error');
    expect(stats).toBeDefined();
    expect(stats!.failedRequests).toBeGreaterThan(0);
  });

  test('should handle rate limiting appropriately', async () => {
    class MockRateLimitedProvider implements AIProvider {
      public readonly name = 'mock-rate-limited';
      public readonly type = 'chat' as const;
      public readonly capabilities: AICapability[] = ['text_generation'];
      private callCount = 0;

      async generateText(prompt: string, options?: AITextOptions): Promise<AITextResponse> {
        this.callCount++;
        if (this.callCount <= 2) {
          throw new Error('Rate limit exceeded');
        }
        return {
          text: `Rate limited response: ${prompt}`,
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
          model: 'rate-limited-model',
          finishReason: 'stop' as const
        };
      }
    }

    aiProviderRegistry.registerProvider(
      new MockRateLimitedProvider(),
      { apiKey: 'test', timeout: 30000, maxRetries: 3, rateLimitPerMinute: 60, priority: 5, enabled: true }
    );

    // Should eventually succeed after retries
    const response = await aiProviderRegistry.generateText('Test prompt');
    expect(response.text).toBe('Rate limited response: Test prompt');
  });
});
