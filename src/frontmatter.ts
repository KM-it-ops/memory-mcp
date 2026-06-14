import { z } from "zod";

/**
 * Frontmatter for ~/.claude/memory files. Mirrors the shape enforced by
 * tools/brain (name / description / metadata.type, + optional title/tags/links).
 * The parser is a faithful, strict-typed port of brain's miniYAML reader; a
 * corpus test (frontmatter-corpus.test.ts) asserts parity against the real brain.
 */

export const BUCKETS = ["user", "feedback", "project", "reference"] as const;
export type BucketType = (typeof BUCKETS)[number];

export const FrontmatterSchema = z.object({
  name: z.string().min(1),
  title: z.string().min(1).optional(),
  description: z.string().min(1),
  metadata: z.object({ type: z.enum(BUCKETS) }),
  updated: z.string().optional(),
  tags: z.array(z.string()).optional(),
  links: z.array(z.string()).optional(),
});

export type Frontmatter = z.infer<typeof FrontmatterSchema>;

export interface ParsedFile {
  data: Record<string, unknown>;
  body: string;
  hasFrontmatter: boolean;
}

function stripQuotes(s: string): string {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

function parseScalar(raw: string): string | string[] {
  const v = raw.trim();
  if (v.startsWith("[") && v.endsWith("]")) {
    const inner = v.slice(1, -1).trim();
    if (inner === "") return [];
    return inner.split(",").map(stripQuotes);
  }
  return stripQuotes(v);
}

export function parseFrontmatter(raw: string): ParsedFile {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: raw, hasFrontmatter: false };

  const block = match[1] ?? "";
  const body = match[2] ?? "";
  const data: Record<string, unknown> = {};
  const lines = block.split(/\r?\n/);

  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (line.trim() === "") {
      i++;
      continue;
    }
    const top = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!top) {
      i++;
      continue;
    }
    const key = top[1] as string;
    const inlineVal = top[2] ?? "";

    if (inlineVal !== "") {
      data[key] = parseScalar(inlineVal);
      i++;
      continue;
    }

    // No inline value: nested map (indented key: value) or block list (indented - item).
    const child: Record<string, unknown> = {};
    const list: string[] = [];
    let j = i + 1;
    while (j < lines.length && /^\s+\S/.test(lines[j] ?? "")) {
      const childLine = lines[j] ?? "";
      const listItem = childLine.match(/^\s*-\s+(.*)$/);
      const kv = childLine.match(/^\s+([A-Za-z0-9_]+):\s*(.*)$/);
      if (listItem) {
        list.push(stripQuotes(listItem[1] ?? ""));
      } else if (kv) {
        child[kv[1] as string] = parseScalar(kv[2] ?? "");
      }
      j++;
    }
    data[key] = list.length > 0 ? list : child;
    i = j;
  }

  return { data, body, hasFrontmatter: true };
}

export interface MemoryInput {
  name: string;
  description: string;
  type: BucketType;
  title?: string;
  tags?: string[];
}

/** Serialize a memory to the canonical brain file format (frontmatter + body). */
export function serializeMemory(input: MemoryInput, body: string): string {
  const lines: string[] = ["---", `name: ${input.name}`];
  if (input.title !== undefined) lines.push(`title: ${input.title}`);
  lines.push(`description: ${input.description}`);
  lines.push("metadata:", `  type: ${input.type}`);
  if (input.tags !== undefined && input.tags.length > 0) {
    lines.push("tags:");
    for (const tag of input.tags) lines.push(`  - ${tag}`);
  }
  lines.push("---", "");
  return `${lines.join("\n")}\n${body.trim()}\n`;
}

/** Safe memory slug: lowercase kebab, no path separators, no traversal. */
export function isValidSlug(name: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(name);
}
