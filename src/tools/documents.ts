/** Document lifecycle tools: create, open, list, save, close, export. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerIllustratorTool } from "../bridge.js";
import { toPoints, type Unit } from "../units.js";

const unitEnum = z
  .enum(["pt", "px", "mm", "cm", "in"])
  .default("px")
  .describe("Unit for width/height (pt, px, mm, cm, in). Default: px (1px = 1pt).");

export function registerDocumentTools(server: McpServer): void {
  registerIllustratorTool(server, {
    name: "illustrator_create_document",
    title: "Create Document",
    description:
      "Create a new Illustrator document. Launches Illustrator if it is not already running.\n\n" +
      "Args:\n" +
      "  - width, height (number): canvas size in the chosen unit\n" +
      "  - unit ('pt'|'px'|'mm'|'cm'|'in'): default 'px'\n" +
      "  - color_mode ('RGB'|'CMYK'): 'RGB' for screen, 'CMYK' for print (default 'RGB')\n" +
      "  - artboards (number): number of artboards (default 1)\n\n" +
      "Returns the new document's name, size in points, and color mode.",
    inputSchema: {
      width: z.number().positive().describe("Canvas width in the chosen unit."),
      height: z.number().positive().describe("Canvas height in the chosen unit."),
      unit: unitEnum,
      color_mode: z
        .enum(["RGB", "CMYK"])
        .default("RGB")
        .describe("'RGB' for screen/web, 'CMYK' for print. Default 'RGB'."),
      artboards: z.number().int().min(1).max(100).default(1).describe("Number of artboards."),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    build: (a) => ({
      params: {
        width: toPoints(a.width, a.unit as Unit),
        height: toPoints(a.height, a.unit as Unit),
        colorMode: a.color_mode,
        artboards: a.artboards,
      },
      body: `
        var cs = (P.colorMode === 'CMYK') ? DocumentColorSpace.CMYK : DocumentColorSpace.RGB;
        var doc = app.documents.add(cs, P.width, P.height, (P.artboards || 1));
        return { name: doc.name, widthPt: doc.width, heightPt: doc.height, colorMode: P.colorMode, artboards: doc.artboards.length };
      `,
    }),
  });

  registerIllustratorTool(server, {
    name: "illustrator_open_document",
    title: "Open Document",
    description:
      "Open an existing file in Illustrator (.ai, .pdf, .eps, .svg, and other supported formats).\n\n" +
      "Args:\n  - path (string): absolute path to the file to open.",
    inputSchema: {
      path: z.string().min(1).describe("Absolute path to the file to open."),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    build: (a) => ({
      params: { path: a.path },
      body: `
        var f = new File(P.path);
        if (!f.exists) throw new Error("File not found: " + P.path);
        var doc = app.open(f);
        return { name: doc.name, path: P.path };
      `,
    }),
  });

  registerIllustratorTool(server, {
    name: "illustrator_list_documents",
    title: "List Open Documents",
    description: "List all documents currently open in Illustrator, marking the active one.",
    inputSchema: {},
    annotations: { readOnlyHint: true, idempotentHint: true },
    build: () => ({
      body: `
        var arr = [];
        for (var i = 0; i < app.documents.length; i++){
          var d = app.documents[i];
          arr.push({ index: i, name: d.name, active: (d === app.activeDocument) });
        }
        return { count: app.documents.length, documents: arr };
      `,
    }),
  });

  registerIllustratorTool(server, {
    name: "illustrator_save_document",
    title: "Save Document",
    description:
      "Save the active document. With no 'path', saves in place (the document must already have a file). " +
      "With a 'path', saves a copy in the given format.\n\n" +
      "Args:\n  - path (string, optional): absolute destination path\n  - format ('ai'|'pdf'|'eps'): used only when 'path' is given (default 'ai').",
    inputSchema: {
      path: z.string().optional().describe("Absolute destination path (optional)."),
      format: z
        .enum(["ai", "pdf", "eps"])
        .default("ai")
        .describe("Save format when 'path' is provided. Default 'ai'."),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    build: (a) => ({
      params: { path: a.path ?? null, format: a.format },
      body: `
        var d = __doc();
        if (P.path){
          var f = new File(P.path);
          var opt;
          if (P.format === 'pdf') opt = new PDFSaveOptions();
          else if (P.format === 'eps') opt = new EPSSaveOptions();
          else opt = new IllustratorSaveOptions();
          d.saveAs(f, opt);
          return { saved: true, path: P.path, format: P.format };
        }
        try { d.save(); }
        catch (e) { throw new Error("This document has no file yet. Provide a 'path' to save it."); }
        return { saved: true, path: (d.fullName ? d.fullName.fsName : null) };
      `,
    }),
  });

  registerIllustratorTool(server, {
    name: "illustrator_close_document",
    title: "Close Document",
    description:
      "Close the active document.\n\nArgs:\n  - save (boolean): save changes before closing (default false).",
    inputSchema: {
      save: z.boolean().default(false).describe("Save changes before closing. Default false."),
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    build: (a) => ({
      params: { save: a.save },
      body: `
        var d = __doc();
        d.close(P.save ? SaveOptions.SAVECHANGES : SaveOptions.DONOTSAVECHANGES);
        return { closed: true };
      `,
    }),
  });

  registerIllustratorTool(server, {
    name: "illustrator_export_document",
    title: "Export Document",
    description:
      "Export the active document to an image or PDF.\n\n" +
      "Args:\n" +
      "  - path (string): absolute destination path (include the extension)\n" +
      "  - format ('png'|'jpg'|'svg'|'pdf'): default 'png'\n" +
      "  - scale (number): raster scale in percent, e.g. 200 = 2x (default 100)\n" +
      "  - transparent (boolean): PNG transparency (default true)\n" +
      "  - artboard_index (number, optional): export a specific artboard (0-based)\n\n" +
      "PNG/JPG are clipped to the active artboard.",
    inputSchema: {
      path: z.string().min(1).describe("Absolute destination path, including extension."),
      format: z.enum(["png", "jpg", "svg", "pdf"]).default("png").describe("Output format."),
      scale: z
        .number()
        .positive()
        .max(1000)
        .default(100)
        .describe("Raster scale in percent (200 = 2x). Default 100."),
      transparent: z.boolean().default(true).describe("PNG transparency. Default true."),
      artboard_index: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("0-based artboard index to export (optional)."),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    build: (a) => ({
      params: {
        path: a.path,
        format: a.format,
        scale: a.scale,
        transparent: a.transparent,
        artboardIndex: a.artboard_index ?? null,
      },
      body: `
        var d = __doc();
        if (P.artboardIndex !== null) d.artboards.setActiveArtboardIndex(P.artboardIndex);
        var f = new File(P.path);
        if (P.format === 'png'){
          var o = new ExportOptionsPNG24();
          o.artBoardClipping = true;
          o.transparency = (P.transparent !== false);
          if (P.scale){ o.horizontalScale = P.scale; o.verticalScale = P.scale; }
          d.exportFile(f, ExportType.PNG24, o);
        } else if (P.format === 'jpg' || P.format === 'jpeg'){
          var o2 = new ExportOptionsJPEG();
          o2.artBoardClipping = true;
          if (P.scale){ o2.horizontalScale = P.scale; o2.verticalScale = P.scale; }
          d.exportFile(f, ExportType.JPEG, o2);
        } else if (P.format === 'svg'){
          d.exportFile(f, ExportType.SVG, new ExportOptionsSVG());
        } else if (P.format === 'pdf'){
          d.saveAs(f, new PDFSaveOptions());
        } else {
          throw new Error("Unsupported export format '" + P.format + "'. Use png, jpg, svg, or pdf.");
        }
        return { exported: true, path: P.path, format: P.format };
      `,
    }),
  });
}
