/**
 * Builds a fully-configured Illustrator MCP server (all tools registered).
 * Shared by both transports: stdio (Claude) and Streamable HTTP (ChatGPT).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { SERVER_NAME, SERVER_VERSION } from "./constants.js";
import { registerAppTools } from "./tools/app.js";
import { registerDocumentTools } from "./tools/documents.js";
import { registerInspectTools } from "./tools/inspect.js";
import { registerShapeTools } from "./tools/shapes.js";
import { registerTransformTools } from "./tools/transform.js";
import { registerLayerTools } from "./tools/layers.js";
import { registerSelectionTools } from "./tools/selection.js";
import { registerScriptTool } from "./tools/script.js";

export function buildServer(): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  registerAppTools(server);
  registerDocumentTools(server);
  registerInspectTools(server);
  registerShapeTools(server);
  registerTransformTools(server);
  registerLayerTools(server);
  registerSelectionTools(server);
  registerScriptTool(server);

  return server;
}
