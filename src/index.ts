#!/usr/bin/env node
/**
 * Illustrator MCP Server — entry point.
 *
 * Two transports, one codebase:
 *   - stdio (default)  → Claude Desktop, Claude Code, Cursor, and any local
 *                        stdio MCP client. Run: `node dist/index.js`
 *   - Streamable HTTP  → ChatGPT (via OpenAI's Secure MCP Tunnel) or any remote
 *                        MCP client. Run: `node dist/index.js --http`
 *                        (listens on http://127.0.0.1:3000/mcp by default)
 *
 * Select HTTP mode with the `--http` flag or `MCP_TRANSPORT=http`.
 * Override the address with `PORT` and `HOST` (defaults: 3000 / 127.0.0.1).
 * HTTP mode rejects requests with a Host/Origin header outside the local
 * allowlist (DNS-rebinding protection) and, if `MCP_HTTP_TOKEN` is set,
 * requests missing a matching `X-MCP-Token` header.
 */

import { randomUUID } from "node:crypto";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { SERVER_NAME, SERVER_VERSION } from "./constants.js";
import { buildServer } from "./server.js";

const useHttp =
  process.argv.includes("--http") || process.env.MCP_TRANSPORT === "http";

async function runStdio(): Promise<void> {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Never log to stdout in stdio mode: it is the JSON-RPC channel.
  process.stderr.write(`${SERVER_NAME} v${SERVER_VERSION} running (stdio)\n`);
}

async function runHttp(): Promise<void> {
  const { default: express } = await import("express");

  const PORT = Number(process.env.PORT ?? 3000);
  const HOST = process.env.HOST ?? "127.0.0.1";
  const MCP_PATH = "/mcp";

  // DNS-rebinding protection: only requests whose Host/Origin header names
  // this server's own bind address are accepted. An attacker-controlled
  // domain that briefly resolves to 127.0.0.1 still makes the victim's
  // browser send the *original* hostname in these headers, not "127.0.0.1"
  // or "localhost", so it never matches and the request is rejected.
  const allowedHosts = Array.from(
    new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`, `[::1]:${PORT}`, `${HOST}:${PORT}`])
  );
  const allowedOrigins = Array.from(
    new Set([
      `http://127.0.0.1:${PORT}`,
      `http://localhost:${PORT}`,
      `http://[::1]:${PORT}`,
      `http://${HOST}:${PORT}`,
    ])
  );

  // Optional shared-secret auth: off by default (same behaviour as before
  // this fix). Set MCP_HTTP_TOKEN to require every request to carry a
  // matching `X-MCP-Token` header; requests without one get 401. Useful if
  // you ever need HOST to be more than 127.0.0.1 (LAN, container, etc.).
  const authToken = process.env.MCP_HTTP_TOKEN;

  const app = express();

  // Header checks run before JSON body parsing and before the MCP transport,
  // so a rejected request never reaches tool-dispatch logic. This mirrors
  // the allowedHosts/allowedOrigins/enableDnsRebindingProtection options
  // passed to StreamableHTTPServerTransport below (belt and suspenders: the
  // SDK marks those transport-level options as deprecated in favour of
  // "external middleware", which is exactly what this is) and additionally
  // covers the GET/DELETE session routes.
  app.use(MCP_PATH, (req, res, next) => {
    const hostHeader = req.headers.host;
    if (!hostHeader || !allowedHosts.includes(hostHeader)) {
      res.status(403).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: `Forbidden: invalid Host header '${hostHeader ?? ""}'` },
        id: null,
      });
      return;
    }
    const originHeader = req.headers.origin;
    if (originHeader && !allowedOrigins.includes(originHeader)) {
      res.status(403).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: `Forbidden: invalid Origin header '${originHeader}'` },
        id: null,
      });
      return;
    }
    if (authToken && req.headers["x-mcp-token"] !== authToken) {
      res.status(401).json({
        jsonrpc: "2.0",
        error: { code: -32001, message: "Unauthorized: missing or invalid X-MCP-Token header" },
        id: null,
      });
      return;
    }
    next();
  });

  app.use(express.json({ limit: "8mb" }));

  // Simple liveness probe (handy behind a tunnel).
  app.get("/healthz", (_req, res) => {
    res.json({ ok: true, server: SERVER_NAME, version: SERVER_VERSION });
  });

  // Stateful Streamable HTTP: one transport per MCP session, keyed by session id.
  const transports: Record<string, StreamableHTTPServerTransport> = {};

  app.post(MCP_PATH, async (req, res) => {
    try {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      let transport = sessionId ? transports[sessionId] : undefined;

      if (!transport) {
        const isInitialize = req.body?.method === "initialize";
        if (sessionId || !isInitialize) {
          res.status(400).json({
            jsonrpc: "2.0",
            error: { code: -32000, message: "No valid session. Send an 'initialize' request first." },
            id: null,
          });
          return;
        }
        // New session: create a transport + server pair.
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          enableJsonResponse: true,
          enableDnsRebindingProtection: true,
          allowedHosts,
          allowedOrigins,
          onsessioninitialized: (sid) => {
            transports[sid] = transport as StreamableHTTPServerTransport;
          },
        });
        transport.onclose = () => {
          if (transport && transport.sessionId) delete transports[transport.sessionId];
        };
        const server = buildServer();
        await server.connect(transport);
      }

      await transport.handleRequest(req, res, req.body);
    } catch {
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  // GET (open notification stream) and DELETE (end session) reuse the transport.
  const bySession = async (req: any, res: any) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    const transport = sessionId ? transports[sessionId] : undefined;
    if (!transport) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Missing or invalid Mcp-Session-Id." },
        id: null,
      });
      return;
    }
    await transport.handleRequest(req, res);
  };
  app.get(MCP_PATH, bySession);
  app.delete(MCP_PATH, bySession);

  app.listen(PORT, HOST, () => {
    process.stderr.write(
      `${SERVER_NAME} v${SERVER_VERSION} running (http) at http://${HOST}:${PORT}${MCP_PATH}\n`
    );
  });
}

(useHttp ? runHttp() : runStdio()).catch((err) => {
  process.stderr.write(`Fatal: ${err?.stack || err}\n`);
  process.exit(1);
});
