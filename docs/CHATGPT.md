# Using this connector with ChatGPT

**Step-by-step activation (Italian):** see [`ATTIVAZIONE.md`](ATTIVAZIONE.md).

## How ChatGPT connects (the facts)

- **ChatGPT does not talk to a local stdio server directly.** It reaches MCP
  servers through **connectors**, which are called from OpenAI's side — so the
  server needs a reachable endpoint, not a local command.
- The clean, secure way to expose a **local** server (without opening a public
  port) is OpenAI's **Secure MCP Tunnel**: a small agent (`tunnel-client`) runs
  on your machine, makes an **outbound-only** HTTPS connection to OpenAI, and
  forwards requests to your MCP server — which it can reach **over stdio or HTTP**.
- Requires **Developer Mode** (ChatGPT Plus/Pro, or Business/Enterprise/Edu) and
  an **OpenAI Platform** account for the tunnel's API key + tunnel id.
- Works in the **ChatGPT desktop app** (and web). Write actions ask for confirmation.

## Two ways to point the tunnel at this connector

This server ships **both transports** from one codebase:

1. **stdio (no HTTP needed)** — let the tunnel launch the server directly:
   `tunnel-client init --sample sample_mcp_stdio_local --mcp-command "node /path/to/dist/index.js"`
2. **HTTP** — run `node dist/index.js --http` (listens on `http://127.0.0.1:3000/mcp`),
   then `tunnel-client init --sample sample_mcp_remote_no_auth --mcp-server-url http://127.0.0.1:3000/mcp`.

Full commands and the ChatGPT-side connector step are in
[`ATTIVAZIONE.md`](ATTIVAZIONE.md). Official reference:
[Secure MCP Tunnel guide](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels).

## Simpler alternative

If you don't specifically need ChatGPT, **Claude Desktop / Claude Code / Cursor**
use the stdio transport directly — no tunnel, no extra account. See the main README.
