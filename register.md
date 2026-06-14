# Registering memory-mcp in the three clients

The server launches over stdio with this **absolute, cwd-independent** command
(verified to keep stdout clean for the MCP protocol; banner goes to stderr):

```
command: node
args:
  - C:\Users\<you>\.claude\tools\memory-mcp\node_modules\tsx\dist\cli.mjs
  - C:\Users\<you>\.claude\tools\memory-mcp\src\server.ts
```

No env is required — `CLAUDE_DIR` defaults to `~/.claude` and `BRAIN_DIR` to
`~/.claude/tools/brain`.

> **Before editing any live config, copy it aside** (e.g. `config.toml.bak`).

## 1. Claude Code

```
claude mcp add memory -- node "C:\Users\<you>\.claude\tools\memory-mcp\node_modules\tsx\dist\cli.mjs" "C:\Users\<you>\.claude\tools\memory-mcp\src\server.ts"
```

(or the JSON equivalent under `mcpServers` in the Claude Code MCP config).

## 2. Cursor — `~/.cursor/mcp.json`

```json
{
  "mcpServers": {
    "memory": {
      "command": "node",
      "args": [
        "C:\\Users\\<you>\\.claude\\tools\\memory-mcp\\node_modules\\tsx\\dist\\cli.mjs",
        "C:\\Users\\<you>\\.claude\\tools\\memory-mcp\\src\\server.ts"
      ]
    }
  }
}
```

## 3. Codex — `~/.codex/config.toml`

Matches the existing `[mcp_servers.obsidian]` / `[mcp_servers.neon-browser]` shape:

```toml
[mcp_servers.memory]
command = "node"
args = [
  'C:\Users\<you>\.claude\tools\memory-mcp\node_modules\tsx\dist\cli.mjs',
  'C:\Users\<you>\.claude\tools\memory-mcp\src\server.ts',
]
```

## Verify the cross-client round-trip

1. Restart each client so it spawns the server.
2. In **Claude Code**, call `memory_write` with a throwaway memory
   (e.g. `name: roundtrip-probe`, `type: reference`, a unique description).
3. In **Cursor** and **Codex**, call `memory_search "roundtrip-probe"` —
   each must return the memory written from Claude Code.
4. Delete the probe (`~/.claude/memory/reference/roundtrip-probe.md`) and
   re-run `npm --prefix ~/.claude/tools/brain run index` to clean the index.

> Live note: the three configs above now also set `CLAUDE_DIR=C:\AI\KM-IT-OPS`
> + `BRAIN_DIR=C:\Users\<you>\.claude\tools\brain` so all clients read the
> unified vault brain (Codex's live config is `C:\AI\CodexHome\config.toml`).

---

# Universal HTTP hub (any MCP client, incl. remote)

The same server can run as ONE persistent daemon over Streamable HTTP, so any
MCP client — not just the three above, and not just on this machine — can
connect by URL. stdio (above) stays available; the hub is additive.

## Start the hub

```powershell
$env:MEMORY_MCP_TOKEN = '<a long random token>'   # REQUIRED; server refuses to start without it
$env:CLAUDE_DIR       = 'C:\AI\KM-IT-OPS'
$env:BRAIN_DIR        = 'C:\Users\<you>\.claude\tools\brain'
# optional: $env:MEMORY_MCP_HOST='127.0.0.1'  $env:MEMORY_MCP_PORT='41888'
npm --prefix C:\Users\<you>\.claude\tools\memory-mcp run serve:http
```

Generate a token: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
Keep it out of git (env var or a gitignored `.env`).

**Security defaults:** binds `127.0.0.1` only (localhost). Every request needs
`Authorization: Bearer <token>` (constant-time compared; fails closed if no
token is set). To expose on the LAN, set `MEMORY_MCP_HOST=0.0.0.0` — you get a
loud stderr warning; only do this with a strong token (and ideally a tunnel/VPN,
not a raw open port). Concurrent writes from multiple clients are serialized by
an internal lock so the index regen can't race.

## Connect a client

Endpoint: `http://127.0.0.1:41888/mcp` (Streamable HTTP), header
`Authorization: Bearer <token>`.

- **Claude Code:** `claude mcp add memory-hub --transport http http://127.0.0.1:41888/mcp --header "Authorization: Bearer <token>"`
- **Any MCP client:** point its Streamable-HTTP transport at the URL above with the bearer header.

> Don't register the hub *and* the stdio `memory` server in the same client —
> they serve the same brain; pick one per client (stdio for purely-local, the
> hub when you want one shared daemon / remote reach).
