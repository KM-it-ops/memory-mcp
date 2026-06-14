import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BUCKETS,
  type BucketType,
  type Frontmatter,
  FrontmatterSchema,
  parseFrontmatter,
} from "./frontmatter.js";

export interface Entry {
  /** Repo-relative posix path, e.g. memory/project/agentforge.md */
  rel: string;
  absPath: string;
  /** filename without the .md extension */
  fileSlug: string;
  bucket: BucketType;
  /** Validated frontmatter, or null when the file failed validation */
  data: Frontmatter | null;
  body: string;
  errors: string[];
}

/**
 * Walk memory/{user,feedback,project,reference}/*.md and parse + validate each
 * file. Files directly under memory/ (hot.md etc.) are intentionally ignored.
 * Faithful port of tools/brain's scan — parity asserted by scan.test.ts.
 */
export function scanMemory(memoryDir: string): Entry[] {
  const out: Entry[] = [];

  for (const bucket of BUCKETS) {
    const dir = join(memoryDir, bucket);
    if (!existsSync(dir)) continue;

    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .sort();

    for (const file of files) {
      const absPath = join(dir, file);
      const fileSlug = file.replace(/\.md$/, "");
      const rel = `memory/${bucket}/${file}`;
      const raw = readFileSync(absPath, "utf8");
      const parsed = parseFrontmatter(raw);
      const errors: string[] = [];

      if (!parsed.hasFrontmatter) errors.push("missing YAML frontmatter block");

      const result = FrontmatterSchema.safeParse(parsed.data);
      let data: Frontmatter | null = null;
      if (result.success) {
        data = result.data;
        if (data.name !== fileSlug) {
          errors.push(`frontmatter name "${data.name}" != filename "${fileSlug}"`);
        }
        if (data.metadata.type !== bucket) {
          errors.push(`metadata.type "${data.metadata.type}" != bucket "${bucket}"`);
        }
      } else {
        for (const issue of result.error.issues) {
          errors.push(`frontmatter ${issue.path.join(".") || "(root)"}: ${issue.message}`);
        }
      }

      out.push({ rel, absPath, fileSlug, bucket, data, body: parsed.body, errors });
    }
  }

  return out;
}
