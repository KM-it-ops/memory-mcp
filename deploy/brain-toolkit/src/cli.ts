import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { scanMemory } from "./scan.js";
import { buildIndex } from "./indexCmd.js";
import { buildHot } from "./hot.js";
import { lint, summarize, type Issue } from "./lint.js";
import { computeCleanup } from "./manifest.js";
import { migrateFiles, regenerateVaultMeta, scanVault } from "./wiki.js";

const here = dirname(fileURLToPath(import.meta.url));
const CLAUDE_DIR = process.env.CLAUDE_DIR ?? resolve(here, "../../..");
const MEMORY_DIR = join(CLAUDE_DIR, "memory");
const INDEX_PATH = join(CLAUDE_DIR, "MEMORY.md");
// Sibling index inside memory/ so Karpathy-wiki tools (e.g. Understand-Anything
// /understand-knowledge) detect the brain when pointed at memory/. Same content
// as MEMORY.md with links rewritten relative to memory/. scanMemory ignores
// files directly under memory/, so this is never treated as a note or linted.
const MEMORY_INDEX_PATH = join(MEMORY_DIR, "index.md");
const HOT_PATH = join(MEMORY_DIR, "hot.md");
const WIKI_DIR = join(CLAUDE_DIR, "wiki");
const WIKI_INDEX_PATH = join(WIKI_DIR, "meta", "index.md");

function readIndex(): string | undefined {
  return existsSync(INDEX_PATH) ? readFileSync(INDEX_PATH, "utf8") : undefined;
}

function printIssues(issues: Issue[]): void {
  for (const i of issues) {
    const tag = i.level === "error" ? "ERROR" : "warn ";
    console.log(`  [${tag}] ${i.code.padEnd(14)} ${i.file}\n           ${i.msg}`);
  }
  const { errors, warnings } = summarize(issues);
  console.log(`\n  ${errors} error(s), ${warnings} warning(s).`);
}

function cmdIndex(): void {
  const entries = scanMemory(MEMORY_DIR);
  const content = buildIndex(entries);
  writeFileSync(INDEX_PATH, content, "utf8");
  // Sibling memory/index.md (links rewritten relative to memory/) for Karpathy-wiki tooling.
  const memoryRelative = content.replace(/\]\(memory\//g, "](");
  writeFileSync(MEMORY_INDEX_PATH, memoryRelative, "utf8");
  console.log(`Wrote ${INDEX_PATH} + ${MEMORY_INDEX_PATH} (${entries.length} entries).`);
}

function cmdHot(): void {
  const entries = scanMemory(MEMORY_DIR);
  const content = buildHot(entries);
  writeFileSync(HOT_PATH, content, "utf8");
  const words = content.trim().split(/\s+/).length;
  console.log(`Wrote ${HOT_PATH} (${words} words).`);
}

function cmdLint(): number {
  const entries = scanMemory(MEMORY_DIR);
  const issues = lint({ entries, indexText: readIndex() });
  console.log(`\nLINT — ${MEMORY_DIR}\n`);
  printIssues(issues);
  return summarize(issues).errors > 0 ? 1 : 0;
}

function cmdCheck(): void {
  const entries = scanMemory(MEMORY_DIR);
  const issues = lint({ entries, indexText: readIndex() });
  console.log(`\n=== BRAIN CHECK (read-only) ===\n`);
  console.log(`memory/ entries scanned: ${entries.length}`);
  console.log(`\n--- Lint ---`);
  printIssues(issues);

  console.log(`\n--- Proposed cleanup manifest (nothing executed) ---\n`);
  const actions = computeCleanup(CLAUDE_DIR);
  if (actions.length === 0) {
    console.log("  (no cleanup actions detected)");
  }
  for (const a of actions) {
    console.log(`  [${a.severity.toUpperCase()}] ${a.title}`);
    console.log(`     ${a.detail}`);
    for (const c of a.commands) console.log(`       $ ${c}`);
    console.log("");
  }
  console.log("Gate G1: review the above before any mutation.");
}

function cmdMigrate(): void {
  const res = migrateFiles(MEMORY_DIR, WIKI_DIR);
  const meta = regenerateVaultMeta(WIKI_DIR);
  console.log(`Migrated ${res.copied.length} note(s) into ${WIKI_DIR}:`);
  for (const [folder, n] of Object.entries(res.perFolder)) {
    console.log(`  ${folder.padEnd(10)} ${n}`);
  }
  if (res.excluded.length > 0) {
    console.log(`Excluded (throwaway): ${res.excluded.join(", ")}`);
  }
  console.log(`Regenerated wiki/meta/{index.md,hot.md} (${meta.entries} entries). memory/ untouched.`);
}

function cmdWikiLint(): number {
  const entries = scanVault(WIKI_DIR);
  const indexText = existsSync(WIKI_INDEX_PATH)
    ? readFileSync(WIKI_INDEX_PATH, "utf8")
    : undefined;
  const issues = lint({ entries, indexText });
  console.log(`\nWIKI LINT — ${WIKI_DIR}\n`);
  printIssues(issues);
  return summarize(issues).errors > 0 ? 1 : 0;
}

function main(): void {
  const cmd = process.argv[2] ?? "";
  switch (cmd) {
    case "index":
      cmdIndex();
      break;
    case "hot":
      cmdHot();
      break;
    case "lint":
      process.exit(cmdLint());
      break;
    case "check":
      cmdCheck();
      break;
    case "migrate":
      cmdMigrate();
      break;
    case "wiki-lint":
      process.exit(cmdWikiLint());
      break;
    default:
      console.log("usage: brain <index|hot|lint|check|migrate|wiki-lint>");
      console.log("  index      regenerate MEMORY.md from frontmatter");
      console.log("  hot        rebuild memory/hot.md session cache");
      console.log("  lint       report drift / dead links / frontmatter / secrets (exit 1 on error)");
      console.log("  check      read-only lint + proposed cleanup manifest (Gate G1 artifact)");
      console.log("  migrate    copy memory/ into the wiki/ vault + regenerate wiki/meta (additive)");
      console.log("  wiki-lint  lint the wiki/ vault (exit 1 on error)");
      process.exit(cmd === "" ? 0 : 1);
  }
}

main();
