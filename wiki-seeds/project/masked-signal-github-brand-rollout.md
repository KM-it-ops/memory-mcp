---
name: masked-signal-github-brand-rollout
title: Masked Signal GitHub Brand Rollout
description: GitHub profile brand automation for KM-it-ops — workflows, tokens, bio sync, pins gap, June 2026.
metadata:
  type: project
tags:
  - github
  - portfolio
  - masked-signal
  - automation
  - soc
---

## Summary

Unified public brand **Masked Signal** across GitHub profile README, portfolio site (`KM-it-ops.github.io`), and LinkedIn copy pack. Positioning lead: **SOC / Detection Engineering / Security Automation** (not "AI Systems Architect").

## What was automated (KM-it-ops.github.io Actions)

| Workflow | Secret | Effect |
| --- | --- | --- |
| `sync-profile-readme.yml` | `PROFILE_REPO_TOKEN` | Copies `profile-repo/README.md` + banner → `KM-it-ops/KM-it-ops` |
| `sync-github-profile-settings.yml` | `PROFILE_REPO_TOKEN` or `GITHUB_USER_TOKEN` | PATCH `/user` — name, bio, blog, location, hireable |

**Bio API limit:** 160 characters max. Multi-line bios return HTTP 422.

**Current live bio (API):**
`Security+ · SOC / Detection Engineering · MITRE ATT&CK. AgentForge, log detection, vuln workflows. Charlotte NC / Remote.`

## Profile README (live)

- Repo: `KM-it-ops/KM-it-ops`
- Source of truth: `profile-repo/` in `KM-it-ops.github.io`
- Deploy script: `scripts/deploy-profile-readme.sh`
- Banner: `assets/profile-banner.svg` (GitHub header)

## Cannot automate via API

- **Pinned repositories** — no GitHub REST/GraphQL mutation exists. Manual: profile → Customize your pins.
- **Pin order:** ATT&CKLens Benchmark → AgentForge → memory-mcp → security-log-anomaly-detection → phishing-email-classifier → KM-it-ops.github.io
- Guide: `docs/PIN_REPOS.md`

## Token setup (one-time)

Fine-grained PAT on `KM-it-ops/KM-it-ops`:
- **Contents:** Read and write (profile README sync)
- **Account → Profile:** Read and write (bio/name/location sync)

Add as repo secret `PROFILE_REPO_TOKEN` on `KM-it-ops.github.io`.

Docs: `docs/PROFILE_SYNC_ONE_TIME.md`, `docs/GITHUB_USER_TOKEN.md`

## Portfolio / LinkedIn assets

| Asset | Path |
| --- | --- |
| LinkedIn banner PNG | `assets/linkedin-banner.png` (1584×396) |
| Profile banner SVG | `assets/profile-banner.svg` |
| LinkedIn copy pack | `linkedin/` (`HEADLINE.md`, `ABOUT.md`, `POSTS.md`, `QUICK_APPLY.md`) |
| Brand tokens | `DESIGN.md`, `tokens.json` |
| Master checklist | `docs/BRAND_ROLLOUT.md` |

## Cloud agent limits (June 2026)

- `cursor[bot]` cannot PATCH `/user` or push to `KM-it-ops/KM-it-ops` directly.
- GitHub Actions with user PAT secrets works.
- Browser automation on cloud VM is not visible to user — use direct URLs on their machine.
- LinkedIn requires user login in their own browser.

## Import into shared brain

From a machine with `memory-mcp` + `tools/brain` installed:

```bash
# Copy seed into brain vault (CLAUDE_DIR defaults to ~/.claude or C:\AI\KM-IT-OPS)
cp memory-seeds/project/masked-signal-github-brand-rollout.md "$CLAUDE_DIR/memory/project/"
npm --prefix "$BRAIN_DIR" run index
npm --prefix "$BRAIN_DIR" run hot
npm --prefix "$BRAIN_DIR" run lint
```

Or call MCP tool `memory_write` with the same `name`, `type: project`, `description`, and body (excluding frontmatter).

## Related repos

- [[agentforge]] — flagship framework; lead differentiator with ATT&CKLens benchmark
- Portfolio site: https://github.com/KM-it-ops/KM-it-ops.github.io
- Profile README: https://github.com/KM-it-ops/KM-it-ops
- memory-mcp: https://github.com/KM-it-ops/memory-mcp
