import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join } from "node:path";
import { scanMemory } from "../src/scan.js";

describe("scanMemory (temp fixture)", () => {
  let root: string;
  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "mcp-scan-"));
    mkdirSync(join(root, "project"), { recursive: true });
    mkdirSync(join(root, "user"), { recursive: true });
    writeFileSync(
      join(root, "project", "good.md"),
      "---\nname: good\ndescription: A valid memory.\nmetadata:\n  type: project\n---\n\nbody\n",
    );
    // name mismatch (frontmatter name != filename) -> validation error
    writeFileSync(
      join(root, "user", "mismatch.md"),
      "---\nname: wrong-name\ndescription: d\nmetadata:\n  type: user\n---\n\nbody\n",
    );
  });
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it("returns validated entries for well-formed files", () => {
    const entries = scanMemory(root);
    const good = entries.find((e) => e.fileSlug === "good");
    expect(good).toBeDefined();
    expect(good?.errors).toEqual([]);
    expect(good?.data?.name).toBe("good");
    expect(good?.bucket).toBe("project");
    expect(good?.rel).toBe("memory/project/good.md");
  });

  it("flags name/filename mismatch as an error", () => {
    const entries = scanMemory(root);
    const bad = entries.find((e) => e.fileSlug === "mismatch");
    expect(bad?.errors.some((m) => m.includes("name"))).toBe(true);
  });
});

describe("scanMemory corpus parity (real brain, read-only)", () => {
  const memDir = join(homedir(), ".claude", "memory");
  it.runIf(existsSync(memDir))(
    "parses every real memory file with zero validation errors",
    () => {
      const entries = scanMemory(memDir);
      expect(entries.length).toBeGreaterThan(0);
      const withErrors = entries.filter((e) => e.errors.length > 0);
      expect(withErrors.map((e) => `${e.rel}: ${e.errors.join("; ")}`)).toEqual([]);
    },
  );
});
