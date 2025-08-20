import "./env";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const PORT = Number(process.env.PORT ?? 8080);
// Minimal HTTP API
const server = createServer(async (req, res) => {
    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
        res.writeHead(204);
        return res.end();
    }
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    try {
        if (req.method === "GET" && url.pathname === "/health") {
            await prisma.$queryRaw `SELECT 1`;
            res.writeHead(200, { "content-type": "application/json" });
            return res.end(JSON.stringify({ ok: true, ws: `ws://localhost:${PORT}` }));
        }
        if (req.method === "GET" && url.pathname === "/users") {
            const users = await prisma.user.findMany({ take: 50, orderBy: { createdAt: "desc" } });
            res.writeHead(200, { "content-type": "application/json" });
            return res.end(JSON.stringify(users));
        }
        if (req.method === "POST" && url.pathname === "/users") {
            let body = "";
            req.on("data", c => body += c);
            req.on("end", async () => {
                const data = body ? JSON.parse(body) : {};
                const u = await prisma.user.create({ data: { displayName: data.displayName ?? "New User" } });
                res.writeHead(201, { "content-type": "application/json" });
                res.end(JSON.stringify(u));
            });
            return;
        }
        res.writeHead(404);
        res.end("not found");
    }
    catch (e) {
        console.error("[http] error", e);
        res.writeHead(500);
        res.end("server error");
    }
});
// WebSocket attached to same HTTP server
const wss = new WebSocketServer({ server });
wss.on("connection", (ws, req) => {
    const id = Math.random().toString(36).slice(2, 8);
    console.log(`[server] client connected ${id} from ${req.socket.remoteAddress}`);
    ws.send(JSON.stringify({ type: "HELLO", tickRate: 12, snapshotVersion: 0 }));
    ws.on("message", (data) => {
        const msg = typeof data === "string" ? data : data.toString("utf-8");
        ws.send(JSON.stringify({ type: "ECHO", payload: msg }));
    });
    ws.on("close", () => console.log(`[server] client ${id} disconnected`));
    ws.on("error", (err) => console.error(`[server] client ${id} error`, err));
});
server.listen(PORT, () => console.log(`[server] HTTP+WS listening on http://localhost:${PORT}`));
//# sourceMappingURL=index.js.map