import { RouteHandler } from "../router/types";
import { parseJsonBody, sendJson } from "../utils/json";
// import { createAIServices } from "../ai/service";
import {
  ListProvidersResponseSchema,
  TextToImageRequestSchema,
  DepthRequestSchema,
  SegmentationRequestSchema,
} from "@vtt/core-schemas";

export const listProvidersHandler: RouteHandler = async (ctx) => {
  // Temporarily disabled AI services
  const providers: any[] = [];
  sendJson(ctx.res, providers);
};

export const textToImageHandler: RouteHandler = async (ctx) => {
  // Temporarily disabled - AI services unavailable
  sendJson(ctx.res, { error: "AI services temporarily unavailable" }, 503);
};

export const depthHandler: RouteHandler = async (ctx) => {
  // Temporarily disabled - AI services unavailable
  sendJson(ctx.res, { error: "AI services temporarily unavailable" }, 503);
};

export const segmentationHandler: RouteHandler = async (ctx) => {
  // Temporarily disabled - AI services unavailable
  sendJson(ctx.res, { error: "AI services temporarily unavailable" }, 503);
};
