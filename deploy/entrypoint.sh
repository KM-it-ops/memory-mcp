#!/usr/bin/env bash
set -euo pipefail

: "${MEMORY_MCP_TOKEN:?MEMORY_MCP_TOKEN is required}"
: "${GITHUB_TOKEN:?GITHUB_TOKEN is required for private brain repo sync}"

BRAIN_REPO="${BRAIN_REPO:-KM-it-ops/brain}"
BRAIN_DIR_MOUNT="${CLAUDE_DIR:-/data/brain}"
SYNC_INTERVAL="${BRAIN_SYNC_INTERVAL_SEC:-120}"

clone_or_pull() {
  if [[ -d "${BRAIN_DIR_MOUNT}/.git" ]]; then
    git -C "${BRAIN_DIR_MOUNT}" pull --rebase --autostash origin main || true
  else
    mkdir -p "${BRAIN_DIR_MOUNT}"
    git clone "https://x-access-token:${GITHUB_TOKEN}@github.com/${BRAIN_REPO}.git" "${BRAIN_DIR_MOUNT}"
  fi
}

push_brain() {
  if [[ ! -d "${BRAIN_DIR_MOUNT}/.git" ]]; then return 0; fi
  git -C "${BRAIN_DIR_MOUNT}" config user.email "memory-mcp-hub@users.noreply.github.com"
  git -C "${BRAIN_DIR_MOUNT}" config user.name "memory-mcp-hub"
  if git -C "${BRAIN_DIR_MOUNT}" diff --quiet && git -C "${BRAIN_DIR_MOUNT}" diff --cached --quiet; then
    return 0
  fi
  git -C "${BRAIN_DIR_MOUNT}" add -A
  git -C "${BRAIN_DIR_MOUNT}" commit -m "hub-sync: $(date -u +%Y-%m-%dT%H%M%SZ)" || true
  git -C "${BRAIN_DIR_MOUNT}" push origin main || true
}

clone_or_pull

(
  while true; do
    sleep "${SYNC_INTERVAL}"
    clone_or_pull
  done
) &

(
  while true; do
    sleep 30
    push_brain
  done
) &

exec node node_modules/tsx/dist/cli.mjs src/http.ts
