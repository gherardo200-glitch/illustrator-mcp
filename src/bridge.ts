/**
 * Bridge between the MCP server (Node) and Adobe Illustrator.
 *
 * Every tool builds a small ExtendScript "body" (which may `return` a value).
 * We wrap it with the shared PRELUDE and a try/catch protocol, write it to a
 * temp file, and execute it inside Illustrator:
 *   - macOS   : osascript -> AppleScript `do javascript (POSIX file ...)`
 *   - Windows : PowerShell -> Illustrator COM `.DoJavaScript(...)`
 *
 * The script always returns a JSON string of the shape:
 *   { "ok": true,  "data": <any> }
 *   { "ok": false, "error": "<message>", "line": <number|null> }
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFile, unlink } from "node:fs/promises";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ZodRawShape } from "zod";

import { PRELUDE } from "./jsx.js";
import { ILLUSTRATOR_BUNDLE_ID, CALL_TIMEOUT_MS, MAX_BUFFER } from "./constants.js";

const execFileP = promisify(execFile);

export class IllustratorError extends Error {
  line: number | null;
  constructor(message: string, line: number | null = null) {
    super(message);
    this.name = "IllustratorError";
    this.line = line;
  }
}

const isMac = process.platform === "darwin";
const isWindows = process.platform === "win32";

/** Turn an arbitrary JS value into a safe JavaScript literal for embedding. */
function jsLiteral(value: unknown): string {
  // U+2028 / U+2029 are valid in JSON strings but are line terminators in
  // ExtendScript source, so escape them when embedding as a JS literal.
  return JSON.stringify(value)
    .replace(new RegExp("\u2028", "g"), "\\u2028")
    .replace(new RegExp("\u2029", "g"), "\\u2029");
}

/** Assemble the full ExtendScript program from a tool body + params. */
export function buildScript(body: string, params?: unknown): string {
  const paramDecl = params !== undefined ? `var P = ${jsLiteral(params)};\n` : "";
  // Leading BOM forces Illustrator to read the temp file as UTF-8.
  return (
    "﻿(function(){\n" +
    PRELUDE +
    "\ntry{\n" +
    "var __ret=(function(){\n" +
    paramDecl +
    body +
    "\n})();\n" +
    "if(__ret===undefined)__ret=null;\n" +
    "return __json({ok:true,data:__ret});\n" +
    "}catch(__e){\n" +
    "return __json({ok:false,error:(__e&&__e.message?__e.message:String(__e)),line:(__e&&__e.line?__e.line:null)});\n" +
    "}\n})();"
  );
}

/** Run a script body inside Illustrator and return its parsed `data`. */
export async function runJsx(body: string, params?: unknown): Promise<any> {
  const script = buildScript(body, params);
  const raw = await execInIllustrator(script);
  const trimmed = raw.trim();
  let parsed: { ok: boolean; data?: any; error?: string; line?: number | null };
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new IllustratorError(
      `Unexpected response from Illustrator (could not parse). Raw output: ${trimmed.slice(0, 800)}`
    );
  }
  if (!parsed.ok) {
    throw new IllustratorError(parsed.error || "Unknown Illustrator error", parsed.line ?? null);
  }
  return parsed.data ?? null;
}

/** Execute a complete ExtendScript program; returns Illustrator's stdout string. */
async function execInIllustrator(script: string): Promise<string> {
  if (!isMac && !isWindows) {
    throw new IllustratorError(
      `Unsupported platform '${process.platform}'. This connector controls Adobe Illustrator, which runs only on macOS and Windows.`
    );
  }

  const jsxPath = join(tmpdir(), `illustrator-mcp-${randomUUID()}.jsx`);
  await writeFile(jsxPath, script, "utf8");

  try {
    if (isMac) {
      const { stdout } = await execFileP(
        "osascript",
        [
          "-e",
          "on run argv",
          "-e",
          "set p to item 1 of argv",
          "-e",
          "set f to POSIX file p",
          "-e",
          `tell application id "${ILLUSTRATOR_BUNDLE_ID}" to do javascript f`,
          "-e",
          "end run",
          jsxPath,
        ],
        { timeout: CALL_TIMEOUT_MS, maxBuffer: MAX_BUFFER }
      );
      return stdout;
    } else {
      // Windows: drive Illustrator's COM automation from PowerShell.
      const ps1Path = join(tmpdir(), `illustrator-mcp-${randomUUID()}.ps1`);
      const ps1 = [
        "$ErrorActionPreference = 'Stop'",
        "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()",
        "$src = [System.IO.File]::ReadAllText($args[0], [System.Text.UTF8Encoding]::new())",
        "$ai = New-Object -ComObject Illustrator.Application",
        "[Console]::Out.Write($ai.DoJavaScript($src))",
      ].join("\n");
      await writeFile(ps1Path, ps1, "utf8");
      try {
        const { stdout } = await execFileP(
          "powershell",
          ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ps1Path, jsxPath],
          { timeout: CALL_TIMEOUT_MS, maxBuffer: MAX_BUFFER }
        );
        return stdout;
      } finally {
        unlink(ps1Path).catch(() => {});
      }
    }
  } catch (err: any) {
    throw new IllustratorError(describeExecError(err));
  } finally {
    unlink(jsxPath).catch(() => {});
  }
}

/** Turn a raw exec failure into an actionable message for the model/user. */
function describeExecError(err: any): string {
  const stderr: string = (err?.stderr || "").toString();
  const msg: string = (err?.message || "").toString();
  const blob = `${stderr}\n${msg}`;

  if (err?.killed || /timed out|ETIMEDOUT/i.test(blob)) {
    return "Illustrator did not respond in time. It may be launching, showing a modal dialog, or busy. Bring Illustrator to the foreground, dismiss any dialogs, and try again.";
  }
  if (/-1743|not authoriz|not allowed to send Apple events|assistive access/i.test(blob)) {
    return "Not authorized to control Illustrator. On macOS grant automation permission: System Settings > Privacy & Security > Automation, and enable Illustrator for the app running this server (e.g. Terminal / Claude). Then try again.";
  }
  if (/-600|isn.?t running|Application isn.?t running|can.?t be found|-1728|Invalid class string|80040154|Illustrator\.Application/i.test(blob)) {
    return "Could not reach Adobe Illustrator. Make sure Illustrator is installed and, ideally, already running, then try again.";
  }
  if (stderr.trim()) return stderr.trim().slice(0, 800);
  return (msg || "Failed to run Illustrator script.").slice(0, 800);
}

/** Check whether Illustrator is running WITHOUT launching it. */
export async function isIllustratorRunning(): Promise<boolean> {
  try {
    if (isMac) {
      const { stdout } = await execFileP("osascript", [
        "-e",
        'tell application "System Events" to (count of (every process whose name contains "Illustrator")) > 0',
      ]);
      return stdout.trim() === "true";
    }
    if (isWindows) {
      const { stdout } = await execFileP("powershell", [
        "-NoProfile",
        "-Command",
        "if (Get-Process Illustrator -ErrorAction SilentlyContinue) { 'true' } else { 'false' }",
      ]);
      return stdout.trim() === "true";
    }
  } catch {
    return false;
  }
  return false;
}

// ---------------------------------------------------------------------------
// MCP helpers
// ---------------------------------------------------------------------------

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

export function textResult(data: unknown): ToolResult {
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return { content: [{ type: "text", text }] };
}

export function errorResult(message: string): ToolResult {
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}

export interface IllustratorToolDef {
  name: string;
  title: string;
  description: string;
  inputSchema: ZodRawShape;
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
  /** Build the ExtendScript body + params from validated args. */
  build: (args: any) => { body: string; params?: unknown };
}

/** All Illustrator tool definitions registered via registerIllustratorTool.
 *  Exposed for introspection and testing (e.g. validating generated scripts). */
export const registeredToolDefs: IllustratorToolDef[] = [];

/**
 * Register an Illustrator tool: validates input (Zod), builds the ExtendScript,
 * runs it, and returns a clean text result or an actionable error.
 */
export function registerIllustratorTool(server: McpServer, def: IllustratorToolDef): void {
  // Dedupe by name so the registry stays bounded even when buildServer() runs
  // once per request in stateless HTTP mode.
  const existing = registeredToolDefs.findIndex((d) => d.name === def.name);
  if (existing >= 0) registeredToolDefs[existing] = def;
  else registeredToolDefs.push(def);
  server.registerTool(
    def.name,
    {
      title: def.title,
      description: def.description,
      inputSchema: def.inputSchema,
      annotations: { openWorldHint: true, ...def.annotations },
    },
    async (args: any): Promise<any> => {
      try {
        const { body, params } = def.build(args ?? {});
        const data = await runJsx(body, params);
        return textResult(data);
      } catch (err: any) {
        return errorResult(err?.message ? String(err.message) : String(err));
      }
    }
  );
}
