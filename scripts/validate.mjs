#!/usr/bin/env node
/**
 * Offline validation — no Illustrator required.
 *
 *  1. Assembles the ExtendScript for EVERY registered tool body and syntax-checks
 *     it with `node --check`.
 *  2. Spawns the MCP server and runs an initialize + tools/list handshake.
 *
 * Run:  npm run build && node scripts/validate.mjs
 */

import { spawn, execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const dist = (p) => pathToFileURL(join(ROOT, "dist", p)).href;

const { buildScript, registeredToolDefs } = await import(dist("bridge.js"));
const mods = [
  "tools/documents.js", "tools/inspect.js", "tools/shapes.js",
  "tools/transform.js", "tools/layers.js", "tools/selection.js", "tools/script.js",
];
const mock = { registerTool() {} };
for (const m of mods) {
  const mod = await import(dist(m));
  const fn = Object.values(mod).find((v) => typeof v === "function");
  fn(mock);
}

const sample = {
  width: 100, height: 100, x: 10, y: 10, x1: 0, y1: 0, x2: 50, y2: 50,
  unit: "px", color_mode: "RGB", artboards: 1, path: "/tmp/x.png", format: "png",
  scale: 100, transparent: true, artboard_index: 0, save: false,
  corner_radius: 5, fill: "#ff0000", stroke: "blue", strokeWidth: 2, name: "obj",
  text: "Ciào €", font_size: 24, font: "ArialMT", embed: false,
  dx: 5, dy: 5, rotate: 10, scale_x: 120, scale_y: 80, order: "front",
  horizontal: "center", vertical: "middle", action: "group", exact: false,
  code: "var d=__doc(); return __itemInfo(d.pathItems.rectangle(0,0,10,10));",
};

const tmp = mkdtempSync(join(tmpdir(), "ai-mcp-validate-"));
let failures = 0;

console.log(`\n== Syntax-checking ${registeredToolDefs.length} tool bodies ==`);
for (const def of registeredToolDefs) {
  try {
    const { body, params } = def.build(sample);
    const f = join(tmp, `${def.name}.js`);
    writeFileSync(f, buildScript(body, params), "utf8");
    execFileSync(process.execPath, ["--check", f], { stdio: "pipe" });
    console.log(`  ok   ${def.name}`);
  } catch (e) {
    failures++;
    console.log(`  FAIL ${def.name}`);
    console.log(String(e.stderr || e.message).split("\n").slice(0, 4).map((l) => "       " + l).join("\n"));
  }
}
console.log(`\nSyntax check: ${failures === 0 ? "ALL PASSED" : failures + " FAILED"}`);

console.log(`\n== MCP handshake (initialize + tools/list) ==`);
const server = spawn(process.execPath, [join(ROOT, "dist", "index.js")], { stdio: ["pipe", "pipe", "pipe"] });
let buf = "";
const responses = [];
server.stdout.on("data", (d) => {
  buf += d.toString();
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (line) { try { responses.push(JSON.parse(line)); } catch {} }
  }
});
const send = (o) => server.stdin.write(JSON.stringify(o) + "\n");
send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "validate", version: "0.0.0" } } });
await new Promise((r) => setTimeout(r, 400));
send({ jsonrpc: "2.0", method: "notifications/initialized" });
send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
await new Promise((r) => setTimeout(r, 600));
const tools = responses.find((r) => r.id === 2)?.result?.tools ?? [];
console.log(`Tools advertised: ${tools.length}`);
server.kill();

const ok = failures === 0 && tools.length > 0;
console.log(`\n${ok ? "✅ Validation passed" : "❌ Validation failed"}\n`);
process.exit(ok ? 0 : 1);
