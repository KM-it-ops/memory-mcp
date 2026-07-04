import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
  BUCKETS,
  type BucketType,
  type Frontmatter,
  FrontmatterSchema,
  parseFrontmatter,
} from "./frontmatter.js";
import type { Entry } from "./scan.js";
import { buildHot } from "./hot.js";

/**
 * Obsidian LLM-Wiki vault layer (Zettelkasten mode, text+frontmatter — no embeddings).
 *
 * Migrates the markdown brain at memory/{user,feedback,project,reference}/ into a
 * Karpathy-style vault at wiki/{sources,entities,concepts,sessions,meta}/, additively
 * and reversibly. memory/ is NEVER read-modified — files are copied verbatim so YAML
 * frontmatter and [[wikilinks]] are byte-preserved. The vault deliberately decouples
 * folder name from metadata.type: a note's `type` stays user/feedback/project/reference
 * while it physically lives under entities/concepts/sources.
 */

export const VAULT_FOLDERS = [
  "sources",
  "entities",
  "concepts",
  "sessions",
  "meta",
] as const;
export type VaultFolder = (typeof VAULT_FOLDERS)[number];

/** Folders that hold migrated notes (`meta` holds the generated index/hot only). */
export const CONTENT_FOLDERS: VaultFolder[] = [
  "sources",
  "entities",
  "concepts",
  "sessions",
];

/** Zettelkasten folder map: memory bucket -> vault content folder. */
export const BUCKET_TO_FOLDER: Record<BucketType, VaultFolder> = {
  user: "entities",
  project: "entities",
  feedback: "concepts",
  reference: "sources",
};

/** Fallback bucket for an invalid note, inferred from its vault folder (grouping only). */
const FOLDER_TO_BUCKET: Record<string, BucketType> = {
  sources: "reference",
  entities: "project",
  concepts: "feedback",
  sessions: "reference",
};

/** Throwaway slugs never migrated into the vault. */
export const EXCLUDE_SLUGS = new Set<string>(["roundtrip-probe"]);

const FOLDER_HEADINGS: Record<string, string> = {
  sources: "Sources",
  entities: "Entities",
  concepts: "Concepts",
  sessions: "Sessions",
};

export interface MigrationResult {
  copied: { from: string; to: string }[];
  excluded: string[];
  perFolder: Record<string, number>;
}

export function scaffoldVault(wikiDir: string): void {
  for (const f of VAULT_FOLDERS) mkdirSync(join(wikiDir, f), { recursive: true });
}

/** Copy each memory/** note verbatim into its mapped vault folder. memory/ is never modified. */
export function migrateFiles(memoryDir: string, wikiDir: string): MigrationResult {
  scaffoldVault(wikiDir);
  const copied: { from: string; to: string }[] = [];
  const excluded: string[] = [];
  const perFolder: Record<string, number> = {
    sources: 0,
    entities: 0,
    concepts: 0,
    sessions: 0,
  };

  for (const bucket of BUCKETS) {
    const dir = join(memoryDir, bucket);
    if (!existsSync(dir)) continue;
    const folder = BUCKET_TO_FOLDER[bucket];
    for (const file of readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .sort()) {
      const slug = file.replace(/\.md$/, "");
      if (EXCLUDE_SLUGS.has(slug)) {
        excluded.push(`memory/${bucket}/${file}`);
        continue;
      }
      copyFileSync(join(dir, file), join(wikiDir, folder, file)); // verbatim bytes
      copied.push({ from: `memory/${bucket}/${file}`, to: `wiki/${folder}/${file}` });
      perFolder[folder]++;
    }
  }
  return { copied, excluded, perFolder };
}

/** Walk wiki content folders and parse+validate each note. Folder != metadata.type by design. */
export function scanVault(wikiDir: string): Entry[] {
  const out: Entry[] = [];
  for (const folder of CONTENT_FOLDERS) {
    const dir = join(wikiDir, folder);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .sort()) {
      const absPath = join(dir, file);
      const fileSlug = file.replace(/\.md$/, "");
      const rel = `wiki/${folder}/${file}`;
      const raw = readFileSync(absPath, "utf8");
      const parsed = parseFrontmatter(raw);
      const errors: string[] = [];

      if (!parsed.hasFrontmatter) errors.push("missing YAML frontmatter block");

      const result = FrontmatterSchema.safeParse(parsed.data);
      let data: Frontmatter | null = null;
      let bucket: BucketType = FOLDER_TO_BUCKET[folder];
      if (result.success) {
        data = result.data;
        bucket = data.metadata.type; // type carries the bucket; folder intentionally differs
        if (data.name !== fileSlug) {
          errors.push(`frontmatter name "${data.name}" != filename "${fileSlug}"`);
        }
      } else {
        for (const issue of result.error.issues) {
          errors.push(
            `frontmatter ${issue.path.join(".") || "(root)"}: ${issue.message}`,
          );
        }
      }

      out.push({ rel, absPath, fileSlug, bucket, data, body: parsed.body, errors });
    }
  }
  return out;
}

function titleCase(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Build wiki/meta/index.md grouped by vault folder, linking vault-relative paths. */
export function buildVaultIndex(entries: Entry[]): string {
  const preamble = `# Wiki Index

<!-- GENERATED by tools/brain (\`npm run migrate\`). Do not hand-edit — edits are overwritten. -->

Karpathy-style LLM-Wiki vault index. Notes live in \`wiki/{sources,entities,concepts,sessions}/\`. The session warm-cache is \`wiki/meta/hot.md\`.`;
  const sections: string[] = [preamble];

  for (const folder of CONTENT_FOLDERS) {
    const inFolder = entries
      .filter((e) => BUCKET_TO_FOLDER[e.bucket] === folder)
      .sort((a, b) => a.fileSlug.localeCompare(b.fileSlug));
    const lines = inFolder.map((e) => {
      const title = e.data?.title ?? titleCase(e.fileSlug);
      const description = e.data?.description ?? "(no description)";
      return `- [${title}](${e.rel}) — ${description}`;
    });
    const body = lines.length > 0 ? lines.join("\n") : `*(no entries yet)*`;
    sections.push(`## ${FOLDER_HEADINGS[folder]}\n${body}`);
  }

  return sections.join("\n\n") + "\n";
}

/** Regenerate wiki/meta/index.md + wiki/meta/hot.md from current vault content. */
export function regenerateVaultMeta(wikiDir: string): { entries: number } {
  const entries = scanVault(wikiDir);
  mkdirSync(join(wikiDir, "meta"), { recursive: true });
  writeFileSync(join(wikiDir, "meta", "index.md"), buildVaultIndex(entries), "utf8");
  writeFileSync(join(wikiDir, "meta", "hot.md"), buildHot(entries), "utf8");
  return { entries: entries.length };
}
