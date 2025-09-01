import { PrismaClient } from "@prisma/client";
import {
  AIContext,
  AIProvider,
  AIRegistry,
  AIRouter,
  DummyProvider,
  DepthRequest,
  SegmentationRequest,
  TextToImageRequest,
} from "@vtt/ai";
import {
  StabilityAIProvider,
  OpenAIProvider,
  HuggingFaceProvider,
  ReplicateProvider,
  createProviders,
} from "@vtt/ai/src/providers/RealProviders";
import { circuitBreakerRegistry, CircuitBreaker } from "@vtt/ai/src/circuit-breaker";
import { CircuitBreakerProvider } from "@vtt/ai/src/providers/CircuitBreakerProvider";

export type WithMapId<T> = T & { mapId?: string };

export function createAIServices(prisma: PrismaClient) {
  const registry = new AIRegistry();
  // Register built-in dummy provider for local/testing
  registry.register(new DummyProvider() as unknown as AIProvider);
  
  // Register real providers based on environment configuration
  const stabilityKey = process.env.STABILITY_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const huggingfaceKey = process.env.HUGGINGFACE_API_KEY;
  const replicateKey = process.env.REPLICATE_API_KEY;
  
  if (stabilityKey && stabilityKey.trim().length > 0) {
    const stabilityProvider = new StabilityAIProvider({
      apiKey: stabilityKey,
      baseUrl: process.env.STABILITY_BASE_URL || "https://api.stability.ai",
      model: process.env.STABILITY_MODEL || "stable-diffusion-xl-1024-v1-0",
    });
    const protectedProvider = new CircuitBreakerProvider(stabilityProvider as unknown as AIProvider, {
      failureThreshold: 5,
      resetTimeout: 60000,
      monitoringPeriod: 10000
    });
    registry.register(protectedProvider as unknown as AIProvider);
  }
  
  if (openaiKey && openaiKey.trim().length > 0) {
    const openaiProvider = new OpenAIProvider({
      apiKey: openaiKey,
      baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com",
    });
    const protectedProvider = new CircuitBreakerProvider(openaiProvider as unknown as AIProvider, {
      failureThreshold: 5,
      resetTimeout: 60000,
      monitoringPeriod: 10000
    });
    registry.register(protectedProvider as unknown as AIProvider);
  }
  
  if (huggingfaceKey && huggingfaceKey.trim().length > 0) {
    const huggingfaceProvider = new HuggingFaceProvider({
      apiKey: huggingfaceKey,
      baseUrl: process.env.HUGGINGFACE_BASE_URL || "https://api-inference.huggingface.co",
    });
    const protectedProvider = new CircuitBreakerProvider(huggingfaceProvider as unknown as AIProvider, {
      failureThreshold: 5,
      resetTimeout: 60000,
      monitoringPeriod: 10000
    });
    registry.register(protectedProvider as unknown as AIProvider);
  }
  
  if (replicateKey && replicateKey.trim().length > 0) {
    const replicateProvider = new ReplicateProvider(replicateKey);
    const protectedProvider = new CircuitBreakerProvider(replicateProvider as unknown as AIProvider, {
      failureThreshold: 5,
      resetTimeout: 60000,
      monitoringPeriod: 10000
    });
    registry.register(protectedProvider as unknown as AIProvider);
  }

  // Configure routing policy with preferred providers
  const routingPolicy = {
    preferred: process.env.AI_PREFERRED_PROVIDERS?.split(",") || (stabilityKey ? ["stability-ai"] : []),
    forbid: process.env.AI_FORBIDDEN_PROVIDERS?.split(",") || [],
    weights: {
      "stability-ai": 2,
      "openai": 1.5,
      "huggingface": 1,
      "replicate": 1,
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
