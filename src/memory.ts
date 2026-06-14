import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ok, err, type Result } from "neverthrow";
import { scanMemory, type Entry } from "./scan.js";
import { type BucketType, isValidSlug, serializeMemory } from "./frontmatter.js";
import { reindexAndLint } from "./brain.js";

export interface MemoryError {
  code: "not_found" | "invalid";
  message: string;
}

const WIKILINK_RE = /\[\[([^\]]+)\]\]/g;

/** Extract [[target]] wikilink names from a body, stripping any |alias. */
export function extractWikilinks(body: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  WIKILINK_RE.lastIndex = 0;
  while ((m = WIKILINK_RE.exec(body)) !== null) {
    const target = (m[1] ?? "").split("|")[0]?.trim() ?? "";
    if (target) out.push(target);
  }
  return out;
}

function findByName(entries: Entry[], name: string): Entry | undefined {
  return entries.find((e) => e.data?.name === name) ?? entries.find((e) => e.fileSlug === name);
}

export interface OutboundLink {
  target: string;
  /** repo-relative path if the target resolves to a real memory, else null */
  rel: string | null;
}

export interface ReadResult {
  name: string;
  type: BucketType;
  description: string;
  title: string | undefined;
  body: string;
  rel: string;
  outboundLinks: OutboundLink[];
}

export function readMemory(memoryDir: string, name: string): Result<ReadResult, MemoryError> {
  const entries = scanMemory(memoryDir);
  const entry = findByName(entries, name);
  if (!entry) return err({ code: "not_found", message: `no memory named "${name}"` });
  if (!entry.data) {
    return err({ code: "invalid", message: `memory "${name}" failed validation: ${entry.errors.join("; ")}` });
  }
  const byName = new Map(entries.filter((e) => e.data).map((e) => [e.data!.name, e.rel]));
  const outboundLinks: OutboundLink[] = extractWikilinks(entry.body).map((target) => ({
    target,
    rel: byName.get(target) ?? null,
  }));
  return ok({
    name: entry.data.name,
    type: entry.bucket,
    description: entry.data.description,
    title: entry.data.title,
    body: entry.body,
    rel: entry.rel,
    outboundLinks,
  });
}

export interface ListItem {
  name: string;
  type: BucketType;
  description: string;
}

export function listMemory(memoryDir: string, type?: BucketType): ListItem[] {
  return scanMemory(memoryDir)
    .filter((e): e is Entry & { data: NonNullable<Entry["data"]> } => e.data !== null)
    .filter((e) => (type ? e.bucket === type : true))
    .map((e) => ({ name: e.data.name, type: e.bucket, description: e.data.description }));
}

export interface LinksResult {
  name: string;
  outbound: string[];
  inbound: string[];
}

export interface WriteInput {
  name: string;
  type: BucketType;
  description: string;
  body: string;
  title?: string;
  tags?: string[];
}

export interface WriteResult {
  rel: string;
  lintOutput: string;
}

/**
 * Write/overwrite a memory file, then regenerate MEMORY.md + hot.md and lint via
 * the brain toolkit. A nonzero lint fails the write (file left on disk for the
 * human to inspect). `brainDir` is the tools/brain checkout; `claudeDir` is the
 * brain root (CLAUDE_DIR) — its /memory holds the buckets.
 */
export function writeMemory(
  brainDir: string,
  claudeDir: string,
  input: WriteInput,
): Result<WriteResult, MemoryError> {
  if (!isValidSlug(input.name)) {
    return err({ code: "invalid", message: `unsafe memory name "${input.name}" (use lowercase-kebab)` });
  }
  if (input.description.trim() === "" || /[\r\n]/.test(input.description)) {
    return err({ code: "invalid", message: "description must be a non-empty single line" });
  }
  if (input.body.trim() === "") {
    return err({ code: "invalid", message: "body must not be empty" });
  }

  const dir = join(claudeDir, "memory", input.type);
  mkdirSync(dir, { recursive: true });
  const content = serializeMemory(
    {
      name: input.name,
      description: input.description,
      type: input.type,
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.tags !== undefined ? { tags: input.tags } : {}),
    },
    input.body,
  );
  writeFileSync(join(dir, `${input.name}.md`), content);

  const res = reindexAndLint(brainDir, claudeDir);
  const rel = `memory/${input.type}/${input.name}.md`;
  if (!res.ok) {
    return err({ code: "invalid", message: `brain lint failed (file left at ${rel} for inspection):\n${res.lintOutput}` });
  }
  return ok({ rel, lintOutput: res.lintOutput });
}

export function memoryLinks(memoryDir: string, name: string): Result<LinksResult, MemoryError> {
  const entries = scanMemory(memoryDir);
  const entry = findByName(entries, name);
  if (!entry?.data) return err({ code: "not_found", message: `no memory named "${name}"` });
  const target = entry.data.name;
  const outbound = extractWikilinks(entry.body);
  const inbound = entries
    .filter((e) => e.data && e.data.name !== target && extractWikilinks(e.body).includes(target))
    .map((e) => e.data!.name);
  return ok({ name: target, outbound, inbound });
}
