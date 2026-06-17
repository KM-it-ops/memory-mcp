# Memory seeds

Brain-format memories (`memory/<bucket>/<name>.md`) maintained in the portfolio repo for import into the shared-brain vault via [memory-mcp](https://github.com/KM-it-ops/memory-mcp).

## Import locally

```bash
# Default brain: ~/.claude (or set CLAUDE_DIR=C:\AI\KM-IT-OPS on Windows)
./scripts/import-memory-seed.sh masked-signal-github-brand-rollout
```

## Import via MCP

In any client with `memory` MCP connected, call `memory_write` using fields from the seed file frontmatter and body (content below the `---` block).

## Seeds

| Name | Bucket | Description |
| --- | --- | --- |
| `masked-signal-github-brand-rollout` | project | GitHub profile brand automation, tokens, workflows, pins gap |
