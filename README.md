# memory-mcp — shared-brain MCP server

A local stdio [MCP](https://modelcontextprotocol.io) server over `~/.claude/memory`.
Exposes the LLM-Wiki brain (read / search / write) so a memory written in **any**
agent — Claude Code, Cursor, Codex — is readable and searchable in all three.
One brain, three clients, file-backed, no external service.

## Tools

| Tool | What it does |
|------|--------------|
| `memory_search` | Text + frontmatter ranking over name/description/tags/body (+ bucket filter, limit). |
| `memory_read` | One memory by name → frontmatter + body + resolved outbound `[[wikilinks]]`. |
| `memory_list` | List memories (name, type, description), optional bucket filter. |
| `memory_links` | Inbound + outbound wikilink neighbours for a memory. |
| `memory_write` | Create/update a memory, regenerate `MEMORY.md` + `hot.md`, run the brain lint. A failed lint fails the write (file left for inspection). |

## Architecture

- **Standalone** TypeScript (ESM, strict + `exactOptionalPropertyTypes`), run via `tsx`.
- Reads use a strict-typed parser/scanner; a corpus-parity test asserts agreement
  with the real brain so frontmatter never drifts.
- Writes delegate index/hot/lint to the existing `~/.claude/tools/brain` toolkit
  (subprocess, `CLAUDE_DIR`-scoped) — brain's exact logic, no source coupling.
- Search is text + frontmatter only (no embeddings in v1).

## Config

- `CLAUDE_DIR` — brain root (default `~/.claude`); `<CLAUDE_DIR>/memory` holds the buckets.
- `BRAIN_DIR` — `tools/brain` checkout (default `<CLAUDE_DIR>/tools/brain`).

## Run

```
node node_modules/tsx/dist/cli.mjs src/server.ts   # stdio MCP server (stdout = MCP channel)
npm test        # vitest
npm run typecheck
```

Registration in Claude Code / Cursor / Codex: see [register.md](register.md).
