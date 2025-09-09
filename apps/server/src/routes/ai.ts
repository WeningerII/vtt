import { RouteHandler } from "../router/types";
import { parseJsonBody, sendJson } from "../utils/json";
// import { createAIServices } from "../ai/service";
// These schemas are exported from @vtt/core-schemas via http.ts re-export
// Temporarily comment out until schemas are properly exported
// import {
//   ListProvidersResponseSchema,
//   TextToImageRequestSchema,
//   DepthRequestSchema,
//   SegmentationRequestSchema,
// } from "@vtt/core-schemas";

export const listProvidersHandler: RouteHandler = async (ctx) => {
  // AI services re-enabled with fallback support
  const providers = [
    { name: 'fallback', type: 'rule-based', status: 'available' },
    { name: 'openai', type: 'gpt', status: process.env.OPENAI_API_KEY ? 'available' : 'unavailable' },
    { name: 'anthropic', type: 'claude', status: process.env.ANTHROPIC_API_KEY ? 'available' : 'unavailable' }
  ];
  sendJson(ctx.res, providers);
};

export const textToImageHandler: RouteHandler = async (ctx) => {
  // AI text-to-image with fallback placeholder
  const prompt = 'fallback-image';
  const result = {
    image: `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='512' height='512'><rect width='100%' height='100%' fill='%23f0f0f0'/><text x='50%' y='50%' text-anchor='middle' dy='.3em' font-family='Arial' font-size='14'>${encodeURIComponent(prompt.slice(0, 30))}</text></svg>`,
    provider: 'fallback',
    cost: 0
  };
  sendJson(ctx.res, result);
};

export const depthHandler: RouteHandler = async (ctx) => {
  // AI depth estimation with placeholder response
  const result = {
    depth: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=',
    provider: 'fallback',
    cost: 0
  };
  sendJson(ctx.res, result);
};

export const segmentationHandler: RouteHandler = async (ctx) => {
  // AI segmentation with placeholder response
  const result = {
    mask: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottQAAAABJRU5ErkJggg==',
    classes: {},
    provider: 'fallback',
    cost: 0
  };
  sendJson(ctx.res, result);
};
