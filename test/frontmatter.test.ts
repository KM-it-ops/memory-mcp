import { describe, it, expect } from "vitest";
import {
  parseFrontmatter,
  serializeMemory,
  isValidSlug,
  FrontmatterSchema,
} from "../src/frontmatter.js";

describe("parseFrontmatter", () => {
  it("parses the canonical memory shape", () => {
    const raw =
      "---\nname: second-brain\ntitle: Second Brain\ndescription: A self-indexing wiki.\nmetadata:\n  type: project\n---\n\n# Body\ntext";
    const p = parseFrontmatter(raw);
    expect(p.hasFrontmatter).toBe(true);
    expect(p.data.name).toBe("second-brain");
    expect(p.data.title).toBe("Second Brain");
    expect(p.data.description).toBe("A self-indexing wiki.");
    expect((p.data.metadata as { type: string }).type).toBe("project");
    expect(p.body.trimStart().startsWith("# Body")).toBe(true);
    expect(FrontmatterSchema.safeParse(p.data).success).toBe(true);
  });

  it("parses inline arrays and block lists", () => {
    const inline = parseFrontmatter("---\nname: x\ndescription: d\nmetadata:\n  type: user\ntags: [a, b]\n---\nbody");
    expect(inline.data.tags).toEqual(["a", "b"]);
    const block = parseFrontmatter("---\nname: x\ndescription: d\nmetadata:\n  type: user\ntags:\n  - a\n  - b\n---\nbody");
    expect(block.data.tags).toEqual(["a", "b"]);
  });

  it("reports no frontmatter when absent", () => {
    const p = parseFrontmatter("# just a body\nno frontmatter");
    expect(p.hasFrontmatter).toBe(false);
    expect(p.body).toBe("# just a body\nno frontmatter");
  });
});

describe("serializeMemory", () => {
  it("round-trips through parseFrontmatter", () => {
    const out = serializeMemory(
      { name: "my-fact", description: "One line desc.", type: "feedback" },
      "Body line one.\n",
    );
    const p = parseFrontmatter(out);
    expect(p.data.name).toBe("my-fact");
    expect(p.data.description).toBe("One line desc.");
    expect((p.data.metadata as { type: string }).type).toBe("feedback");
    expect(FrontmatterSchema.safeParse(p.data).success).toBe(true);
    expect(p.body.trim()).toBe("Body line one.");
  });

  it("includes title and tags only when provided", () => {
    const withExtras = serializeMemory(
      { name: "n", description: "d", type: "reference", title: "T", tags: ["x", "y"] },
      "b",
    );
    expect(withExtras).toContain("title: T");
    expect(withExtras).toContain("tags:");
    const minimal = serializeMemory({ name: "n", description: "d", type: "reference" }, "b");
    expect(minimal).not.toContain("title:");
    expect(minimal).not.toContain("tags:");
  });

  it("emits a leading --- and a blank line before the body", () => {
    const out = serializeMemory({ name: "n", description: "d", type: "user" }, "Body.");
    expect(out.startsWith("---\n")).toBe(true);
    expect(out).toContain("---\n\nBody.");
  });
});

describe("isValidSlug", () => {
  it("accepts kebab slugs, rejects traversal and unsafe names", () => {
    expect(isValidSlug("hermes-rebuild-process")).toBe(true);
    expect(isValidSlug("a1")).toBe(true);
    expect(isValidSlug("../escape")).toBe(false);
    expect(isValidSlug("with/slash")).toBe(false);
    expect(isValidSlug("UPPER")).toBe(false);
    expect(isValidSlug("")).toBe(false);
    expect(isValidSlug("-leading")).toBe(false);
  });
});
