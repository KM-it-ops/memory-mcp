import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

export type Severity = "critical" | "high" | "normal";

export interface CleanupAction {
  severity: Severity;
  title: string;
  detail: string;
  /** Suggested, non-executed command(s). */
  commands: string[];
}

function git(claudeDir: string, args: string[]): { ok: boolean; out: string } {
  try {
    const out = execFileSync("git", args, {
      cwd: claudeDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return { ok: true, out: out.trim() };
  } catch {
    return { ok: false, out: "" };
  }
}

function isTracked(claudeDir: string, rel: string): boolean {
  const r = git(claudeDir, ["ls-files", "--error-unmatch", rel]);
  return r.ok;
}

function isIgnored(claudeDir: string, rel: string): boolean {
  // check-ignore exits 0 when the path IS ignored
  return git(claudeDir, ["check-ignore", "-q", rel]).ok;
}

function sizeKB(path: string): number | null {
  try {
    return Math.round(statSync(path).size / 1024);
  } catch {
    return null;
  }
}

/**
 * Compute proposed (NOT executed) cleanup actions for ~/.claude.
 * Read-only: shells git for tracking/ignore facts. Nothing is mutated.
 */
export function computeCleanup(claudeDir: string): CleanupAction[] {
  const actions: CleanupAction[] = [];
  const gitOk = git(claudeDir, ["rev-parse", "--is-inside-work-tree"]).ok;

  if (!gitOk) {
    actions.push({
      severity: "high",
      title: "No git repo detected",
      detail:
        "~/.claude is not a git work tree from this path; reversibility safety net is unavailable. Verify before any mutation.",
      commands: [],
    });
    return actions;
  }

  // 1. Secret hygiene — .credentials.json
  const cred = ".credentials.json";
  if (existsSync(join(claudeDir, cred))) {
    const tracked = isTracked(claudeDir, cred);
    const ignored = isIgnored(claudeDir, cred);
    if (tracked || !ignored) {
      const kb = sizeKB(join(claudeDir, cred));
      actions.push({
        severity: "critical",
        title: `Secret file ${tracked ? "TRACKED in git" : "not gitignored"}: ${cred}`,
        detail:
          `${cred}${kb !== null ? ` (${kb}KB)` : ""} holds credentials. ` +
          `${tracked ? "It is committed to history. " : ""}` +
          "Untrack going forward and ignore it. (History rewrite is a separate, Boss-approved step.)",
        commands: [
          tracked ? `git rm --cached ${cred}` : "",
          `echo "${cred}" >> .gitignore   # if not already present`,
        ].filter(Boolean),
      });
    }
  }

  // 2. Ephemeral caches that should be ignored
  for (const f of ["mcp-needs-auth-cache.json", ".last-cleanup"]) {
    if (existsSync(join(claudeDir, f)) && isTracked(claudeDir, f)) {
      actions.push({
        severity: "normal",
        title: `Ephemeral file tracked: ${f}`,
        detail: "Regenerated automatically; should be untracked + ignored to stop churn in git status.",
        commands: [`git rm --cached ${f}`, `echo "${f}" >> .gitignore`],
      });
    }
  }

  // 3. Running log polluting the brain folder
  const sessionLog = "memory/feedback/session-log.md";
  if (existsSync(join(claudeDir, sessionLog))) {
    const kb = sizeKB(join(claudeDir, sessionLog));
    actions.push({
      severity: "high",
      title: `Running log inside memory/: ${sessionLog}`,
      detail:
        `${kb !== null ? `${kb}KB ` : ""}raw session log is not an atomic memory. ` +
        "Extract any durable learnings into memory/feedback/*.md (CAPTURE), then move the raw log to sessions-archive/.",
      commands: [
        "# after CAPTURE:",
        "mkdir sessions-archive 2>$null; git mv memory/feedback/session-log.md sessions-archive/session-log.md",
      ],
    });
  }

  // 4. Loose top-level session.log
  const topLog = "session.log";
  if (existsSync(join(claudeDir, topLog))) {
    const kb = sizeKB(join(claudeDir, topLog));
    actions.push({
      severity: "normal",
      title: `Archive top-level ${topLog}`,
      detail: `${kb !== null ? `${kb}KB ` : ""}(already matched by *.log ignore) — move physically to sessions-archive/ to declutter root.`,
      commands: ["mkdir sessions-archive 2>$null; Move-Item session.log sessions-archive/"],
    });
  }

  return actions;
}
