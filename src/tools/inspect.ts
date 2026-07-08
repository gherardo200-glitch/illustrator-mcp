/** Read-only inspection tools: document info, selection, layers, artboards. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerIllustratorTool } from "../bridge.js";

export function registerInspectTools(server: McpServer): void {
  registerIllustratorTool(server, {
    name: "illustrator_get_document_info",
    title: "Get Document Info",
    description:
      "Get an overview of the active document: name, color mode, size, artboards, layers, item and selection counts. " +
      "Use this to understand the current state before making changes.",
    inputSchema: {},
    annotations: { readOnlyHint: true, idempotentHint: true },
    build: () => ({
      body: `
        var d = __doc();
        var abs = [];
        for (var i = 0; i < d.artboards.length; i++){
          var a = d.artboards[i], r = a.artboardRect;
          abs.push({ index: i, name: a.name, width: (r[2] - r[0]), height: (r[1] - r[3]) });
        }
        var lys = [];
        for (var j = 0; j < d.layers.length; j++){
          var L = d.layers[j];
          lys.push({ name: L.name, visible: L.visible, locked: L.locked, items: L.pageItems.length });
        }
        return {
          name: d.name,
          colorMode: (d.documentColorSpace === DocumentColorSpace.CMYK ? 'CMYK' : 'RGB'),
          widthPt: d.width, heightPt: d.height,
          artboards: abs, layers: lys,
          totalItems: d.pageItems.length,
          selectionCount: d.selection.length
        };
      `,
    }),
  });

  registerIllustratorTool(server, {
    name: "illustrator_get_selection",
    title: "Get Selection",
    description:
      "List the currently selected objects with their type, name, position and size (artboard-relative, Y down).",
    inputSchema: {},
    annotations: { readOnlyHint: true, idempotentHint: true },
    build: () => ({
      body: `
        var d = __doc();
        var sel = d.selection;
        var arr = [];
        for (var i = 0; i < sel.length; i++) arr.push(__itemInfo(sel[i]));
        return { count: sel.length, items: arr };
      `,
    }),
  });

  registerIllustratorTool(server, {
    name: "illustrator_list_layers",
    title: "List Layers",
    description: "List all layers in the active document with visibility, lock state and item counts.",
    inputSchema: {},
    annotations: { readOnlyHint: true, idempotentHint: true },
    build: () => ({
      body: `
        var d = __doc();
        var arr = [];
        for (var i = 0; i < d.layers.length; i++){
          var L = d.layers[i];
          arr.push({ index: i, name: L.name, visible: L.visible, locked: L.locked, items: L.pageItems.length, active: (L === d.activeLayer) });
        }
        return { count: d.layers.length, layers: arr };
      `,
    }),
  });

  registerIllustratorTool(server, {
    name: "illustrator_list_artboards",
    title: "List Artboards",
    description: "List all artboards in the active document with their index, name and size in points.",
    inputSchema: {},
    annotations: { readOnlyHint: true, idempotentHint: true },
    build: () => ({
      body: `
        var d = __doc();
        var arr = [];
        for (var i = 0; i < d.artboards.length; i++){
          var a = d.artboards[i], r = a.artboardRect;
          arr.push({ index: i, name: a.name, width: (r[2] - r[0]), height: (r[1] - r[3]), active: (i === d.artboards.getActiveArtboardIndex()) });
        }
        return { count: d.artboards.length, artboards: arr };
      `,
    }),
  });
}
