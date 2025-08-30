/**
 * Request validation middleware using Zod schemas
 */

import { z } from 'zod';

export const _validateRequest = (schemas: {
  body?: z.ZodSchema;
  query?: z.ZodSchema;
  params?: z.ZodSchema;
}) => {
  return async (ctx: any, _next: any) => {
    try {
      // Validate request body
      if (schemas.body) {
        ctx.body = schemas.body.parse(ctx.req.body);
      }

      // Validate query parameters
      if (schemas.query) {
        const url = new URL(ctx.req.url, `http://${ctx.req.headers.host}`);
        const query = Object.fromEntries(url.searchParams);
        ctx.query = schemas.query.parse(query);
      }

      // Validate path parameters
      if (schemas.params) {
        ctx.params = schemas.params.parse(ctx.params);
      }

      await _next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        ctx.res.writeHead(400, { 'Content-Type': 'application/json' });
        ctx.res.end(JSON.stringify({
          success: false,
          error: 'Validation failed',
          details: error.errors
        }));
        return;
      }
      throw error;
    }
  };
};
