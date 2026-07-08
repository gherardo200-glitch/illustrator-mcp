/** Layer management tools. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerIllustratorTool } from "../bridge.js";

export function registerLayerTools(server: McpServer): void {
  registerIllustratorTool(server, {
    name: "illustrator_create_layer",
    title: "Create Layer",
    description:
      "Create a new layer in the active document and make it active. New artwork is created on the active layer.\n\nArgs:\n  - name (string).",
    inputSchema: {
      name: z.string().min(1).describe("Name for the new layer."),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    build: (a) => ({
      params: { name: a.name },
      body: `
        var d = __doc();
        var L = d.layers.add();
        L.name = P.name;
        d.activeLayer = L;
        return { created: true, name: L.name, index: 0 };
      `,
    }),
  });

  registerIllustratorTool(server, {
    name: "illustrator_set_active_layer",
    title: "Set Active Layer",
    description:
      "Make an existing layer the active one (subsequent new artwork goes here).\n\nArgs:\n  - name (string): the layer name.",
    inputSchema: {
      name: z.string().min(1).describe("Name of the layer to activate."),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    build: (a) => ({
      params: { name: a.name },
      body: `
        var d = __doc();
        var found = null;
        for (var i = 0; i < d.layers.length; i++){ if (d.layers[i].name === P.name){ found = d.layers[i]; break; } }
        if (!found) throw new Error("No layer named '" + P.name + "'. Use illustrator_list_layers to see available layers.");
        d.activeLayer = found;
        return { active: found.name };
      `,
    }),
  });
}
