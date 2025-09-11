/**
 * Browser Logger - Simple logging shim for client-side applications
 * Provides structured logging with context support
 */

/* eslint-disable no-console */
export type LogMethod = (message: string, ...args: unknown[]) => void;

export type BrowserLogger = {
  trace: LogMethod;
  debug: LogMethod;
  info: LogMethod;
  warn: LogMethod;
  error: LogMethod;
  fatal: LogMethod;
  withContext: (ctx: Record<string, any>) => Omit<BrowserLogger, "withContext">;
};

const formatCtx = (ctx: Record<string, any>) =>
  `[ctx:${Object.entries(ctx)
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(" ")}]`;

export const logger: BrowserLogger = {
  trace: (...args) => console.debug(...args),
  debug: (...args) => console.debug(...args),
  info: (...args) => console.info(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
  fatal: (...args) => console.error(...args),
  withContext(ctx) {
    const prefix = formatCtx(ctx);
    return {
      trace: (...args) => console.debug(prefix, ...args),
      debug: (...args) => console.debug(prefix, ...args),
      info: (...args) => console.info(prefix, ...args),
      warn: (...args) => console.warn(prefix, ...args),
      error: (...args) => console.error(prefix, ...args),
      fatal: (...args) => console.error(prefix, ...args),
    };
  },
};

// No-op implementations for server-only APIs
export function createLogger(): BrowserLogger {
  return logger;
}

export function initTelemetry(): void {
  // no-op in browser
}

export async function withTrace<T>(
  _name: string,
  fn: () => Promise<T>,
  _attributes?: Record<string, any>,
): Promise<T> {
  return fn();
}
