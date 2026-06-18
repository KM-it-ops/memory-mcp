# Memory seeds

Brain-format memories (`memory/<bucket>/<name>.md`) maintained in the portfolio repo for import into the shared-brain vault via [memory-mcp](https://github.com/KM-it-ops/memory-mcp).

## Import locally

```bash
# Default brain: ~/.claude (or set CLAUDE_DIR=C:\AI\KM-IT-OPS on Windows)
./scripts/import-memory-seed.sh masked-signal-github-brand-rollout
```

## Import via MCP (Option A)

In any client with `memory` MCP connected, call `memory_write` using `memory-seeds/memory-write-payload.json` or these fields:

- `name`: `masked-signal-github-brand-rollout`
- `type`: `project`
- `description`: `GitHub profile brand automation for KM-it-ops — workflows, tokens, bio sync, pins gap, June 2026.`
- `title`: `Masked Signal GitHub Brand Rollout`
- `tags`: `github`, `portfolio`, `masked-signal`, `automation`, `soc`
- `body`: content below frontmatter in `project/masked-signal-github-brand-rollout.md`

**One command (memory-mcp repo, uses same logic as `memory_write`):**

```bash
cd ~/.claude/tools/memory-mcp
CLAUDE_DIR=C:/AI/KM-IT-OPS npx tsx scripts/write-wiki-seed.mts masked-signal-github-brand-rollout
```

## Seeds

| Name | Bucket | Description |
| --- | --- | --- |
| `masked-signal-github-brand-rollout` | project | GitHub profile brand automation, tokens, workflows, pins gap |
