import { PrismaClient } from "@prisma/client";
import { logger } from "@vtt/logging";
// Restore AI imports now that build issues are resolved
import {
  AIContext,
  AIProvider,
  AIRegistry,
  AIRouter,
  DummyProvider,
  DepthRequest,
  SegmentationRequest,
  TextToImageRequest,
  CircuitBreakerProvider,
} from "@vtt/ai";

// Import providers from specific paths 
import {
  OpenAIProvider,
  AnthropicProvider,
  StabilityAIProvider,
  HuggingFaceProvider,
  ReplicateProvider,
  createProviders
} from "@vtt/ai/src/providers/RealProviders";

export type WithMapId<T> = T & { mapId?: string };

export function createAIServices(prisma: PrismaClient) {
  const registry = new AIRegistry();
  
  // Register built-in dummy provider for local/testing
  const dummyProvider = new DummyProvider() as unknown as AIProvider;
  registry.register(dummyProvider);

  // Initialize real providers based on environment configuration
  const providerConfig = {
    openai: process.env.OPENAI_API_KEY ? {
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: process.env.OPENAI_BASE_URL
    } : undefined,
    anthropic: process.env.ANTHROPIC_API_KEY ? {
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseUrl: process.env.ANTHROPIC_BASE_URL
    } : undefined,
    stability: process.env.STABILITY_API_KEY ? {
      apiKey: process.env.STABILITY_API_KEY,
      baseUrl: process.env.STABILITY_BASE_URL
    } : undefined,
    huggingface: process.env.HUGGINGFACE_API_KEY ? {
      apiKey: process.env.HUGGINGFACE_API_KEY,
      baseUrl: process.env.HUGGINGFACE_BASE_URL
    } : undefined,
    replicate: process.env.REPLICATE_API_KEY ? {
      apiKey: process.env.REPLICATE_API_KEY
    } : undefined
  };

  // Create and register real providers with circuit breaker protection
  const realProviders = createProviders(providerConfig);
  realProviders.forEach(provider => {
    const protectedProvider = new CircuitBreakerProvider(provider, {
      failureThreshold: 5,
      resetTimeout: 60000,
      monitoringPeriod: 300000,
    });
    registry.register(protectedProvider);
  });

  const availableProviders = registry.list().map(p => p.name);
  logger.info(`AI Service: Initialized with providers: ${availableProviders.join(', ')}`);

  // Configure routing policy with preferred providers
  const routingPolicy = {
    preferred: process.env.AI_PREFERRED_PROVIDERS?.split(",") || ["openai", "anthropic", "dummy"],
    forbid: process.env.AI_FORBIDDEN_PROVIDERS?.split(",") || [],
    weights: {
      "openai": 1.0,
      "anthropic": 0.8,
      "stability": 0.6,
      "huggingface": 0.4,
      "replicate": 0.3,
      "dummy": 0.1,
    },
  };

  const router = new AIRouter(registry, routingPolicy);

  function listProviders() {
    return registry
      .list()
      .map((p: AIProvider) => ({ name: p.name, capabilities: p.capabilities() }));
  }

  async function textToImage(input: WithMapId<TextToImageRequest>, _ctx?: AIContext) {
    const job = await prisma.generationJob.create({
      data: {
        type: "TEXT_TO_IMAGE",
        status: "RUNNING",
        input: input as any,
        mapId: input.mapId ?? null,
      },
    });
    const started = Date.now();
    try {
      const result = await router.textToImage(input, _ctx);
      const call = await prisma.providerCall.create({
        data: {
          jobId: job.id,
          provider: result.provider,
          model: result.model ?? null,
          costUSD: result.costUSD ?? 0,
          latencyMs: result.latencyMs ?? Date.now() - started,
          success: true,
        },
      });

      const asset = await prisma.asset.create({
        data: {
          mapId: input.mapId ?? null,
          kind: "ORIGINAL",
          uri: result.image.uri,
          mimeType: result.image.mimeType ?? null,
          width: result.image.width ?? null,
          height: result.image.height ?? null,
        },
      });

      const updated = await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: "SUCCEEDED",
          output: {
            image: result.image,
            provider: result.provider,
            model: result.model,
            costUSD: result.costUSD,
            latencyMs: result.latencyMs,
            assetId: asset.id,
          } as any,
        },
      });

      return { job: updated, callId: call.id, asset };
    } catch (err: any) {
      await prisma.providerCall.create({
        data: {
          jobId: job.id,
          provider: "router",
          model: null,
          costUSD: 0,
          latencyMs: Date.now() - started,
          success: false,
          error: String(err?.message ?? err),
        },
      });
      await prisma.generationJob.update({
        where: { id: job.id },
        data: { status: "FAILED", error: String(err?.message ?? err) },
      });
      throw err;
    }
  }

  async function depth(input: WithMapId<DepthRequest>, _ctx?: AIContext) {
    const job = await prisma.generationJob.create({
      data: {
        type: "DEPTH",
        status: "RUNNING",
        input: input as any,
        mapId: input.mapId ?? null,
      },
    });
    const started = Date.now();
    try {
      const result = await router.depth(input, _ctx);
      const call = await prisma.providerCall.create({
        data: {
          jobId: job.id,
          provider: result.provider,
          model: result.model ?? null,
          costUSD: result.costUSD ?? 0,
          latencyMs: result.latencyMs ?? Date.now() - started,
          success: true,
        },
      });

      const asset = await prisma.asset.create({
        data: {
          mapId: input.mapId ?? null,
          kind: "DEPTH",
          uri: result.depth.uri,
          mimeType: result.depth.mimeType ?? null,
          width: result.depth.width ?? null,
          height: result.depth.height ?? null,
        },
      });

      const updated = await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: "SUCCEEDED",
          output: {
            depth: result.depth,
            provider: result.provider,
            model: result.model,
            costUSD: result.costUSD,
            latencyMs: result.latencyMs,
            assetId: asset.id,
          } as any,
        },
      });
      return { job: updated, callId: call.id, asset };
    } catch (err: any) {
      await prisma.providerCall.create({
        data: {
          jobId: job.id,
          provider: "router",
          model: null,
          costUSD: 0,
          latencyMs: Date.now() - started,
          success: false,
          error: String(err?.message ?? err),
        },
      });
      await prisma.generationJob.update({
        where: { id: job.id },
        data: { status: "FAILED", error: String(err?.message ?? err) },
      });
      throw err;
    }
  }

  async function segmentation(input: WithMapId<SegmentationRequest>, _ctx?: AIContext) {
    const job = await prisma.generationJob.create({
      data: {
        type: "SEGMENTATION",
        status: "RUNNING",
        input: input as any,
        mapId: input.mapId ?? null,
      },
    });
    const started = Date.now();
    try {
      const result = await router.segmentation(input, _ctx);
      const call = await prisma.providerCall.create({
        data: {
          jobId: job.id,
          provider: result.provider,
          model: result.model ?? null,
          costUSD: result.costUSD ?? 0,
          latencyMs: result.latencyMs ?? Date.now() - started,
          success: true,
        },
      });

      const asset = await prisma.asset.create({
        data: {
          mapId: input.mapId ?? null,
          kind: "MASK",
          uri: result.mask.uri,
          mimeType: result.mask.mimeType ?? null,
          width: result.mask.width ?? null,
          height: result.mask.height ?? null,
        },
      });

      const updated = await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: "SUCCEEDED",
          output: {
            mask: result.mask,
            classes: result.classes ?? {},
            provider: result.provider,
            model: result.model,
            costUSD: result.costUSD,
            latencyMs: result.latencyMs,
            assetId: asset.id,
          } as any,
        },
      });
      return { job: updated, callId: call.id, asset };
    } catch (err: any) {
      await prisma.providerCall.create({
        data: {
          jobId: job.id,
          provider: "router",
          model: null,
          costUSD: 0,
          latencyMs: Date.now() - started,
          success: false,
          error: String(err?.message ?? err),
        },
      });
      await prisma.generationJob.update({
        where: { id: job.id },
        data: { status: "FAILED", error: String(err?.message ?? err) },
      });
      throw err;
    }
  }

  return {
    router,
    listProviders,
    textToImage,
    depth,
    segmentation,
  };
}
