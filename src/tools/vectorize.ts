/**
 * Vectorize a raster image into editable vector paths.
 *
 * Two engines, selectable per call:
 *   - 'vtracer'      (default) → the open-source VTracer CLI produces a clean
 *                     SVG, which we open in Illustrator as editable paths.
 *                     Free, local, usually cleaner than Image Trace. Requires
 *                     the `vtracer` binary on PATH (or VTRACER_PATH).
 *   - 'image_trace'  → Illustrator's built-in Image Trace (no install needed),
 *                     kept as a zero-config fallback.
 *
 * This is the core "client sends an AI/raster image, produce correct vector
 * paths" workflow. Accepts a file `path` or a pasted `image_base64`.
 */

import { z } from "zod";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runJsx, textResult, errorResult } from "../bridge.js";

const execFileP = promisify(execFile);

/** ExtendScript: open a generated SVG as an editable Illustrator document. */
export const VTRACER_IMPORT_BODY = `
  var f = new File(P.svgPath);
  if (!f.exists) throw new Error("Generated SVG not found: " + P.svgPath);
  var doc = app.open(f);
  var compound = 0;
  try { compound = doc.compoundPathItems.length; } catch (e) {}
  return { document: doc.name, paths: doc.pathItems.length, compoundPaths: compound };
`;

/** ExtendScript: Illustrator's built-in Image Trace (fallback engine). */
export const IMAGE_TRACE_BODY = `
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
  if (P.newDocument || app.documents.length === 0) doc = app.documents.add(DocumentColorSpace.RGB);
  else doc = app.activeDocument;

  var placed = doc.placedItems.add();
  placed.file = f;

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
    try { doc.artboards[0].artboardRect = group.visibleBounds; } catch (e) {}
  } else {
    out.expanded = false;
    out.note = "Tracing created but not expanded (still editable in Image Trace panel).";
  }
  return out;
`;

/** Resolve the input image to a file path (writing base64 to a temp file). */
function resolveInput(a: any): string {
  if (a.path) return String(a.path);
  if (a.image_base64) {
    const b64 = String(a.image_base64).replace(/^data:[^;]+;base64,/, "");
    const tmp = join(tmpdir(), `vectorize-in-${randomUUID()}.png`);
    writeFileSync(tmp, Buffer.from(b64, "base64"));
    return tmp;
  }
  throw new Error("Provide 'path' (absolute image path) or 'image_base64'.");
}

export function registerVectorizeTools(server: McpServer): void {
  server.registerTool(
    "illustrator_vectorize_image",
    {
      title: "Vectorize Image → Editable Paths",
      description:
        "Turn a raster image (PNG/JPG, e.g. AI-generated art a client sent) into editable VECTOR PATHS in " +
        "Illustrator. This automates the 'redraw the artwork from scratch' task.\n\n" +
        "Engines:\n" +
        "  - 'vtracer' (default): open-source VTracer produces a clean SVG that is opened as editable paths. " +
        "Usually cleaner than Image Trace; free and local. Needs the `vtracer` binary installed (see README).\n" +
        "  - 'image_trace': Illustrator's built-in Image Trace (no install), kept as a fallback.\n\n" +
        "Input: `path` (absolute) OR `image_base64` (bytes / data: URI, for images pasted in chat).\n\n" +
        "VTracer args: mode ('color'|'blackwhite'), curve_mode ('spline'|'polygon'|'pixel'), " +
        "filter_speckle (remove specks, higher = cleaner), color_precision (2-8), corner_threshold (deg).\n" +
        "Image Trace args: mode, preset, max_colors, threshold, path_fidelity, corner_fidelity, noise_fidelity, expand.\n\n" +
        "Best on logos, flat art, line art, and few-color graphics. Photorealistic images produce many paths and " +
        "usually need manual cleanup.",
      inputSchema: {
        engine: z
          .enum(["vtracer", "image_trace"])
          .default("vtracer")
          .describe("Vectorization engine. Default 'vtracer' (free, local, cleaner)."),
        path: z.string().optional().describe("Absolute path to the image file."),
        image_base64: z
          .string()
          .optional()
          .describe("Image bytes as base64 (or data: URI). Use when there's no file on disk."),
        mode: z
          .enum(["color", "grayscale", "blackwhite"])
          .default("color")
          .describe("Color mode. (grayscale applies to Image Trace only)."),
        // VTracer options
        curve_mode: z
          .enum(["spline", "polygon", "pixel"])
          .default("spline")
          .describe("VTracer curve fitting. 'spline' = smooth curves (default)."),
        filter_speckle: z
          .number()
          .int()
          .min(0)
          .max(128)
          .optional()
          .describe("VTracer: discard patches smaller than N px (higher = cleaner). Default 4."),
        color_precision: z
          .number()
          .int()
          .min(1)
          .max(8)
          .optional()
          .describe("VTracer: color detail in bits (2-8). Lower = fewer colors."),
        corner_threshold: z
          .number()
          .int()
          .min(0)
          .max(180)
          .optional()
          .describe("VTracer: corner angle threshold in degrees. Default 60."),
        // Image Trace options
        preset: z.string().optional().describe("Image Trace preset name (image_trace engine)."),
        max_colors: z.number().int().min(2).max(256).optional().describe("Image Trace: palette size."),
        threshold: z.number().int().min(1).max(255).optional().describe("Image Trace: B/W cutoff."),
        path_fidelity: z.number().min(0).max(100).optional().describe("Image Trace: Paths slider."),
        corner_fidelity: z.number().min(0).max(100).optional().describe("Image Trace: Corners slider."),
        noise_fidelity: z.number().min(0).max(100).optional().describe("Image Trace: Noise slider."),
        expand: z.boolean().default(true).describe("Image Trace: expand into editable paths."),
        new_document: z.boolean().default(true).describe("Image Trace: trace into a fresh RGB document."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (a: any): Promise<any> => {
      try {
        let inputPath: string;
        try {
          inputPath = resolveInput(a);
        } catch (e: any) {
          return errorResult(e.message);
        }
        if (!existsSync(inputPath)) return errorResult(`Image not found: ${inputPath}`);

        const engine = a.engine ?? "vtracer";

        if (engine === "vtracer") {
          const svgPath = join(tmpdir(), `vectorized-${randomUUID()}.svg`);
          const bin = process.env.VTRACER_PATH || "vtracer";
          const args = ["--input", inputPath, "--output", svgPath];
          args.push("--colormode", a.mode === "blackwhite" ? "bw" : "color");
          args.push("--mode", a.curve_mode ?? "spline");
          if (a.filter_speckle != null) args.push("--filter_speckle", String(a.filter_speckle));
          if (a.color_precision != null) args.push("--color_precision", String(a.color_precision));
          if (a.corner_threshold != null) args.push("--corner_threshold", String(a.corner_threshold));

          try {
            await execFileP(bin, args, { timeout: 120_000, maxBuffer: 16 * 1024 * 1024 });
          } catch (err: any) {
            if (err?.code === "ENOENT") {
              return errorResult(
                "VTracer is not installed. Install it (`cargo install vtracer`, or download a binary from " +
                  "https://github.com/visioncortex/vtracer/releases) and put it on PATH, or set VTRACER_PATH. " +
                  "Alternatively call this tool again with engine='image_trace' (uses Illustrator's built-in tracer)."
              );
            }
            return errorResult(`VTracer failed: ${(err?.stderr || err?.message || String(err)).slice(0, 600)}`);
          }

          const data = await runJsx(VTRACER_IMPORT_BODY, { svgPath });
          return textResult({ engine: "vtracer", source: inputPath, svg: svgPath, ...data });
        }

        // Image Trace fallback
        const data = await runJsx(IMAGE_TRACE_BODY, {
          path: inputPath,
          mode: a.mode ?? "color",
          preset: a.preset ?? null,
          maxColors: a.max_colors ?? null,
          threshold: a.threshold ?? null,
          pathFidelity: a.path_fidelity ?? null,
          cornerFidelity: a.corner_fidelity ?? null,
          noiseFidelity: a.noise_fidelity ?? null,
          expand: a.expand ?? true,
          newDocument: a.new_document ?? true,
        });
        return textResult({ engine: "image_trace", source: inputPath, ...data });
      } catch (err: any) {
        return errorResult(err?.message ? String(err.message) : String(err));
      }
    }
  );
}
