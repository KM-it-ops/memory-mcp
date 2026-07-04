# Deploy memory-mcp HTTP hub (Render)

1. Push this repo to GitHub (`KM-it-ops/memory-mcp`).
2. In [Render Dashboard](https://dashboard.render.com/) → **New** → **Blueprint** → connect `memory-mcp` repo.
3. Set secrets when prompted:
   - `MEMORY_MCP_TOKEN` — same value as `~/.config/memory-mcp/hub.env`
   - `GITHUB_TOKEN` — PAT with `repo` scope for private `KM-it-ops/brain`
4. Deploy. Note the service URL: `https://memory-mcp-hub.onrender.com`
5. Cloud Agents MCP (cursor.com/agents):

```json
{
  "memory": {
    "type": "http",
    "url": "https://YOUR-SERVICE.onrender.com/mcp",
    "headers": {
      "Authorization": "Bearer YOUR_MEMORY_MCP_TOKEN"
    }
  }
}
```

6. Point local Cursor at the same URL (see `register.md` HTTP section) so PC and cloud share one brain.

## Local hub (PC online)

```powershell
& "$env:USERPROFILE\.config\memory-mcp\start-hub.ps1"
```

Optional tunnel while testing: `npx localtunnel --port 41888`

## Brain sync

The hub clones `KM-it-ops/brain` (private). Writes commit+push every 30s; pulls every 120s.
On PC run `git pull` in `C:\AI\brain` or use existing brain hooks to stay in sync.
