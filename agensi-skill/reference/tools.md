# Illustrator MCP, full tool reference

All tool names are prefixed `illustrator_`. Coordinates are in points,
top-left origin of the active artboard, Y increasing downward, unless noted.
Colors are hex (`#FF7F00`), a common name (`red`, `blue`, `green`, ...), or
`none`.

## Contents

- [App](#app)
- [Documents](#documents)
- [Inspect (read-only)](#inspect-read-only)
- [Create](#create)
- [Vectorize](#vectorize)
- [Edit selection](#edit-selection)
- [Layers](#layers)
- [Selection](#selection)
- [Power: run_script](#power-run_script)

---

## App

### `illustrator_get_status`
Check whether Illustrator is running and, if so, its version and open
document count. **Never launches Illustrator**, so it's a safe first call
to verify the connection. No arguments.

---

## Documents

### `illustrator_create_document`
Create a new document. Launches Illustrator if needed.
- `width`, `height` (number, required): canvas size in the chosen unit.
- `unit`: `pt` | `px` | `mm` | `cm` | `in`, default `px` (1px = 1pt).
- `color_mode`: `RGB` | `CMYK`, default `RGB` (`RGB` for screen, `CMYK` for print).
- `artboards` (integer, 1-100): number of artboards, default 1.

Returns the new document's name, size in points, and color mode.

### `illustrator_open_document`
Open an existing file (`.ai`, `.pdf`, `.eps`, `.svg`, and other supported
formats).
- `path` (string, required): **absolute** path to the file.

### `illustrator_list_documents`
List all open documents, marking which one is active. No arguments.

### `illustrator_save_document`
Save the active document.
- `path` (string, optional): absolute destination path. Omit to save in
  place (the document must already have a file on disk).
- `format`: `ai` | `pdf` | `eps`, default `ai`. Only used when `path` is given.

### `illustrator_close_document`
Close the active document. **Destructive** if `save` is false and there are
unsaved changes.
- `save` (boolean, default `false`): save changes before closing.

### `illustrator_export_document`
Export the active document to an image or PDF. PNG/JPG are clipped to the
active artboard.
- `path` (string, required): absolute destination path, including extension.
- `format`: `png` | `jpg` | `svg` | `pdf`, default `png`.
- `scale` (number, 1-1000, default 100): raster scale in percent (200 = 2x).
- `transparent` (boolean, default `true`): PNG transparency.
- `artboard_index` (integer, optional, 0-based): export a specific artboard
  instead of the currently active one.

---

## Inspect (read-only)

All four tools below are `readOnlyHint: true`, safe to call anytime,
including to check state before or after an edit.

### `illustrator_get_document_info`
Overview of the active document: name, color mode, size, artboards, layers
(with visibility/lock/item count), total item count, and current selection
count. No arguments.

### `illustrator_get_selection`
List currently selected objects with type, name, position, and size
(artboard-relative, Y down). No arguments.

### `illustrator_list_layers`
List all layers with index, name, visibility, lock state, item count, and
which one is active. No arguments.

### `illustrator_list_artboards`
List all artboards with index, name, size in points, and which one is
active. No arguments.

---

## Create

All "Create" tools accept an optional `name` (string) to tag the object for
later `illustrator_select_by_name`, and most accept `fill`/`stroke`/
`strokeWidth` for styling at creation time.

### `illustrator_create_rectangle`
- `x`, `y` (number, required): top-left corner.
- `width`, `height` (number, required, positive): size in points.
- `corner_radius` (number, optional): rounded-rectangle corner radius in points.
- `fill`, `stroke` (color, optional), `strokeWidth` (number, optional), `name` (string, optional).

### `illustrator_create_ellipse`
- `x`, `y`, `width`, `height` (number, required): bounding box, top-left origin.
- `fill`, `stroke`, `strokeWidth`, `name` (optional, same as above).

### `illustrator_create_line`
- `x1`, `y1`, `x2`, `y2` (number, required): endpoints.
- `stroke` (color, optional, default black), `strokeWidth` (number, optional, default 1), `name` (optional).

### `illustrator_create_text`
- `text` (string, required): content.
- `x`, `y` (number, required): top-left position.
- `font_size` (number, default 24): size in points.
- `font` (string, optional): PostScript font name, e.g. `ArialMT`,
  `Helvetica-Bold` (best effort, falls back silently if not found/installed).
- `fill` (color, optional): text color.
- `name` (string, optional).

### `illustrator_place_image`
Place a raster/vector file into the document, linked by default.
- `path` (string, required): absolute path to the image.
- `x`, `y` (number, default 0): top-left position.
- `width`, `height` (number, optional, positive): resize to these dimensions in points.
- `embed` (boolean, default `false`): embed instead of linking.
- `name` (string, optional).

---

## Vectorize

### `illustrator_vectorize_image`
Turn a raster image into editable vector paths, the "redraw this artwork
from scratch" workflow. Best on logos, flat art, line art, and few-color
graphics; photorealistic images produce many paths and usually need manual
cleanup.

**Input** (one required):
- `path` (string): absolute path to the image, or
- `image_base64` (string): image bytes as base64 or a `data:` URI (for
  images pasted in chat with no file on disk).

**Engine selection:**
- `engine`: `vtracer` (default) | `image_trace`.
  - `vtracer`: the open-source VTracer CLI produces a clean SVG opened in
    Illustrator as editable paths. Usually cleaner than Image Trace, free,
    local. **Requires the `vtracer` binary** on `PATH` or `VTRACER_PATH`.
    If missing, the tool returns install instructions (`cargo install
    vtracer`, or a prebuilt binary from the VTracer GitHub releases page);
    retry with `engine: "image_trace"` as a zero-install fallback.
  - `image_trace`: Illustrator's built-in Image Trace. No install needed.

**Shared:**
- `mode`: `color` | `grayscale` | `blackwhite`, default `color` (grayscale applies to Image Trace only).

**VTracer-only options:**
- `curve_mode`: `spline` (default, smooth curves) | `polygon` | `pixel`.
- `filter_speckle` (integer 0-128, default 4): discard patches smaller than N px; higher = cleaner.
- `color_precision` (integer 1-8): color detail in bits; lower = fewer colors.
- `corner_threshold` (integer 0-180 degrees, default 60): corner angle threshold.

**Image Trace-only options:**
- `preset` (string): a named Image Trace preset.
- `max_colors` (integer 2-256): palette size.
- `threshold` (integer 1-255): black/white cutoff.
- `path_fidelity`, `corner_fidelity`, `noise_fidelity` (number 0-100): the
  corresponding Image Trace panel sliders.
- `expand` (boolean, default `true`): expand the tracing into editable paths
  immediately (if `false`, stays as a live Image Trace object).
- `new_document` (boolean, default `true`): trace into a fresh RGB document
  instead of the active one.

---

## Edit selection

These tools act on `d.selection`, select something first (see
[Selection](#selection)) or they error with a clear message asking you to.

### `illustrator_transform_selection`
Move, rotate, and/or scale the selection, applied in order
move, then rotate, then scale. All arguments optional.
- `dx`, `dy` (number): move by this many points (positive `dy` = down).
- `rotate` (number): degrees, counter-clockwise positive.
- `scale` (number, positive): uniform scale percent (100 = no change).
- `scale_x`, `scale_y` (number, positive): non-uniform scale percent, used only if `scale` is omitted.

### `illustrator_set_color`
Change fill/stroke of the selection. For text objects, `fill` recolors the text. Provide at least one argument.
- `fill` (color, optional, or `none`).
- `stroke` (color, optional, or `none`).
- `strokeWidth` (number, optional).

### `illustrator_arrange_selection`
Change stacking order (z-index).
- `order` (required): `front` | `back` | `forward` | `backward`.

### `illustrator_align_selection`
Align the selection relative to the **active artboard** (not to each other).
- `horizontal` (optional): `left` | `center` | `right`.
- `vertical` (optional): `top` | `middle` | `bottom`.

### `illustrator_delete_selection`
Delete all currently selected objects. **Destructive**, no undo from the
MCP side (Illustrator's own undo history still applies if the user is
watching). No arguments.

### `illustrator_group_selection`
Group the selection into one group, or ungroup selected groups.
- `action`: `group` (default) | `ungroup`.

---

## Layers

### `illustrator_create_layer`
Create a new layer and make it active (new artwork goes here from then on).
- `name` (string, required).

### `illustrator_set_active_layer`
Make an existing layer active by name.
- `name` (string, required): must match an existing layer (see
  `illustrator_list_layers`); errors with a clear message otherwise.

---

## Selection

### `illustrator_select_all`
Select every object in the active document. No arguments.

### `illustrator_deselect_all`
Clear the current selection. No arguments.

### `illustrator_select_by_name`
Select objects whose `name` matches, clearing the previous selection first.
- `name` (string, required): name or substring to match.
- `exact` (boolean, default `false`): require an exact match instead of substring.

---

## Power: `run_script`

### `illustrator_run_script`
Execute arbitrary ExtendScript inside the running Illustrator instance,
the escape hatch for anything the curated tools above don't cover (advanced
paths, effects, batch edits, reading detailed properties, etc.). **Read the
"Safety" section of `SKILL.md` before using this tool.**

- `code` (string, required): ExtendScript source. Runs inside a function
  body, use `return <value>;` to send JSON-serializable data back.

Available globals and helpers inside the script:
- `app`, and the active document via `__doc()`.
- `__color(hex)`: resolve a color string the same way the other tools do.
- `__setPos(item, x, y)`: position an item in the same top-left/Y-down convention as every other tool.
- `__itemInfo(item)`: the same `{type, name, x, y, width, height, ...}` shape returned by create/inspect tools.
- `__abRect()`: the active artboard's rectangle.
- `__activeAB(doc)`: the active artboard object.
- `__style(item, opts)`: apply `{fill, stroke, strokeWidth}` the same way the create/edit tools do.

Coordinates inside raw ExtendScript (outside these helpers) are Illustrator's
**native Y-up, global** system, not the Y-down/artboard-relative convention
used everywhere else in this skill. The helpers above exist specifically to
bridge that gap, so use them rather than hand-rolling coordinate math.

Example:
```js
var d = __doc();
var r = d.pathItems.rectangle(0, 0, 100, 100);
return __itemInfo(r);
```

**This tool can modify or delete any artwork and read/write/delete any file
the OS user can access.** It is not sandboxed to the document or a
particular folder. See `SKILL.md`, section "Safety: the `run_script` escape
hatch", for how to use it responsibly.
