# Using this connector with ChatGPT

ChatGPT can use MCP servers, but the exact path depends on your plan and the
current state of OpenAI's MCP support. Because this connector controls a **local**
copy of Illustrator, the server has to run on the **same machine** as Illustrator.

## Option A — Local MCP connector (ChatGPT desktop, developer/MCP mode)

If your ChatGPT desktop app exposes a local MCP / "developer mode" connector,
add a server that runs:

```
command: node
args:    ["/absolute/path/to/illustrator-mcp/dist/index.js"]
```

This is identical to the Claude Desktop setup — the server speaks standard MCP
over stdio, so any client that can launch a local stdio MCP process works.

## Option B — Remote (HTTP) connector + local tunnel

ChatGPT's hosted "connectors" expect a **remote** MCP server reachable over HTTPS.
Since Illustrator is local, you would:

1. Run this server behind an HTTP transport (on the roadmap — see the main README).
2. Expose `localhost` to the internet with a tunnel (e.g. `cloudflared`, `ngrok`).
3. Register that HTTPS URL as a custom connector in ChatGPT.

This works but adds security surface (you're exposing a machine that can script
Illustrator). Only do it on a trusted network, ideally with auth on the tunnel.

## Recommendation

For the smoothest experience today, use **Claude Desktop / Claude Code / Cursor**
with the stdio setup in the main README. ChatGPT support improves as OpenAI's MCP
client matures; Option A is the target once local MCP connectors are broadly
available in your ChatGPT build.

Regardless of the client, the tools, behavior, and permissions are the same.
