import { IncomingMessage, ServerResponse } from "http";
import { PrismaClient } from "@prisma/client";

// Re-export router types for convenience
export { RouteContext, RouteHandler, Route, Middleware, Next } from "../router/context";
export type { AuthenticatedRequest } from "../router/context";

// Utility function to create a basic route context for testing
export function createMockContext(
  overrides: Partial<{
    req: Partial<IncomingMessage>;
    res: Partial<ServerResponse>;
    prisma: PrismaClient;
    url: string;
    params: Record<string, string>;
    requestId: string;
    csrfToken: string;
  }> = {}
) {
  const mockReq = Object.assign({
    method: 'GET',
    url: '/test',
    headers: {},
    ...overrides.req
  } as IncomingMessage, {});

  const mockRes = Object.assign({
    writeHead: () => {},
    write: () => {},
    end: () => {},
    setHeader: () => {},
    ...overrides.res
  } as Partial<ServerResponse>, {}) as ServerResponse;

  const mockPrisma = overrides.prisma || ({
    user: {
      findMany: () => Promise.resolve([]),
      findUnique: () => Promise.resolve(null),
      create: () => Promise.resolve({}),
      update: () => Promise.resolve({}),
      delete: () => Promise.resolve({}),
    },
    campaign: {
      findMany: () => Promise.resolve([]),
      findUnique: () => Promise.resolve(null),
      create: () => Promise.resolve({}),
      update: () => Promise.resolve({}),
      delete: () => Promise.resolve({}),
    }
  } as any);

  return {
    req: mockReq,
    res: mockRes,
    prisma: mockPrisma,
    url: new URL(overrides.url || 'http://localhost:3000/test'),
    params: overrides.params || {},
    requestId: overrides.requestId || 'test-request-id',
    csrfToken: overrides.csrfToken
  };
}

// Utility to parse route parameters from a path pattern
export function parseRouteParams(pattern: string, path: string): Record<string, string> {
  const params: Record<string, string> = {};
  const patternParts = pattern.split('/');
  const pathParts = path.split('/');

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const pathPart = pathParts[i];

    if (patternPart?.startsWith(':') && pathPart) {
      const paramName = patternPart.slice(1);
      params[paramName] = decodeURIComponent(pathPart);
    }
  }

  return params;
}
