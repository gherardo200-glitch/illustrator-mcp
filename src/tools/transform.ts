/** Tools that operate on the current selection: transform, color, arrange, align, delete, group. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerIllustratorTool } from "../bridge.js";

const color = z.string().describe("Color as hex (#FF7F00), a name, or 'none'.");

const NEED_SELECTION =
  'if (!sel || !sel.length) throw new Error("Nothing is selected. Select objects first with illustrator_select_all or illustrator_select_by_name.");';

export function registerTransformTools(server: McpServer): void {
  registerIllustratorTool(server, {
    name: "illustrator_transform_selection",
    title: "Transform Selection",
    description:
      "Move, rotate and/or scale the currently selected objects.\n\n" +
      "Args (all optional, applied in order move -> rotate -> scale):\n" +
      "  - dx, dy (number): move by this many points (dy positive = down)\n" +
      "  - rotate (number): rotation in degrees (counter-clockwise positive)\n" +
      "  - scale (number): uniform scale in percent (100 = no change)\n" +
      "  - scale_x, scale_y (number): non-uniform scale in percent (used if 'scale' omitted).",
    inputSchema: {
      dx: z.number().optional().describe("Horizontal move in points."),
      dy: z.number().optional().describe("Vertical move in points (positive = down)."),
      rotate: z.number().optional().describe("Rotation in degrees."),
      scale: z.number().positive().optional().describe("Uniform scale percent (100 = none)."),
      scale_x: z.number().positive().optional().describe("Horizontal scale percent."),
      scale_y: z.number().positive().optional().describe("Vertical scale percent."),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    build: (a) => ({
      params: {
        dx: a.dx ?? 0, dy: a.dy ?? 0, rotate: a.rotate ?? 0,
        scale: a.scale ?? null, scaleX: a.scale_x ?? null, scaleY: a.scale_y ?? null,
      },
      body: `
        var d = __doc();
        var sel = d.selection;
        ${NEED_SELECTION}
        for (var i = 0; i < sel.length; i++){
          var it = sel[i];
          if (P.dx || P.dy) it.translate(P.dx, -P.dy);
          if (P.rotate) it.rotate(P.rotate);
          if (P.scale) it.resize(P.scale, P.scale);
          else if (P.scaleX || P.scaleY) it.resize((P.scaleX || 100), (P.scaleY || 100));
        }
        return { transformed: sel.length };
      `,
    }),
  });

  registerIllustratorTool(server, {
    name: "illustrator_set_color",
    title: "Set Color of Selection",
    description:
      "Change fill/stroke of the selected objects. For text objects, 'fill' recolors the text.\n\n" +
      "Args: fill (color), stroke (color), strokeWidth (number). Provide at least one.",
    inputSchema: {
      fill: color.optional().describe("New fill color (or 'none')."),
      stroke: color.optional().describe("New stroke color (or 'none')."),
      strokeWidth: z.number().min(0).optional().describe("New stroke width in points."),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    build: (a) => ({
      params: { fill: a.fill ?? null, stroke: a.stroke ?? null, strokeWidth: a.strokeWidth ?? null },
      body: `
        var d = __doc();
        var sel = d.selection;
        ${NEED_SELECTION}
        for (var i = 0; i < sel.length; i++) __style(sel[i], P);
        return { styled: sel.length };
      `,
    }),
  });

  registerIllustratorTool(server, {
    name: "illustrator_arrange_selection",
    title: "Arrange Selection (Z-order)",
    description:
      "Change the stacking order of selected objects.\n\nArgs:\n  - order ('front'|'back'|'forward'|'backward').",
    inputSchema: {
      order: z
        .enum(["front", "back", "forward", "backward"])
        .describe("bring to front / send to back / bring forward / send backward."),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    build: (a) => ({
      params: { order: a.order },
      body: `
        var d = __doc();
        var sel = d.selection;
        ${NEED_SELECTION}
        for (var i = 0; i < sel.length; i++){
          var it = sel[i];
          if (P.order === 'front') it.zOrder(ZOrderMethod.BRINGTOFRONT);
          else if (P.order === 'back') it.zOrder(ZOrderMethod.SENDTOBACK);
          else if (P.order === 'forward') it.zOrder(ZOrderMethod.BRINGFORWARD);
          else if (P.order === 'backward') it.zOrder(ZOrderMethod.SENDBACKWARD);
        }
        return { arranged: sel.length };
      `,
    }),
  });

  registerIllustratorTool(server, {
    name: "illustrator_align_selection",
    title: "Align Selection to Artboard",
    description:
      "Align selected objects relative to the active artboard.\n\n" +
      "Args:\n  - horizontal ('left'|'center'|'right'), optional\n  - vertical ('top'|'middle'|'bottom'), optional.",
    inputSchema: {
      horizontal: z.enum(["left", "center", "right"]).optional().describe("Horizontal alignment."),
      vertical: z.enum(["top", "middle", "bottom"]).optional().describe("Vertical alignment."),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    build: (a) => ({
      params: { horizontal: a.horizontal ?? null, vertical: a.vertical ?? null },
      body: `
        var d = __doc();
        var sel = d.selection;
        ${NEED_SELECTION}
        var ab = __activeAB(d).artboardRect; // [l, t, r, b]
        var abL = ab[0], abT = ab[1], abR = ab[2], abB = ab[3];
        for (var i = 0; i < sel.length; i++){
          var it = sel[i];
          var w = it.width, h = it.height;
          if (P.horizontal === 'left') it.left = abL;
          else if (P.horizontal === 'right') it.left = abR - w;
          else if (P.horizontal === 'center') it.left = (abL + abR) / 2 - w / 2;
          if (P.vertical === 'top') it.top = abT;
          else if (P.vertical === 'bottom') it.top = abB + h;
          else if (P.vertical === 'middle') it.top = (abT + abB) / 2 + h / 2;
        }
        return { aligned: sel.length };
      `,
    }),
  });

  registerIllustratorTool(server, {
    name: "illustrator_delete_selection",
    title: "Delete Selection",
    description: "Delete all currently selected objects.",
    inputSchema: {},
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    build: () => ({
      body: `
        var d = __doc();
        var sel = d.selection;
        var n = sel.length;
        for (var i = n - 1; i >= 0; i--) sel[i].remove();
        return { deleted: n };
      `,
    }),
  });

  registerIllustratorTool(server, {
    name: "illustrator_group_selection",
    title: "Group / Ungroup Selection",
    description:
      "Group the selected objects into one group, or ungroup selected groups.\n\nArgs:\n  - action ('group'|'ungroup'), default 'group'.",
    inputSchema: {
      action: z.enum(["group", "ungroup"]).default("group").describe("group or ungroup."),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    build: (a) => ({
      params: { action: a.action },
      body: `
        var d = __doc();
        var sel = d.selection;
        ${NEED_SELECTION}
        app.executeMenuCommand(P.action === 'ungroup' ? 'ungroup' : 'group');
        return { ok: true, action: P.action };
      `,
    }),
  });
}
