#!/usr/bin/env node
/**
 * Illustrator MCP Server — entry point.
 *
 * Exposes tools that let an MCP client (Claude Desktop, Claude Code, Cursor,
 * ChatGPT, ...) control Adobe Illustrator through natural language.
 *
 * Transport: stdio (the server runs locally, next to Illustrator).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { SERVER_NAME, SERVER_VERSION } from "./constants.js";
import { registerAppTools } from "./tools/app.js";
import { registerDocumentTools } from "./tools/documents.js";
import { registerInspectTools } from "./tools/inspect.js";
import { registerShapeTools } from "./tools/shapes.js";
import { registerTransformTools } from "./tools/transform.js";
import { registerLayerTools } from "./tools/layers.js";
import { registerSelectionTools } from "./tools/selection.js";
import { registerScriptTool } from "./tools/script.js";

async function main(): Promise<void> {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  registerAppTools(server);
  registerDocumentTools(server);
  registerInspectTools(server);
  registerShapeTools(server);
  registerTransformTools(server);
  registerLayerTools(server);
  registerSelectionTools(server);
  registerScriptTool(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Never log to stdout: it is the JSON-RPC channel. Use stderr for diagnostics.
  process.stderr.write(`${SERVER_NAME} v${SERVER_VERSION} running (stdio)\n`);
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err?.stack || err}\n`);
  process.exit(1);
});
