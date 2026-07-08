# Roadmap: a chat panel inside Illustrator

Goal: a dockable panel *inside* Illustrator with a chat box, so a user can talk to
the assistant without switching apps. This document sketches the design; it is not
yet implemented.

## The pieces

Illustrator plugins are built with one of two UI stacks:

- **UXP** (modern; Illustrator 26.4+ / 2022+) — HTML/JS/CSS panels, the recommended path.
- **CEP** (legacy) — HTML panels via CEF; broader version coverage but deprecated.

A chat panel needs three things:

1. **A panel UI** (UXP/CEP) — a text input + message list.
2. **An LLM** — the panel sends the conversation to a model (Anthropic/OpenAI API,
   or a local relay) and receives tool calls / text.
3. **A tool executor** — the model's tool calls must reach Illustrator. Inside a
   panel you can call the ExtendScript/UXP API **directly**, so you can reuse the
   *tool definitions and ExtendScript bodies* from this repo (`src/jsx.ts`,
   `src/tools/*`) with no MCP transport in between.

## Two viable architectures

### 1. Panel → local MCP server (reuse everything)

```
UXP panel  ──HTTP/WebSocket──►  a thin local host that speaks to an LLM
                                and calls THIS MCP server's tools
```

Pros: the panel stays dumb; all Illustrator logic + tools live here and are shared
with the Claude/ChatGPT experience. Cons: needs a small local host process and an
API key.

### 2. Self-contained panel (no MCP)

```
UXP panel  ──►  LLM API (with tool schemas)  ──►  panel runs ExtendScript locally
```

Pros: single artifact, no external process. Cons: duplicates the tool layer inside
the panel; API key handling lives in the panel.

**Recommended:** start from architecture #1 and factor the tool definitions in
`src/tools/*` so both the MCP server and the panel host import the same bodies.

## Packaging & distribution

- UXP plugins are packaged as `.ccx` and distributed via Adobe Exchange or shared
  as a developer build (UDT — UXP Developer Tool).
- Requires an Adobe developer account; production distribution needs review.

## Minimum viable version

1. UXP panel with an input box and a message log.
2. On submit, POST the conversation + this repo's tool schemas to an LLM.
3. For each returned tool call, execute the matching ExtendScript body and feed the
   result back to the model.
4. Render the assistant's text in the panel.

Until this lands, the same capabilities are fully available today by chatting in
Claude/ChatGPT/Cursor with the MCP server — you just do it in the assistant's
window instead of an Illustrator panel.
