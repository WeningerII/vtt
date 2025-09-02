import { AIProvider, AICapability, HealthStatus, TextGenerationRequest, TextGenerationResult, ImageGenerationRequest, ImageGenerationResult, AIContext } from '../index';
import { CircuitBreaker, circuitBreakerRegistry } from '../circuit-breaker';

/**
 * Wrapper for AI providers that adds circuit breaker functionality
 */
export class CircuitBreakerProvider implements AIProvider {
  public readonly name: string;
  public readonly version: string;
  private circuitBreaker: CircuitBreaker;

  constructor(
    private provider: AIProvider,
    private options?: {
      failureThreshold?: number;
      resetTimeout?: number;
      monitoringPeriod?: number;
    }
  ) {
    this.name = `${provider.name}-protected`;
    this.version = provider.version;
    this.circuitBreaker = circuitBreakerRegistry.getBreaker(provider.name, {
      failureThreshold: options?.failureThreshold ?? 5,
      resetTimeout: options?.resetTimeout ?? 60000,
      monitoringPeriod: options?.monitoringPeriod ?? 10000,
      halfOpenRequests: 3
    });
  }

  capabilities(): AICapability[] {
    return this.provider.capabilities();
  }

  async healthCheck(): Promise<HealthStatus> {
    return this.circuitBreaker.execute(async () => {
      return this.provider.healthCheck();
    });
  }

  async generateText?(req: TextGenerationRequest, ctx?: AIContext): Promise<TextGenerationResult> {
    if (!this.provider.generateText) {
      throw new Error(`Provider ${this.provider.name} does not support text generation`);
    }
    return this.circuitBreaker.execute(async () => {
      return this.provider.generateText!(req, ctx);
    });
  }

  async generateImage?(req: ImageGenerationRequest, ctx?: AIContext): Promise<ImageGenerationResult> {
    if (!this.provider.generateImage) {
      throw new Error(`Provider ${this.provider.name} does not support image generation`);
    }
    return this.circuitBreaker.execute(async () => {
      return this.provider.generateImage!(req, ctx);
    });
  }

  getCircuitBreakerStats() {
    return this.circuitBreaker.getStats();
  }
}
