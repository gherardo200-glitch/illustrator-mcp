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

  const app = express();
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
