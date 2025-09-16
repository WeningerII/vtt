import type { IncomingMessage, ServerResponse } from "node:http";
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

export async function parseJsonBody<T = any>(
  req: IncomingMessage | any,
  opts?: { limitBytes?: number },
): Promise<T> {
  const envLimit = Number(process.env.JSON_LIMIT_BYTES ?? "");
  const defaultLimit = Number.isFinite(envLimit) && envLimit > 0 ? envLimit : 1_000_000; // 1MB default
  const limit = opts?.limitBytes ?? defaultLimit;
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;

    req.on("data", (chunk: any) => {
      const chunkStr = chunk.toString();
      size += Buffer.byteLength(chunkStr);
      if (size > limit) {
        return reject(new HttpError(413, "Payload too large"));
      }
      body += chunkStr;
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

// Minimal response interface compatible with Node's ServerResponse and Express Response
type ResLike = Pick<ServerResponse, "writeHead" | "end"> & { headersSent?: boolean };

export function sendJson(res: ResLike, data: unknown, status = 200): void {
  if (!(res as any).headersSent) {
    (res as any).writeHead(status, { "Content-Type": "application/json" });
    (res as any).end(JSON.stringify(data));
  }
}
