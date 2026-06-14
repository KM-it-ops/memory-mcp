import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readMemory, listMemory, memoryLinks, extractWikilinks } from "../src/memory.js";

let memDir: string;

beforeAll(() => {
  const root = mkdtempSync(join(tmpdir(), "mcp-read-"));
  memDir = join(root, "memory");
  mkdirSync(join(memDir, "project"), { recursive: true });
  mkdirSync(join(memDir, "reference"), { recursive: true });
  writeFileSync(
    join(memDir, "project", "alpha.md"),
    "---\nname: alpha\ndescription: Alpha fact.\nmetadata:\n  type: project\n---\n\nAlpha links to [[beta]] and [[ghost]].\n",
  );
  writeFileSync(
    join(memDir, "reference", "beta.md"),
    "---\nname: beta\ndescription: Beta fact.\nmetadata:\n  type: reference\n---\n\nBeta body.\n",
  );
});
afterAll(() => rmSync(join(memDir, ".."), { recursive: true, force: true }));

describe("extractWikilinks", () => {
  it("pulls [[targets]] and strips aliases", () => {
    expect(extractWikilinks("see [[a]] and [[b|alias]]")).toEqual(["a", "b"]);
  });
});

describe("readMemory", () => {
  it("reads a memory and resolves outbound links (resolved vs dangling)", () => {
    const r = readMemory(memDir, "alpha");
    expect(r.isOk()).toBe(true);
    const m = r._unsafeUnwrap();
    expect(m.type).toBe("project");
    expect(m.description).toBe("Alpha fact.");
    expect(m.body).toContain("Alpha links to");
    const beta = m.outboundLinks.find((l) => l.target === "beta");
    const ghost = m.outboundLinks.find((l) => l.target === "ghost");
    expect(beta?.rel).toBe("memory/reference/beta.md");
    expect(ghost?.rel).toBeNull();
  });

  it("errors not_found for a missing memory", () => {
    const r = readMemory(memDir, "nope");
    expect(r.isErr()).toBe(true);
    expect(r._unsafeUnwrapErr().code).toBe("not_found");
  });
});

describe("listMemory", () => {
  it("lists all memories, and filters by type", () => {
    expect(listMemory(memDir).map((e) => e.name).sort()).toEqual(["alpha", "beta"]);
    expect(listMemory(memDir, "project").map((e) => e.name)).toEqual(["alpha"]);
  });
});

describe("memoryLinks", () => {
  it("reports inbound and outbound neighbours", () => {
    const r = memoryLinks(memDir, "beta");
    expect(r.isOk()).toBe(true);
    const g = r._unsafeUnwrap();
    expect(g.inbound).toContain("alpha");
    expect(g.outbound).toEqual([]);
  });
});
