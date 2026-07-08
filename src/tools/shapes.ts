/**
 * Artwork creation tools: rectangle, ellipse, line, text, place image.
 *
 * All coordinates and sizes are in points (= pixels at 72 dpi), measured from
 * the TOP-LEFT of the active artboard, with Y increasing downward.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerIllustratorTool } from "../bridge.js";

const color = z
  .string()
  .describe("Color as hex (#FF7F00), a name (red, blue, green, ...), or 'none'.");

const styleShape = {
  fill: color.optional().describe("Fill color. Omit to keep default."),
  stroke: color.optional().describe("Stroke (outline) color. Omit for no change."),
  strokeWidth: z.number().min(0).optional().describe("Stroke width in points."),
  name: z.string().optional().describe("Optional name for the object (useful for later selection)."),
};

export function registerShapeTools(server: McpServer): void {
  registerIllustratorTool(server, {
    name: "illustrator_create_rectangle",
    title: "Create Rectangle",
    description:
      "Draw a rectangle (optionally rounded) on the active document.\n\n" +
      "Coordinates/sizes are in points, from the top-left of the active artboard, Y down.\n" +
      "Args: x, y (top-left), width, height, optional corner_radius, fill, stroke, strokeWidth, name.",
    inputSchema: {
      x: z.number().describe("Left edge, from artboard left."),
      y: z.number().describe("Top edge, from artboard top (Y increases downward)."),
      width: z.number().positive().describe("Width in points."),
      height: z.number().positive().describe("Height in points."),
      corner_radius: z.number().min(0).optional().describe("Corner radius in points (rounded rectangle)."),
      ...styleShape,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    build: (a) => ({
      params: {
        x: a.x, y: a.y, width: a.width, height: a.height,
        cornerRadius: a.corner_radius ?? null,
        fill: a.fill ?? null, stroke: a.stroke ?? null, strokeWidth: a.strokeWidth ?? null,
        name: a.name ?? null,
      },
      body: `
        var d = __doc();
        var ab = __abRect();
        var top = ab[1] - P.y, left = ab[0] + P.x;
        var item;
        if (P.cornerRadius && P.cornerRadius > 0)
          item = d.pathItems.roundedRectangle(top, left, P.width, P.height, P.cornerRadius, P.cornerRadius);
        else
          item = d.pathItems.rectangle(top, left, P.width, P.height);
        __style(item, P);
        if (P.name) item.name = P.name;
        return __itemInfo(item);
      `,
    }),
  });

  registerIllustratorTool(server, {
    name: "illustrator_create_ellipse",
    title: "Create Ellipse",
    description:
      "Draw an ellipse/circle. The x,y,width,height describe its bounding box (top-left origin, Y down).\n" +
      "Args: x, y, width, height, optional fill, stroke, strokeWidth, name.",
    inputSchema: {
      x: z.number().describe("Bounding box left edge."),
      y: z.number().describe("Bounding box top edge (Y down)."),
      width: z.number().positive().describe("Bounding box width."),
      height: z.number().positive().describe("Bounding box height."),
      ...styleShape,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    build: (a) => ({
      params: {
        x: a.x, y: a.y, width: a.width, height: a.height,
        fill: a.fill ?? null, stroke: a.stroke ?? null, strokeWidth: a.strokeWidth ?? null,
        name: a.name ?? null,
      },
      body: `
        var d = __doc();
        var ab = __abRect();
        var item = d.pathItems.ellipse(ab[1] - P.y, ab[0] + P.x, P.width, P.height);
        __style(item, P);
        if (P.name) item.name = P.name;
        return __itemInfo(item);
      `,
    }),
  });

  registerIllustratorTool(server, {
    name: "illustrator_create_line",
    title: "Create Line",
    description:
      "Draw a straight line between two points (x1,y1) and (x2,y2), top-left origin, Y down.\n" +
      "Args: x1, y1, x2, y2, optional stroke (default black), strokeWidth (default 1), name.",
    inputSchema: {
      x1: z.number().describe("Start X."),
      y1: z.number().describe("Start Y."),
      x2: z.number().describe("End X."),
      y2: z.number().describe("End Y."),
      stroke: color.optional().describe("Line color (default black)."),
      strokeWidth: z.number().min(0).optional().describe("Line width in points (default 1)."),
      name: z.string().optional().describe("Optional name."),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    build: (a) => ({
      params: {
        x1: a.x1, y1: a.y1, x2: a.x2, y2: a.y2,
        stroke: a.stroke ?? null, strokeWidth: a.strokeWidth ?? null, name: a.name ?? null,
      },
      body: `
        var d = __doc();
        var ab = __abRect();
        var p = d.pathItems.add();
        p.setEntirePath([[ab[0] + P.x1, ab[1] - P.y1], [ab[0] + P.x2, ab[1] - P.y2]]);
        p.filled = false;
        p.stroked = true;
        p.strokeWidth = (P.strokeWidth || 1);
        var sc = __color((P.stroke === null || P.stroke === undefined) ? 'black' : P.stroke);
        if (sc.typename !== 'NoColor') p.strokeColor = sc;
        if (P.name) p.name = P.name;
        return __itemInfo(p);
      `,
    }),
  });

  registerIllustratorTool(server, {
    name: "illustrator_create_text",
    title: "Create Text",
    description:
      "Add a text object.\n\n" +
      "Args:\n" +
      "  - text (string): the text content\n" +
      "  - x, y (number): top-left position (Y down)\n" +
      "  - font_size (number): size in points (default 24)\n" +
      "  - font (string, optional): PostScript font name, e.g. 'ArialMT', 'Helvetica-Bold'\n" +
      "  - fill (color, optional): text color\n" +
      "  - name (string, optional)",
    inputSchema: {
      text: z.string().min(1).describe("The text content."),
      x: z.number().describe("Left position."),
      y: z.number().describe("Top position (Y down)."),
      font_size: z.number().positive().default(24).describe("Font size in points."),
      font: z.string().optional().describe("PostScript font name (best effort)."),
      fill: color.optional().describe("Text color."),
      name: z.string().optional().describe("Optional name."),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    build: (a) => ({
      params: {
        text: a.text, x: a.x, y: a.y, fontSize: a.font_size,
        font: a.font ?? null, fill: a.fill ?? null, name: a.name ?? null,
      },
      body: `
        var d = __doc();
        var t = d.textFrames.add();
        t.contents = P.text;
        if (P.fontSize) t.textRange.characterAttributes.size = P.fontSize;
        if (P.font){ try { t.textRange.characterAttributes.textFont = app.textFonts.getByName(P.font); } catch (e) {} }
        if (P.fill !== null && P.fill !== undefined){
          var fc = __color(P.fill);
          if (fc.typename !== 'NoColor') t.textRange.characterAttributes.fillColor = fc;
        }
        __setPos(t, P.x, P.y);
        if (P.name) t.name = P.name;
        return __itemInfo(t);
      `,
    }),
  });

  registerIllustratorTool(server, {
    name: "illustrator_place_image",
    title: "Place Image",
    description:
      "Place a raster/vector image file into the active document (linked, or embedded).\n\n" +
      "Args:\n  - path (string): absolute path to the image\n  - x, y (number): top-left position (default 0,0)\n" +
      "  - width, height (number, optional): resize to these dimensions in points\n" +
      "  - embed (boolean): embed instead of link (default false)\n  - name (string, optional)",
    inputSchema: {
      path: z.string().min(1).describe("Absolute path to the image file."),
      x: z.number().default(0).describe("Left position."),
      y: z.number().default(0).describe("Top position (Y down)."),
      width: z.number().positive().optional().describe("Optional target width in points."),
      height: z.number().positive().optional().describe("Optional target height in points."),
      embed: z.boolean().default(false).describe("Embed the image instead of linking it."),
      name: z.string().optional().describe("Optional name."),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    build: (a) => ({
      params: {
        path: a.path, x: a.x, y: a.y,
        width: a.width ?? null, height: a.height ?? null,
        embed: a.embed, name: a.name ?? null,
      },
      body: `
        var d = __doc();
        var f = new File(P.path);
        if (!f.exists) throw new Error("Image file not found: " + P.path);
        var placed = d.placedItems.add();
        placed.file = f;
        if (P.width) placed.width = P.width;
        if (P.height) placed.height = P.height;
        __setPos(placed, (P.x || 0), (P.y || 0));
        if (P.name){ try { placed.name = P.name; } catch (e) {} }
        var info = __itemInfo(placed);
        if (P.embed) placed.embed();
        return info;
      `,
    }),
  });
}
