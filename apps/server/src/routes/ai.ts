import { RouteHandler } from "../router/types";
import { parseJsonBody, sendJson } from "../utils/json";
import { createAIServices } from "../ai/service";
import {
  ListProvidersResponseSchema,
  TextToImageRequestSchema,
  DepthRequestSchema,
  SegmentationRequestSchema,
} from "@vtt/core-schemas";

export const listProvidersHandler: RouteHandler = async (ctx) => {
  const ai = createAIServices(ctx.prisma);
  const providers = ai.listProviders();
  const validated = ListProvidersResponseSchema.parse(providers);
  sendJson(ctx.res, validated);
};

export const textToImageHandler: RouteHandler = async (ctx) => {
  const data = await parseJsonBody(ctx.req);
  const parsed = TextToImageRequestSchema.safeParse(data);
  if (!parsed.success) {
    return sendJson(ctx.res, { error: "Invalid body", details: parsed.error.flatten() }, 400);
  }
  const traceHeader = ctx.req.headers["x-trace-id"];
  const traceCtx = typeof traceHeader === "string" ? { traceId: traceHeader } : undefined;

  const ai = createAIServices(ctx.prisma);
  const req = {
    prompt: parsed.data.prompt,
    ...(parsed.data.negativePrompt !== undefined
      ? { negativePrompt: parsed.data.negativePrompt }
      : {}),
    ...(parsed.data.width !== undefined ? { width: parsed.data.width } : {}),
    ...(parsed.data.height !== undefined ? { height: parsed.data.height } : {}),
    ...(parsed.data.seed !== undefined ? { seed: parsed.data.seed } : {}),
    ...(parsed.data.mapId !== undefined ? { mapId: parsed.data.mapId } : {}),
  } as const;
  const result = await ai.textToImage(req as any, traceCtx);

  sendJson(ctx.res, result);
};

export const depthHandler: RouteHandler = async (ctx) => {
  const data = await parseJsonBody(ctx.req);
  const parsed = DepthRequestSchema.safeParse(data);
  if (!parsed.success) {
    return sendJson(ctx.res, { error: "Invalid body", details: parsed.error.flatten() }, 400);
  }
  const traceHeader = ctx.req.headers["x-trace-id"];
  const traceCtx = typeof traceHeader === "string" ? { traceId: traceHeader } : undefined;

  const ai = createAIServices(ctx.prisma);
  const req = {
    image: {
      uri: parsed.data.image.uri,
      ...(parsed.data.image.width !== undefined ? { width: parsed.data.image.width } : {}),
      ...(parsed.data.image.height !== undefined ? { height: parsed.data.image.height } : {}),
      ...(parsed.data.image.mimeType !== undefined ? { mimeType: parsed.data.image.mimeType } : {}),
    },
    ...(parsed.data.mapId !== undefined ? { mapId: parsed.data.mapId } : {}),
  } as const;
  const result = await ai.depth(req as any, traceCtx);

  sendJson(ctx.res, result);
};

export const segmentationHandler: RouteHandler = async (ctx) => {
  const data = await parseJsonBody(ctx.req);
  const parsed = SegmentationRequestSchema.safeParse(data);
  if (!parsed.success) {
    return sendJson(ctx.res, { error: "Invalid body", details: parsed.error.flatten() }, 400);
  }
  const traceHeader = ctx.req.headers["x-trace-id"];
  const traceCtx = typeof traceHeader === "string" ? { traceId: traceHeader } : undefined;

  const ai = createAIServices(ctx.prisma);
  const req = {
    image: {
      uri: parsed.data.image.uri,
      ...(parsed.data.image.width !== undefined ? { width: parsed.data.image.width } : {}),
      ...(parsed.data.image.height !== undefined ? { height: parsed.data.image.height } : {}),
      ...(parsed.data.image.mimeType !== undefined ? { mimeType: parsed.data.image.mimeType } : {}),
    },
    ...(parsed.data.labels !== undefined ? { labels: parsed.data.labels } : {}),
    ...(parsed.data.mapId !== undefined ? { mapId: parsed.data.mapId } : {}),
  } as const;
  const result = await ai.segmentation(req as any, traceCtx);

  sendJson(ctx.res, result);
};
