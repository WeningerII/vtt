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

export type WithMapId<T> = T & { mapId?: string };

export function createAIServices(prisma: PrismaClient) {
  const registry = new AIRegistry();
  // Register built-in dummy provider for local/testing
  registry.register(new DummyProvider() as unknown as AIProvider);
  // Real providers (conditional)
  const stabilityKey = process.env.STABILITY_API_KEY;
  // StabilityProvider temporarily disabled due to build issues
  // if (stabilityKey && stabilityKey.trim().length > 0) {
  //   const engine = process.env.STABILITY_ENGINE;
  //   const opts = { apiKey: stabilityKey, ...(engine && engine.trim().length > 0 ? { engine } : Record<string, any>) };
  //   registry.register(new StabilityProvider(opts as any) as unknown as AIProvider);
  // }

  const router = new AIRouter(
    registry,
    stabilityKey ? { preferred: ["stability"] } : {});

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
