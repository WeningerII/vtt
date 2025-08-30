import { Context, Route, RouteHandler, Middleware } from "./types";

export class Router {
  private routes: Route[] = [];
  private middlewares: Middleware[] = [];

  use(middleware: Middleware): void {
    this.middlewares.push(middleware);
  }

  get(path: string, handler: RouteHandler): void {
    this.routes.push({ method: "GET", path, handler });
  }

  post(path: string, handler: RouteHandler): void {
    this.routes.push({ method: "POST", path, handler });
  }

  put(path: string, handler: RouteHandler): void {
    this.routes.push({ method: "PUT", path, handler });
  }

  delete(path: string, handler: RouteHandler): void {
    this.routes.push({ method: "DELETE", path, handler });
  }

  options(path: string, handler: RouteHandler): void {
    this.routes.push({ method: "OPTIONS", path, handler });
  }

  async handle(ctx: Context): Promise<boolean> {
    for (const r of this.routes) {
      if (r.method !== ctx.req.method) continue;
      const params = this.matchPath(r.path, ctx.url.pathname);
      if (params) {
        // attach params for handlers/middleware
        (ctx as any).params = params;
        await this.executeMiddlewares(ctx, async () => {
          await r.handler(ctx);
        });
        return true;
      }
    }
    return false;
  }

  private matchPath(routePath: string, requestPath: string): Record<string, string> | null {
    // Normalize paths to ignore trailing slashes (except root)
    const rp = this.normalizePath(routePath);
    const qp = this.normalizePath(requestPath);
    // Quick exact match
    if (rp === qp) return {};

    const routeSegs = rp.split("/").filter(Boolean);
    const reqSegs = qp.split("/").filter(Boolean);

    const params: Record<string, string> = {};

    // Support multi-segment wildcard only at the end using '**'
    const hasMultiWildcardAtEnd = routeSegs[routeSegs.length - 1] === "**";
    if (!hasMultiWildcardAtEnd && routeSegs.length !== reqSegs.length) return null;

    let i = 0; // route index
    let j = 0; // req index
    while (i < routeSegs.length && j < reqSegs.length) {
      const rs = routeSegs[i]!;
      const qs = reqSegs[j]!;

      if (rs === "**") {
        // '**' at end matches the rest of the path segments
        if (i === routeSegs.length - 1) {
          // nothing to capture for now; consume the rest
          j = reqSegs.length;
          i++;
          break;
        }
        // If '**' is used not at the end, we don't support it (return null)
        return null;
      }

      // Single-segment wildcard support: '*' matches any single path segment
      if (rs === "*") {
        i++;
        j++;
        continue;
      }

      if (rs.startsWith(":")) {
        params[rs.slice(1)] = decodeURIComponent(qs);
        i++;
        j++;
        continue;
      }

      if (rs !== qs) {
        return null;
      }
      i++;
      j++;
    }

    // If route ends with '**', it's okay for req to have extra segments (already consumed)
    if (i === routeSegs.length && j === reqSegs.length) return params;
    return null;
  }

  private normalizePath(p: string): string {
    if (!p) return "/";
    try {
      // Remove query/hash if present (defensive) and trailing slash except root
      const [pathOnly] = p.split(/[?#]/, 1);
      if (pathOnly.length > 1 && pathOnly.endsWith("/")) return pathOnly.slice(0, -1);
      return pathOnly || "/";
    } catch {
      return p;
    }
  }

  private async executeMiddlewares(ctx: Context, final: () => Promise<void>): Promise<void> {
    let index = 0;

    const next = async (): Promise<void> => {
      if (index >= this.middlewares.length) {
        await final();
        return;
      }
      const middleware = this.middlewares[index++];
      if (middleware) {
        await middleware(ctx, next);
      }
    };

    await next();
  }
}
