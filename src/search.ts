import type { Entry } from "./scan.js";
import type { BucketType } from "./frontmatter.js";

export interface SearchHit {
  name: string;
  type: BucketType;
  description: string;
  rel: string;
  snippet: string;
  score: number;
}

export interface SearchOpts {
  query: string;
  type?: BucketType;
  limit?: number;
}

const WEIGHT = { name: 5, description: 3, tags: 2, body: 1 } as const;

function countOccurrences(haystack: string, needle: string): number {
  if (needle === "") return 0;
  let count = 0;
  let from = 0;
  for (;;) {
    const idx = haystack.indexOf(needle, from);
    if (idx === -1) break;
    count++;
    from = idx + needle.length;
  }
  return count;
}

function makeSnippet(body: string, terms: string[]): string {
  const lines = body.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (terms.some((t) => lower.includes(t))) {
      return line.length > 160 ? `${line.slice(0, 157)}...` : line;
    }
  }
  const first = lines[0] ?? "";
  return first.length > 160 ? `${first.slice(0, 157)}...` : first;
}

/**
 * Rank memory entries against a text query over name / description / tags / body.
 * Entries that failed validation (data === null) are skipped. Text + frontmatter
 * only — no embeddings in v1.
 */
export function searchMemory(entries: Entry[], opts: SearchOpts): SearchHit[] {
  const terms = opts.query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  const limit = opts.limit ?? 10;

  const hits: SearchHit[] = [];
  for (const e of entries) {
    if (!e.data) continue;
    if (opts.type && e.bucket !== opts.type) continue;

    const name = e.data.name.toLowerCase();
    const description = e.data.description.toLowerCase();
    const tags = (e.data.tags ?? []).join(" ").toLowerCase();
    const body = e.body.toLowerCase();

    let score = 0;
    for (const t of terms) {
      score += countOccurrences(name, t) * WEIGHT.name;
      score += countOccurrences(description, t) * WEIGHT.description;
      score += countOccurrences(tags, t) * WEIGHT.tags;
      score += countOccurrences(body, t) * WEIGHT.body;
    }
    if (score === 0) continue;

    hits.push({
      name: e.data.name,
      type: e.bucket,
      description: e.data.description,
      rel: e.rel,
      snippet: makeSnippet(e.body, terms),
      score,
    });
  }

  hits.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return hits.slice(0, limit);
}
