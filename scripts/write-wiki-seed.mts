#!/usr/bin/env -S npx tsx
/**
 * Import a wiki-seeds/project/<name>.md file into the live brain via memory_write logic.
 * Usage: CLAUDE_DIR=C:\AI\KM-IT-OPS npx tsx scripts/write-wiki-seed.mts masked-signal-github-brand-rollout
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFrontmatter } from "../src/frontmatter.js";
import { writeMemory } from "../src/memory.js";
import { resolveEnvDirs } from "../src/server.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedName = process.argv[2] ?? "masked-signal-github-brand-rollout";
const seedPath = join(__dirname, "..", "wiki-seeds", "project", `${seedName}.md`);

const raw = readFileSync(seedPath, "utf8");
const parsed = parseFrontmatter(raw);
if (!parsed.hasFrontmatter) {
  console.error("Seed missing frontmatter:", seedPath);
  process.exit(1);
}

const data = parsed.data;
const name = String(data.name ?? "");
const description = String(data.description ?? "");
const type = (data.metadata as { type?: string })?.type;
const title = data.title ? String(data.title) : undefined;
const tags = Array.isArray(data.tags) ? data.tags.map(String) : undefined;

if (!name || !description || !type) {
  console.error("Seed requires name, description, metadata.type");
  process.exit(1);
}

const dirs = resolveEnvDirs();
const result = writeMemory(dirs.brainDir, dirs.claudeDir, {
  name,
  type: type as "user" | "feedback" | "project" | "reference",
  description,
  body: parsed.body.trim(),
  ...(title ? { title } : {}),
  ...(tags ? { tags } : {}),
});

if (result.isErr()) {
  console.error(result.error.message);
  process.exit(1);
}

console.log(JSON.stringify({ written: result.value.rel, lint: "clean" }, null, 2));
