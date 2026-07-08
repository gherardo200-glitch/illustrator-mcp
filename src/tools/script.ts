/**
 * The power tool: run arbitrary ExtendScript inside Illustrator.
 *
 * This is the escape hatch that lets an agent do ANYTHING the Illustrator
 * scripting API supports, beyond the curated tools. The provided code runs
 * inside a function; `return <value>` to send structured data back.
 *
 * Helper functions from the prelude are available, including:
 *   __doc(), __color(hex), __setPos(item, x, y), __itemInfo(item),
 *   __abRect(), __activeAB(doc), __style(item, {fill, stroke, strokeWidth}).
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerIllustratorTool } from "../bridge.js";

export function registerScriptTool(server: McpServer): void {
  registerIllustratorTool(server, {
    name: "illustrator_run_script",
    title: "Run ExtendScript",
    description:
      "Execute arbitrary ExtendScript (Illustrator's JavaScript) in the active Illustrator instance. " +
      "Use this for anything the specialized tools do not cover — advanced paths, effects, batch edits, " +
      "reading detailed properties, etc.\n\n" +
      "The code runs inside a function body: use `return <value>` to send JSON-serializable data back. " +
      "The global `app` and the active document are available, plus helpers: __doc(), __color(hex), " +
      "__setPos(item, x, y), __itemInfo(item), __abRect(), __activeAB(doc), __style(item, opts).\n\n" +
      "Coordinates in Illustrator's native API are Y-up and global; the helpers convert to artboard-relative Y-down.\n\n" +
      "Example code: `var d = __doc(); var r = d.pathItems.rectangle(0, 0, 100, 100); return __itemInfo(r);`\n\n" +
      "NOTE: This can modify or delete artwork and interact with the file system. Prefer the specialized tools when they fit.",
    inputSchema: {
      code: z
        .string()
        .min(1)
        .describe("ExtendScript source to run. Use `return <value>;` to return JSON-serializable data."),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    // The code IS the body (not embedded data), so it can `return` directly.
    build: (a) => ({ body: String(a.code) }),
  });
}
