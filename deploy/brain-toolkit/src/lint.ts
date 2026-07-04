import type { Entry } from "./scan.js";

export type Level = "error" | "warn";

export interface Issue {
  level: Level;
  code: string;
  file: string;
  msg: string;
}

const SECRET_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "private-key", re: /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/ },
  { name: "openai-key", re: /\bsk-[A-Za-z0-9]{20,}/ },
  { name: "aws-access-key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "github-pat", re: /\bghp_[A-Za-z0-9]{36}\b/ },
  { name: "slack-token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}/ },
];

const WIKILINK_RE = /\[\[([^\]]+)\]\]/g;

/** Extract wikilink targets (strips any |alias) from a body. */
export function extractLinks(body: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  WIKILINK_RE.lastIndex = 0;
  while ((m = WIKILINK_RE.exec(body)) !== null) {
    const target = m[1].split("|")[0].trim();
    if (target) out.push(target);
  }
  return out;
}

export interface LintInput {
  entries: Entry[];
  /** Raw text of MEMORY.md (for drift detection); undefined if missing. */
  indexText: string | undefined;
}

export function lint({ entries, indexText }: LintInput): Issue[] {
  const issues: Issue[] = [];
  const names = new Set(
    entries.filter((e) => e.data).map((e) => e.data!.name),
  );
  const inboundLinks = new Set<string>();

  for (const entry of entries) {
    // Frontmatter / validation errors
    for (const err of entry.errors) {
      issues.push({ level: "error", code: "frontmatter", file: entry.rel, msg: err });
    }

    // Secret scan
    for (const { name, re } of SECRET_PATTERNS) {
      if (re.test(entry.body)) {
        issues.push({
          level: "error",
          code: "secret",
          file: entry.rel,
          msg: `possible ${name} found in body`,
        });
      }
    }

    // Wikilink targets
    const targets = extractLinks(entry.body);
    for (const t of targets) {
      inboundLinks.add(t);
      if (!names.has(t)) {
        issues.push({
          level: "warn",
          code: "dangling-link",
          file: entry.rel,
          msg: `[[${t}]] has no matching memory file yet`,
        });
      }
    }

    // Index drift: every valid entry must appear in MEMORY.md
    if (entry.data && indexText !== undefined && !indexText.includes(entry.rel)) {
      issues.push({
        level: "error",
        code: "index-drift",
        file: entry.rel,
        msg: "not listed in MEMORY.md (run `npm run index`)",
      });
    }
  }

  // Orphans: valid entries that nothing links to (informational)
  for (const entry of entries) {
    if (entry.data && !inboundLinks.has(entry.data.name)) {
      issues.push({
        level: "warn",
        code: "orphan",
        file: entry.rel,
        msg: "no inbound [[links]] from other memories",
      });
    }
  }

  return issues;
}

export function summarize(issues: Issue[]): { errors: number; warnings: number } {
  return {
    errors: issues.filter((i) => i.level === "error").length,
    warnings: issues.filter((i) => i.level === "warn").length,
  };
}
