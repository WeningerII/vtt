import { AIProvider, AICapability } from '../index';
import { CircuitBreaker, circuitBreakerRegistry } from '../circuit-breaker';

/**
 * Wrapper for AI providers that adds circuit breaker functionality
 */
export class CircuitBreakerProvider implements AIProvider {
  public readonly name: string;
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

  async textToImage(request: any, context?: any): Promise<any> {
    return this.circuitBreaker.execute(async () => {
      return this.provider.textToImage(request, context);
    });
  }

  async imageToImage?(request: any, context?: any): Promise<any> {
    if (!this.provider.imageToImage) {
      throw new Error(`Provider ${this.provider.name} does not support imageToImage`);
    }
    return this.circuitBreaker.execute(async () => {
      return this.provider.imageToImage!(request, context);
    });
  }

  async depth?(request: any, context?: any): Promise<any> {
    if (!this.provider.depth) {
      throw new Error(`Provider ${this.provider.name} does not support depth`);
    }
    return this.circuitBreaker.execute(async () => {
      return this.provider.depth!(request, context);
    });
  }

  async segmentation?(request: any, context?: any): Promise<any> {
    if (!this.provider.segmentation) {
      throw new Error(`Provider ${this.provider.name} does not support segmentation`);
    }
    return this.circuitBreaker.execute(async () => {
      return this.provider.segmentation!(request, context);
    });
  }

  async textToSpeech?(request: any, context?: any): Promise<any> {
    if (!this.provider.textToSpeech) {
      throw new Error(`Provider ${this.provider.name} does not support textToSpeech`);
    }
    return this.circuitBreaker.execute(async () => {
      return this.provider.textToSpeech!(request, context);
    });
  }

  async speechToText?(request: any, context?: any): Promise<any> {
    if (!this.provider.speechToText) {
      throw new Error(`Provider ${this.provider.name} does not support speechToText`);
    }
    return this.circuitBreaker.execute(async () => {
      return this.provider.speechToText!(request, context);
    });
  }

  async chat?(request: any, context?: any): Promise<any> {
    if (!this.provider.chat) {
      throw new Error(`Provider ${this.provider.name} does not support chat`);
    }
    return this.circuitBreaker.execute(async () => {
      return this.provider.chat!(request, context);
    });
  }

  async completion?(request: any, context?: any): Promise<any> {
    if (!this.provider.completion) {
      throw new Error(`Provider ${this.provider.name} does not support completion`);
    }
    return this.circuitBreaker.execute(async () => {
      return this.provider.completion!(request, context);
    });
  }

  getCircuitBreakerStats() {
    return this.circuitBreaker.getStats();
  }
}
