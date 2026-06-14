import { execSync } from "node:child_process";

export interface ReindexResult {
  ok: boolean;
  /** Combined output of the lint step (for surfacing to the caller). */
  lintOutput: string;
}

/**
 * Delegate index/hot/lint to the existing tools/brain toolkit, pointed at
 * `claudeDir` via the CLAUDE_DIR env var (verified to override brain's default).
 * Reuses brain's exact logic without coupling our typecheck to its source.
 */
export function reindexAndLint(brainDir: string, claudeDir: string): ReindexResult {
  const env = { ...process.env, CLAUDE_DIR: claudeDir };
  const run = (cmd: string): string =>
    execSync(`npm --prefix "${brainDir}" run ${cmd}`, {
      env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });

  run("index");
  run("hot");
  try {
    const out = run("lint");
    return { ok: true, lintOutput: out };
  } catch (e) {
    // brain lint exits 1 on any error; execSync throws with captured stdout.
    const err = e as { stdout?: string | Buffer; stderr?: string | Buffer };
    const out = `${err.stdout?.toString() ?? ""}${err.stderr?.toString() ?? ""}`;
    return { ok: false, lintOutput: out };
  }
}
