/** Selection tools. Most edit tools act on the current selection. */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerIllustratorTool } from "../bridge.js";

export function registerSelectionTools(server: McpServer): void {
  registerIllustratorTool(server, {
    name: "illustrator_select_all",
    title: "Select All",
    description: "Select all objects in the active document.",
    inputSchema: {},
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    build: () => ({
      body: `
        var d = __doc();
        app.executeMenuCommand('selectall');
        return { selected: d.selection.length };
      `,
    }),
  });

  registerIllustratorTool(server, {
    name: "illustrator_deselect_all",
    title: "Deselect All",
    description: "Clear the current selection.",
    inputSchema: {},
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    build: () => ({
      body: `
        var d = __doc();
        d.selection = null;
        return { selected: 0 };
      `,
    }),
  });

  registerIllustratorTool(server, {
    name: "illustrator_select_by_name",
    title: "Select By Name",
    description:
      "Select objects by their name (assigned when created). Clears the previous selection first.\n\n" +
      "Args:\n  - name (string): name (or substring) to match\n  - exact (boolean): require an exact match (default false).",
    inputSchema: {
      name: z.string().min(1).describe("Object name or substring to match."),
      exact: z.boolean().default(false).describe("Require exact match. Default false (substring)."),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    build: (a) => ({
      params: { name: a.name, exact: a.exact },
      body: `
        var d = __doc();
        d.selection = null;
        var items = d.pageItems, matched = 0;
        for (var i = 0; i < items.length; i++){
          var it = items[i];
          var nm = it.name || '';
          var hit = P.exact ? (nm === P.name) : (nm.indexOf(P.name) !== -1);
          if (hit){ it.selected = true; matched++; }
        }
        return { matched: matched };
      `,
    }),
  });
}
