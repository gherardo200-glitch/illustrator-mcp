# Illustrator MCP

**Control Adobe Illustrator with natural language — from Claude, ChatGPT, Cursor, or any MCP client.**

This is an [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server that acts as a bridge between an AI assistant and Adobe Illustrator. Ask your assistant to *"create an A4 poster, add a red rounded rectangle and a headline"* and it drives Illustrator for you through Illustrator's own scripting engine (ExtendScript).

> Works on **macOS** and **Windows**. Illustrator must be installed on the same machine as the server.

---

## What can it do?

Say things like:

- *"Create a 1080×1080 RGB document and add the title 'SALE' in bold orange."*
- *"Draw three circles in a row, then align them to the center of the artboard."*
- *"Place `~/logo.png` in the top-left corner and scale it to 200px wide."*
- *"Select everything named 'badge' and make it blue."*
- *"Export the current artboard as a 2x transparent PNG to my Desktop."*
- *"Read all the text objects in this document and list their contents."*

It ships with **28 tools** covering documents, artboards, layers, shapes, text, images, transforms, alignment, color, selection, and export — plus a **`run_script`** escape hatch that can execute *any* Illustrator ExtendScript, so an agent is never boxed in.

---

## How it works

```
┌─────────────┐   MCP (stdio)   ┌──────────────────┐   ExtendScript   ┌──────────────┐
│ Claude /    │ ◄────────────► │ illustrator-mcp   │ ◄─────────────► │  Adobe        │
│ ChatGPT /   │   tool calls    │ server (Node/TS)  │  osascript /     │  Illustrator  │
│ Cursor ...  │                 │                   │  PowerShell COM  │              │
└─────────────┘                 └──────────────────┘                  └──────────────┘
```

- The AI client sends **tool calls** over MCP.
- The server turns each call into a small **ExtendScript** program.
- It runs that script inside Illustrator via **AppleScript `do javascript`** (macOS) or **COM `DoJavaScript`** (Windows).
- Results come back as structured JSON.

Because the final layer is ExtendScript, anything the Illustrator scripting API supports is reachable.

---

## Requirements

- **Adobe Illustrator** installed (any reasonably recent version) and, ideally, running.
- **Node.js 18+**.
- **macOS** or **Windows**.
- An MCP-capable client (Claude Desktop, Claude Code, Cursor, ChatGPT desktop with MCP, …).

---

## Install

```bash
git clone https://github.com/gherardo200-glitch/illustrator-mcp.git
cd illustrator-mcp
npm install        # also builds via the "prepare" script
npm run build      # (only needed if you skip install-time build)
```

This produces `dist/index.js`, the server entry point. Note its **absolute path** — you'll need it for the client config, e.g.:

```
/absolute/path/to/illustrator-mcp/dist/index.js
```

---

## Connect it to your AI client

### Claude Desktop

Edit the config file:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "illustrator": {
      "command": "node",
      "args": ["/absolute/path/to/illustrator-mcp/dist/index.js"]
    }
  }
}
```

Restart Claude Desktop. You should see the Illustrator tools appear.

### Claude Code

```bash
claude mcp add illustrator -- node /absolute/path/to/illustrator-mcp/dist/index.js
```

…or commit a `.mcp.json` to your project (see [`examples/mcp.json`](examples/mcp.json)).

### Cursor

Add to `~/.cursor/mcp.json` (or the project's `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "illustrator": {
      "command": "node",
      "args": ["/absolute/path/to/illustrator-mcp/dist/index.js"]
    }
  }
}
```

### ChatGPT

ChatGPT supports MCP through its **connectors / developer mode**. Point a local
(stdio) connector at the same `node dist/index.js` command. Because Illustrator
runs locally, the server must run on the same machine. See
[`docs/CHATGPT.md`](docs/CHATGPT.md) for the current options and caveats.

### Any other MCP client

The server speaks standard MCP over **stdio**. Command: `node dist/index.js`.

---

## First run & permissions (macOS)

The first time the server talks to Illustrator, macOS asks permission to let your
terminal/app **control Adobe Illustrator** (Apple Events automation). Click **OK**.

If you denied it or nothing happens, enable it manually:
**System Settings → Privacy & Security → Automation →** *(your app: Terminal / Claude / Cursor)* → enable **Adobe Illustrator**.

**Verify the connection** by asking your assistant to run `illustrator_get_status`
(it does not launch Illustrator, so it's a safe first call).

---

## Tools

| Area | Tools |
|------|-------|
| **App** | `illustrator_get_status` |
| **Documents** | `illustrator_create_document`, `illustrator_open_document`, `illustrator_list_documents`, `illustrator_save_document`, `illustrator_close_document`, `illustrator_export_document` |
| **Inspect** | `illustrator_get_document_info`, `illustrator_get_selection`, `illustrator_list_layers`, `illustrator_list_artboards` |
| **Create** | `illustrator_create_rectangle`, `illustrator_create_ellipse`, `illustrator_create_line`, `illustrator_create_text`, `illustrator_place_image` |
| **Edit** | `illustrator_transform_selection`, `illustrator_set_color`, `illustrator_arrange_selection`, `illustrator_align_selection`, `illustrator_delete_selection`, `illustrator_group_selection` |
| **Layers** | `illustrator_create_layer`, `illustrator_set_active_layer` |
| **Selection** | `illustrator_select_all`, `illustrator_deselect_all`, `illustrator_select_by_name` |
| **Power** | `illustrator_run_script` |

**Coordinates:** all positions and sizes are in **points** (= pixels at 72 dpi),
measured from the **top-left of the active artboard**, with **Y increasing downward**
— the intuitive convention for design tools. (The `run_script` helpers convert
from Illustrator's native Y-up global system.)

**Colors:** hex (`#FF7F00`), a common name (`red`, `blue`, `green`, …), or `none`.
Colors are automatically converted to RGB or CMYK to match the document.

### The `run_script` escape hatch

`illustrator_run_script` runs arbitrary ExtendScript. The code runs inside a
function — `return` a JSON-serializable value to get it back. Prelude helpers are
available: `__doc()`, `__color(hex)`, `__setPos(item, x, y)`, `__itemInfo(item)`,
`__abRect()`, `__activeAB(doc)`, `__style(item, opts)`.

```js
// e.g. count every text frame and return their contents
var d = __doc();
var out = [];
for (var i = 0; i < d.textFrames.length; i++) out.push(d.textFrames[i].contents);
return { count: out.length, texts: out };
```

---

## Safety notes

- Tools carry MCP **annotations** (`readOnlyHint`, `destructiveHint`, …) so clients
  can prompt before destructive actions (delete, close, `run_script`).
- `run_script` is powerful: it can modify/delete artwork and touch the file
  system. Prefer the specialized tools when they fit, and review scripts before
  approving them.
- The server only listens on stdio and never opens a network port.

---

## Troubleshooting

| Symptom | Fix |
|--------|-----|
| *"Not authorized to control Illustrator"* | Grant Automation permission (see above), then retry. |
| *"Could not reach Adobe Illustrator"* | Make sure Illustrator is installed and running. |
| *"No document is open"* | Create one with `illustrator_create_document` or open a file first. |
| Calls time out | Illustrator may be showing a modal dialog — bring it to the front and dismiss it. |
| Tools don't appear in the client | Check the absolute path in the config and restart the client. |

---

## Roadmap

- **Chat panel inside Illustrator** (UXP/CEP): a dockable panel with a chat box so
  you can talk to the assistant without leaving Illustrator. See
  [`docs/IN_APP_CHAT.md`](docs/IN_APP_CHAT.md) for the design and integration plan.
- More workflow tools (pathfinder, effects, symbols, swatches, batch export).
- Optional hosted / HTTP transport for remote ChatGPT connectors.

Contributions welcome — see [`CONTRIBUTING.md`](CONTRIBUTING.md).

---

## 🇮🇹 Guida rapida (Italiano)

Questo è un connettore che permette a **Claude, ChatGPT o Cursor di comandare Adobe
Illustrator** parlandogli in linguaggio naturale ("crea un poster A4, aggiungi un
rettangolo rosso e un titolo").

**Per usarlo:**

1. Installa **Node.js 18+** e assicurati di avere **Illustrator**.
2. Nel terminale:
   ```bash
   git clone https://github.com/gherardo200-glitch/illustrator-mcp.git
   cd illustrator-mcp
   npm install
   ```
3. Copia il percorso assoluto di `dist/index.js`.
4. Incollalo nella configurazione del tuo client (vedi **Claude Desktop** sopra).
5. Riavvia il client e chiedi: *"usa illustrator_get_status"* per verificare che
   funzioni. Su macOS, al primo utilizzo concedi il permesso di **automazione**.

Da lì in poi puoi chiedere di creare documenti, forme, testi, allineare, colorare,
esportare PNG/PDF e altro. Per operazioni avanzate c'è `illustrator_run_script`,
che esegue qualsiasi script di Illustrator.

---

## License

[MIT](LICENSE) © 2026
