/** Application-level tools (status). Special-cased so it never launches Illustrator. */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runJsx, textResult, errorResult, isIllustratorRunning } from "../bridge.js";

export function registerAppTools(server: McpServer): void {
  server.registerTool(
    "illustrator_get_status",
    {
      title: "Get Illustrator Status",
      description:
        "Check whether Adobe Illustrator is running and, if so, its version and how many documents are open. " +
        "This does NOT launch Illustrator, so it is a safe first call to verify the connection.",
      inputSchema: {},
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
    },
    async (): Promise<any> => {
      try {
        const running = await isIllustratorRunning();
        if (!running) {
          return textResult({
            running: false,
            message:
              "Adobe Illustrator is not currently running. Any create/edit tool will launch it automatically, or start it manually first.",
          });
        }
        const data = await runJsx(`
          return {
            version: app.version,
            documents: app.documents.length,
            activeDocument: (app.documents.length ? app.activeDocument.name : null)
          };
        `);
        return textResult({ running: true, ...data });
      } catch (err: any) {
        return errorResult(err?.message ? String(err.message) : String(err));
      }
    }
  );
}
