import http from "http";
import { logger } from "@vtt/logging";
import fs from "fs";
import path from "path";
import url from "url";

const base = path.resolve("apps/client/spike");
const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

const server = http.createServer((req, res) => {
  try {
    const parsed = url.parse(req.url || "/");
    let p = decodeURIComponent(parsed.pathname || "/");
    if (p === "/") {p = "/index.html";}
    const file = path.join(base, p);
    if (!file.startsWith(base)) {
      res.writeHead(403);
      return res.end("forbidden");
    }
    if (!fs.existsSync(file)) {
      res.writeHead(404);
      return res.end("not found");
    }
    const ext = path.extname(file);
    res.writeHead(200, { "content-type": mime[ext] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  } catch (_e) {
    res.writeHead(500);
    res.end("error");
  }
});

const PORT = 8081;
server.listen(PORT, () => {
  logger.info(`[spike] serving ${base} at http://localhost:${PORT}`);
  logger.info(`[spike] open that URL and watch the console for PICK logs.`);
});
