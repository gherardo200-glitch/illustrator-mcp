---
name: illustrator-mcp
description: Drive a real, already-open Adobe Illustrator document through natural language, creating or editing artboards, layers, shapes, text, and images, vectorizing a raster logo into editable paths, aligning or recoloring objects, and exporting PNG, JPG, SVG, or PDF. Use this skill whenever the user asks to create, draw, edit, lay out, align, recolor, vectorize, trace, or export artwork in Illustrator, mentions an open .ai file, or wants AI-generated art turned into clean editable vector paths. This is NOT a text-to-image generator: it edits a real Illustrator document (layers, artboards, text frames) that stays editable by hand afterward. Requires the illustrator-mcp MCP server connected and Adobe Illustrator installed on the same machine as the server.
---

# Illustrator MCP

## What this is

Illustrator MCP is an MCP server that bridges an AI assistant and a real,
running copy of Adobe Illustrator. Every tool call becomes a small
ExtendScript program that Illustrator executes on the document that is
actually open on the user's screen: not a sandbox, not a one-shot render.
The result is a normal `.ai` file, layers, artboards, and editable text the
user can keep tweaking by hand after the agent is done.

Use this skill for tasks like "create a poster", "draw three circles and
align them", "vectorize this logo", "recolor everything named 'badge'", or
"export the artboard as a PNG": any time the user wants to produce or
modify vector artwork inside Illustrator rather than get a flat picture back.

Do **not** reach for this skill for pure image generation (no Illustrator
document involved); that's a different kind of tool.

## Prerequisites and setup

- **Adobe Illustrator** installed and, ideally, already running with a
  document open (most tools auto-launch it, but an already-open document is
  the whole point of this skill).
- **Node.js 18+** and the server built (`npm install && npm run build`,
  produces `dist/index.js`).
- The server already added to the current MCP client's config (Claude
  Desktop / Claude Code / Cursor: point at the absolute path of
  `dist/index.js`; ChatGPT: via a local HTTP transport plus secure tunnel).
  If the Illustrator tools are not visible, tell the user it still needs to
  be connected. Don't try to install or configure it yourself from inside a
  chat; point them at the project's `README.md` (sections "Install" and
  "Connect it to your AI client") for the exact steps per client.
- **macOS first run**: Illustrator asks for Automation permission the first
  time a tool runs. If a call fails with "Not authorized to control
  Illustrator", tell the user to grant it in System Settings → Privacy &
  Security → Automation.
- To sanity-check the connection without side effects, call
  `illustrator_get_status` first: it never launches Illustrator and just
  reports whether it's running.

## Conventions

- **Coordinates**: all positions and sizes are in **points** (1pt = 1px at
  72 dpi), measured from the **top-left of the active artboard**, with **Y
  increasing downward**, the usual convention for design tools, not
  Illustrator's native Y-up/global system (the server converts for you).
- **Colors**: a hex string (`#FF7F00`), a common name (`red`, `blue`,
  `green`, ...), or `none`. They're converted automatically to RGB or CMYK
  to match the document's color mode.
- **Units for document size**: `illustrator_create_document` accepts `pt`,
  `px`, `mm`, `cm`, or `in` and converts to points internally; every other
  tool works directly in points.
- **Most edit tools act on the current selection** (transform, recolor,
  arrange, align, delete, group). Select something first with
  `illustrator_select_all` or `illustrator_select_by_name`, or capture the
  return value of a create tool and select it by the `name` you gave it.

## Tool categories and when to use each

The server exposes 29 tools. Full parameter-by-parameter reference (every
argument, default, and the exact ExtendScript behavior) is in
`reference/tools.md`. Load it on demand when you need exact argument names
or less common options; for everyday use the categories below are usually
enough.

| Category | Tools | When to use |
|---|---|---|
| **Status** | `illustrator_get_status` | First call to verify the connection. Safe, never launches Illustrator. |
| **Documents** | `create_document`, `open_document`, `list_documents`, `save_document`, `close_document`, `export_document` | Start a new canvas, open an existing `.ai`/`.pdf`/`.eps`/`.svg`, save, or export a final PNG/JPG/SVG/PDF. |
| **Inspect** | `get_document_info`, `get_selection`, `list_layers`, `list_artboards` | Read-only. Call before editing an unfamiliar document, or to check the effect of a previous call. |
| **Create** | `create_rectangle`, `create_ellipse`, `create_line`, `create_text`, `place_image` | Add new artwork: shapes, text frames, or a raster/vector file placed into the canvas. |
| **Vectorize** | `vectorize_image` | Turn a raster (PNG/JPG, e.g. an AI-generated logo) into editable vector paths, the "redraw this from scratch" task. Two engines: `vtracer` (default, cleaner, needs the `vtracer` binary) or `image_trace` (built-in, zero install). |
| **Edit selection** | `transform_selection`, `set_color`, `arrange_selection`, `align_selection`, `delete_selection`, `group_selection` | Move/rotate/scale, recolor, reorder (z-index), align to the artboard, delete, or group/ungroup whatever is currently selected. |
| **Layers** | `create_layer`, `set_active_layer` | Organize artwork; new objects land on the active layer. |
| **Selection** | `select_all`, `deselect_all`, `select_by_name` | Build the selection that the edit tools above act on. |
| **Power** | `run_script` | Escape hatch: arbitrary ExtendScript for anything the curated tools don't cover. See **Safety** below before using it. |

(All tool names are prefixed `illustrator_`, e.g. `illustrator_create_rectangle`.)

## Usage patterns

**1. Create a poster from scratch**
> "Create an A4 poster with a dark blue background and the headline 'SALE' in bold white."

1. `illustrator_create_document` (A4 in `mm`, or pass points directly).
2. `illustrator_create_rectangle` sized to the full artboard, `fill: "#0A1F44"`.
3. `illustrator_create_text` with the headline, a large `font_size`, `fill: "white"`.
4. `illustrator_align_selection` if the text needs centering.
5. `illustrator_export_document` to a PNG for a quick preview, or leave the
   `.ai` open for the user to keep editing.

**2. Vectorize a logo a client sent**
> "Vectorize `~/Desktop/client-logo.png` into clean paths."

1. `illustrator_vectorize_image` with `path` set to the file (default
   `engine: "vtracer"` for the cleanest result on flat logo art).
2. If the server reports VTracer isn't installed, retry with
   `engine: "image_trace"` (no install needed) rather than failing outright.
   Mention to the user that `vtracer` would give cleaner paths and how to
   install it (see `reference/tools.md`).
3. Report the resulting path/compound-path count so the user knows what
   landed in the document.

**3. Align and organize a row of shapes**
> "Draw three circles in a row and center them on the artboard."

1. Three `illustrator_create_ellipse` calls, giving each a distinct `name`
   so they can be selected together afterward.
2. `illustrator_select_by_name` (a shared substring in the names) or
   `illustrator_select_all` if nothing else is on the canvas.
3. `illustrator_align_selection` with `horizontal: "center"` and/or
   `vertical: "middle"`.
4. Optionally `illustrator_group_selection` to keep them together.

**4. Export the current artboard**
> "Export the current artboard as a 2x transparent PNG to my Desktop."

1. `illustrator_export_document` with `format: "png"`, `scale: 200`,
   `transparent: true`, and an absolute `path` ending in `.png`.
2. Confirm the saved path back to the user.

## Safety: the `run_script` escape hatch

`illustrator_run_script` executes **arbitrary ExtendScript** inside the
running Illustrator instance. It is deliberately unrestricted so an agent is
never boxed in by the curated tools, but that power cuts both ways:

- It can create, modify, or **permanently delete artwork**, including
  objects the specialized tools never touch.
- It can read, write, or delete **any file the OS user can access**:
  ExtendScript's `File`/`Folder` API is not sandboxed to the Illustrator
  document or any particular folder.
- It is marked `destructiveHint: true` in the tool's MCP annotations, same
  as delete/close. MCP-aware clients should prompt the user before running
  it; don't rely on that alone. **Explain what the script does in plain
  language before running it**, especially for anything that deletes,
  overwrites, or touches files outside the current document, and prefer a
  specialized tool (create/edit/transform/etc.) whenever one already covers
  the task instead of reaching for raw script.
- Treat `run_script` code the same way you'd treat a shell command you're
  about to run on someone's machine: show it, explain the effect, and only
  proceed on a destructive action after the user has had a chance to say no.

If the server is ever run in `--http` mode (used for ChatGPT's remote MCP
tunnel), it opens a real local network port; that mode has its own
DNS-rebinding and token-auth protections documented in the project
`README.md`, not relevant for the normal stdio setup used by Claude/Cursor,
but worth knowing if the user mentions ChatGPT or a remote connection.

## Reference

- `reference/tools.md`: every one of the 29 tools with its full argument
  list, defaults, and notes. Load this file when you need an exact parameter
  name, a less-common option (e.g. VTracer tuning knobs, export scale), or
  want to double-check behavior before calling a tool you haven't used yet
  in this conversation.
