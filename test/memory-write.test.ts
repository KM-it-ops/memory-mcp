import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join } from "node:path";
import { writeMemory } from "../src/memory.js";

// Reindex/lint is delegated to the REAL brain toolkit, pointed (via CLAUDE_DIR)
// at an isolated temp root — never the real brain.
const BRAIN_DIR = join(homedir(), ".claude", "tools", "brain");
let claudeDir: string;

beforeEach(() => {
  claudeDir = mkdtempSync(join(tmpdir(), "mcp-write-"));
  for (const b of ["user", "feedback", "project", "reference"]) {
    mkdirSync(join(claudeDir, "memory", b), { recursive: true });
  }
});
afterEach(() => rmSync(claudeDir, { recursive: true, force: true }));

describe("writeMemory", () => {
  it("writes a valid memory and regenerates the index (lint clean)", () => {
    const r = writeMemory(BRAIN_DIR, claudeDir, {
      name: "test-fact",
      type: "project",
      description: "A test fact for the suite.",
      body: "This is the body of a test fact.",
    });
    expect(r.isOk()).toBe(true);
    const file = join(claudeDir, "memory", "project", "test-fact.md");
    expect(existsSync(file)).toBe(true);
    // index regenerated and includes the new memory
    const index = readFileSync(join(claudeDir, "MEMORY.md"), "utf8");
    expect(index).toContain("test-fact");
    // file is valid + reloadable
    expect(readFileSync(file, "utf8")).toContain("type: project");
  });

  it("rejects an unsafe slug before writing anything", () => {
    const r = writeMemory(BRAIN_DIR, claudeDir, {
      name: "../escape",
      type: "user",
      description: "d",
      body: "b",
    });
    expect(r.isErr()).toBe(true);
    expect(r._unsafeUnwrapErr().code).toBe("invalid");
    expect(existsSync(join(claudeDir, "MEMORY.md"))).toBe(false);
  });

  it("fails the write when the body trips the brain secret-lint (file left for inspection)", () => {
    const r = writeMemory(BRAIN_DIR, claudeDir, {
      name: "leaky",
      type: "reference",
      description: "Has a secret.",
      body: "token sk-abcdefghijklmnopqrstuvwxyz012345 leaked here",
    });
    expect(r.isErr()).toBe(true);
    const e = r._unsafeUnwrapErr();
    expect(e.message.toLowerCase()).toContain("lint");
    // file left on disk for the human to inspect
    expect(existsSync(join(claudeDir, "memory", "reference", "leaky.md"))).toBe(true);
  });
}, 60_000);
