import { describe, it, expect } from "vitest";
import type { Entry } from "../src/scan.js";
import { searchMemory } from "../src/search.js";

function entry(
  over: Partial<Entry> & { fileSlug: string; bucket: Entry["bucket"]; description?: string },
): Entry {
  return {
    rel: `memory/${over.bucket}/${over.fileSlug}.md`,
    absPath: `/x/${over.fileSlug}.md`,
    fileSlug: over.fileSlug,
    bucket: over.bucket,
    data:
      "data" in over
        ? (over.data ?? null)
        : {
            name: over.fileSlug,
            description: over.description ?? "desc",
            metadata: { type: over.bucket },
          },
    body: over.body ?? "",
    errors: over.errors ?? [],
  };
}

const corpus: Entry[] = [
  entry({ fileSlug: "hermes-rebuild", bucket: "feedback", data: { name: "hermes-rebuild", description: "Hermes update path", metadata: { type: "feedback" } }, body: "use hermes update then desktop force-build" }),
  entry({ fileSlug: "agentforge", bucket: "project", data: { name: "agentforge", description: "config framework", metadata: { type: "project" } }, body: "one spec many adapters, mentions hermes once" }),
  entry({ fileSlug: "broken", bucket: "user", data: null, errors: ["bad"], body: "hermes hermes hermes" }),
];

describe("searchMemory", () => {
  it("ranks a name/description match above a body-only mention", () => {
    const hits = searchMemory(corpus, { query: "hermes" });
    expect(hits.length).toBeGreaterThanOrEqual(2);
    expect(hits[0]?.name).toBe("hermes-rebuild");
  });

  it("filters by type", () => {
    const hits = searchMemory(corpus, { query: "hermes", type: "project" });
    expect(hits.every((h) => h.type === "project")).toBe(true);
    expect(hits.map((h) => h.name)).toContain("agentforge");
  });

  it("respects the limit", () => {
    const hits = searchMemory(corpus, { query: "hermes", limit: 1 });
    expect(hits).toHaveLength(1);
  });

  it("skips entries that failed validation (no data)", () => {
    const hits = searchMemory(corpus, { query: "hermes" });
    expect(hits.find((h) => h.name === "broken")).toBeUndefined();
  });

  it("returns nothing for an empty query", () => {
    expect(searchMemory(corpus, { query: "   " })).toEqual([]);
  });

  it("includes a snippet for context", () => {
    const hits = searchMemory(corpus, { query: "adapters" });
    expect(hits[0]?.snippet.toLowerCase()).toContain("adapters");
  });
});
