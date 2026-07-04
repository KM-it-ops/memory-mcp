import { z } from "zod";

/**
 * Minimal YAML frontmatter parser tailored to the memory-file shape:
 *   name / description / metadata.type (+ optional title, updated, tags[], links[]).
 * Deliberately dependency-free (mirrors AgentForge's miniYaml convention) — supports
 * scalars, one level of nesting (metadata:), block lists, and inline [a, b] arrays.
 */

export const BUCKETS = ["user", "feedback", "project", "reference"] as const;
export type BucketType = (typeof BUCKETS)[number];

export const FrontmatterSchema = z.object({
  name: z.string().min(1),
  title: z.string().min(1).optional(),
  description: z.string().min(1),
  metadata: z.object({
    type: z.enum(BUCKETS),
  }),
  updated: z.string().optional(),
  tags: z.array(z.string()).optional(),
  links: z.array(z.string()).optional(),
});

export type Frontmatter = z.infer<typeof FrontmatterSchema>;

function stripQuotes(s: string): string {
  const t = s.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
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

export interface ParsedFile {
  data: Record<string, unknown>;
  body: string;
  hasFrontmatter: boolean;
}

export function parseFrontmatter(raw: string): ParsedFile {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: raw, hasFrontmatter: false };

  const block = match[1];
  const body = match[2];
  const data: Record<string, unknown> = {};
  const lines = block.split(/\r?\n/);

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      i++;
      continue;
    }
    const top = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!top) {
      i++;
      continue;
    }
    const key = top[1];
    const inlineVal = top[2];

    if (inlineVal !== "") {
      data[key] = parseScalar(inlineVal);
      i++;
      continue;
    }

    // No inline value: could be a nested map (indented key: value) or a block list (indented - item)
    const child: Record<string, unknown> = {};
    const list: string[] = [];
    let j = i + 1;
    while (j < lines.length && /^\s+\S/.test(lines[j])) {
      const childLine = lines[j];
      const listItem = childLine.match(/^\s*-\s+(.*)$/);
      const kv = childLine.match(/^\s+([A-Za-z0-9_]+):\s*(.*)$/);
      if (listItem) {
        list.push(stripQuotes(listItem[1]));
      } else if (kv) {
        child[kv[1]] = parseScalar(kv[2]);
      }
      j++;
    }
    data[key] = list.length > 0 ? list : child;
    i = j;
  }

  return { data, body, hasFrontmatter: true };
}
