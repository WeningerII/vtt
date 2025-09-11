import type { IncomingMessage } from "node:http";
import { Buffer } from "node:buffer";

/**
 * Represents an HTTP error.
 */
export class HttpError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function parseJsonBody<T = any>(
  req: IncomingMessage,
  opts?: { limitBytes?: number },
): Promise<T> {
  const envLimit = Number(process.env.JSON_LIMIT_BYTES ?? "");
  const defaultLimit = Number.isFinite(envLimit) && envLimit > 0 ? envLimit : 1_000_000; // 1MB default
  const limit = opts?.limitBytes ?? defaultLimit;
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;

    req.on("data", (chunk: Buffer | string) => {
      const len = typeof chunk === "string" ? Buffer.byteLength(chunk) : chunk.length;
      size += len;
      if (size > limit) {
        // terminate early to avoid memory pressure
        try {
          req.destroy();
        } catch {}
        return reject(new HttpError(413, "Payload too large"));
      }
      body += chunk as any;
    });

    req.on("end", () => {
      if (!body) {return resolve({} as T);}
      try {
        const data = JSON.parse(body);
        resolve(data);
      } catch (_error) {
        reject(new HttpError(400, "Invalid JSON in request body"));
      }
    });

    req.on("error", (err) => reject(err));
  });
}

export function sendJson(res: any, data: any, status = 200): void {
  if (!res.headersSent) {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  }
}
