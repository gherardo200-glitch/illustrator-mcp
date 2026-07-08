/**
 * Vectorize a raster image into editable vector paths using Illustrator's
 * built-in Image Trace (Ricalco immagine), then expand it to real paths.
 *
 * This is the core "client sends an AI image, redraw the paths" workflow,
 * automated: point at an image (or paste base64) → traced, expanded vector art.
 */

import { z } from "zod";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerIllustratorTool } from "../bridge.js";

export function registerVectorizeTools(server: McpServer): void {
  registerIllustratorTool(server, {
    name: "illustrator_vectorize_image",
    title: "Vectorize Image (Image Trace)",
    description:
      "Turn a raster image (PNG/JPG, e.g. AI-generated art a client sent) into editable VECTOR PATHS " +
      "using Illustrator's Image Trace, then expand it to real paths. This automates the 'redraw the " +
      "artwork from scratch' task.\n\n" +
      "Args:\n" +
      "  - path (string): absolute path to the image  (OR pass image_base64)\n" +
      "  - image_base64 (string): the image bytes as base64 (data: URIs accepted) — use when the file " +
      "isn't on disk (e.g. pasted in chat)\n" +
      "  - mode ('color'|'grayscale'|'blackwhite'): default 'color'\n" +
      "  - preset (string, optional): an Image Trace preset name to load, e.g. 'High Fidelity Photo', " +
      "'Low Fidelity Photo', '3 Colors', '6 Colors', '16 Colors', 'Shades of Gray', 'Black and White Logo', " +
      "'Sketched Art', 'Silhouettes', 'Line Art', 'Technical Drawing'. If given, it overrides the fine controls.\n" +
      "  - max_colors (number): color palette size for color mode (2-256)\n" +
      "  - threshold (number): 1-255, black/white cutoff for 'blackwhite' mode\n" +
      "  - path_fidelity, corner_fidelity, noise_fidelity (number 0-100): fine trace controls (best effort)\n" +
      "  - expand (boolean): expand the tracing into editable paths (default true)\n" +
      "  - new_document (boolean): trace into a fresh RGB document (default true)\n\n" +
      "Returns the number of resulting paths and the document name.\n\n" +
      "Best for logos, flat illustrations, line art, and few-color graphics. Photorealistic images will " +
      "produce many paths and usually need manual cleanup afterward.",
    inputSchema: {
      path: z.string().optional().describe("Absolute path to the image file."),
      image_base64: z
        .string()
        .optional()
        .describe("Image bytes as base64 (or a data: URI). Use when there's no file on disk."),
      mode: z
        .enum(["color", "grayscale", "blackwhite"])
        .default("color")
        .describe("Trace mode. Default 'color'."),
      preset: z.string().optional().describe("Image Trace preset name to load (overrides fine controls)."),
      max_colors: z.number().int().min(2).max(256).optional().describe("Palette size for color mode."),
      threshold: z.number().int().min(1).max(255).optional().describe("B/W cutoff for 'blackwhite' mode."),
      path_fidelity: z.number().min(0).max(100).optional().describe("Paths slider (best effort)."),
      corner_fidelity: z.number().min(0).max(100).optional().describe("Corners slider (best effort)."),
      noise_fidelity: z.number().min(0).max(100).optional().describe("Noise slider (best effort)."),
      expand: z.boolean().default(true).describe("Expand the tracing into editable paths."),
      new_document: z.boolean().default(true).describe("Trace into a fresh RGB document."),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    build: (a) => {
      let path: string | null = a.path ?? null;

      // Accept a pasted image: write the base64 to a temp file to trace it.
      if (!path && a.image_base64) {
        const b64 = String(a.image_base64).replace(/^data:[^;]+;base64,/, "");
        const tmp = join(tmpdir(), `vectorize-${randomUUID()}.png`);
        writeFileSync(tmp, Buffer.from(b64, "base64"));
        path = tmp;
      }
      if (!path) {
        throw new Error("Provide 'path' (absolute image path) or 'image_base64'.");
      }

      return {
        params: {
          path,
          mode: a.mode,
          preset: a.preset ?? null,
          maxColors: a.max_colors ?? null,
          threshold: a.threshold ?? null,
          pathFidelity: a.path_fidelity ?? null,
          cornerFidelity: a.corner_fidelity ?? null,
          noiseFidelity: a.noise_fidelity ?? null,
          expand: a.expand,
          newDocument: a.new_document,
        },
        body: `
          function __countPaths(item){
            var t = item.typename;
            if (t === 'PathItem' || t === 'CompoundPathItem') return 1;
            var c = 0;
            try {
              if (item.pageItems){
                for (var i = 0; i < item.pageItems.length; i++) c += __countPaths(item.pageItems[i]);
              }
            } catch (e) {}
            return c;
          }

          var f = new File(P.path);
          if (!f.exists) throw new Error("Image not found: " + P.path);

          var doc;
          if (P.newDocument || app.documents.length === 0) {
            doc = app.documents.add(DocumentColorSpace.RGB);
          } else {
            doc = app.activeDocument;
          }

          var placed = doc.placedItems.add();
          placed.file = f;

          // Start Image Trace.
          var art = placed.trace();
          var tracing = art.tracing;
          var opt = tracing.tracingOptions;

          try {
            if (P.mode === 'blackwhite') opt.tracingMode = TracingModeType.TRACINGMODEBLACKANDWHITE;
            else if (P.mode === 'grayscale') opt.tracingMode = TracingModeType.TRACINGMODEGRAY;
            else opt.tracingMode = TracingModeType.TRACINGMODECOLOR;
          } catch (e) {}

          if (P.preset) { try { opt.loadFromPreset(P.preset); } catch (e) {} }

          if (P.maxColors !== null)      { try { opt.maxColors = P.maxColors; } catch (e) {} }
          if (P.threshold !== null)      { try { opt.threshold = P.threshold; } catch (e) {} }
          if (P.pathFidelity !== null)   { try { opt.pathFidelity = P.pathFidelity; } catch (e) {} }
          if (P.cornerFidelity !== null) { try { opt.cornerFidelity = P.cornerFidelity; } catch (e) {} }
          if (P.noiseFidelity !== null)  { try { opt.noiseFidelity = P.noiseFidelity; } catch (e) {} }

          var out = { traced: true, mode: P.mode, preset: (P.preset || null), document: doc.name };

          if (P.expand !== false) {
            var group = tracing.expandTracing();
            out.expanded = true;
            out.paths = __countPaths(group);
            out.width = group.width;
            out.height = group.height;
            try { doc.artboards[0].artboardRect = group.visibleBounds; } catch (e) {}
          } else {
            out.expanded = false;
            out.note = "Tracing created but not expanded (still editable in Image Trace panel).";
          }
          return out;
        `,
      };
    },
  });
}
