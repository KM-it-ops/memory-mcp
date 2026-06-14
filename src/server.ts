#!/usr/bin/env -S npx tsx
import { homedir } from "node:os";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { BUCKETS } from "./frontmatter.js";
import { searchMemory } from "./search.js";
import { scanMemory } from "./scan.js";
import { readMemory, listMemory, memoryLinks, writeMemory } from "./memory.js";

const bucketEnum = z.enum(BUCKETS);

/** Serialize a critical section. Default is a no-op (stdio: one client, one process). */
export type WriteGuard = <T>(fn: () => Promise<T>) => Promise<T>;

export interface ServerOptions {
  /** Directory holding the {user,feedback,project,reference} buckets. */
  memoryDir: string;
  /** Brain toolkit dir (index/hot/lint) invoked on write. */
  brainDir: string;
  /** Root passed to the brain toolkit as CLAUDE_DIR. */
  claudeDir: string;
  /** Serializes writes so concurrent clients can't race the index regen. */
  writeGuard?: WriteGuard;
}

/** Resolve the brain dirs from the environment (shared by the stdio + HTTP entrypoints). */
export function resolveEnvDirs(): { memoryDir: string; brainDir: string; claudeDir: string } {
  const claudeDir = process.env.CLAUDE_DIR ?? join(homedir(), ".claude");
  return {
    claudeDir,
    memoryDir: join(claudeDir, "memory"),
    brainDir: process.env.BRAIN_DIR ?? join(claudeDir, "tools", "brain"),
  };
}

function text(payload: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }] };
}

export function buildServer(opts: ServerOptions): McpServer {
  const { memoryDir, brainDir, claudeDir } = opts;
  const writeGuard: WriteGuard = opts.writeGuard ?? ((fn) => fn());
  const server = new McpServer({ name: "memory-mcp", version: "0.1.0" });

  server.registerTool(
    "memory_search",
    {
      title: "Search the shared brain",
      description:
        "Full-text + frontmatter search across the shared brain (name/description/tags/body). Returns ranked hits.",
      inputSchema: {
        query: z.string().min(1).describe("search terms"),
        type: bucketEnum.optional().describe("restrict to a bucket"),
        limit: z.number().int().positive().max(50).optional().describe("max hits (default 10)"),
      },
    },
    async ({ query, type, limit }) => {
      const entries = scanMemory(memoryDir);
      return text(searchMemory(entries, { query, ...(type ? { type } : {}), ...(limit ? { limit } : {}) }));
    },
  );

  server.registerTool(
    "memory_read",
    {
      title: "Read a memory",
      description: "Read one memory by name; returns frontmatter, body, and resolved outbound [[wikilinks]].",
      inputSchema: { name: z.string().min(1).describe("memory slug/name") },
    },
    async ({ name }) => {
      const r = readMemory(memoryDir, name);
      return r.match(
        (m) => text(m),
        (e) => ({ isError: true, content: [{ type: "text" as const, text: `${e.code}: ${e.message}` }] }),
      );
    },
  );

  server.registerTool(
    "memory_write",
    {
      title: "Write a memory",
      description:
        "Create/update a memory (one fact). Writes memory/<type>/<name>.md, regenerates MEMORY.md + hot.md, and runs the brain lint. A failed lint fails the write.",
      inputSchema: {
        name: z.string().min(1).describe("lowercase-kebab slug (also the filename)"),
        type: bucketEnum.describe("bucket: user | feedback | project | reference"),
        description: z.string().min(1).describe("one-line summary (no newlines)"),
        body: z.string().min(1).describe("the fact; may contain [[wikilinks]]"),
        title: z.string().min(1).optional(),
        tags: z.array(z.string()).optional(),
      },
    },
    async ({ name, type, description, body, title, tags }) => {
      // Serialized: concurrent writers would otherwise race the index regen.
      const r = await writeGuard(async () =>
        writeMemory(brainDir, claudeDir, {
          name,
          type,
          description,
          body,
          ...(title ? { title } : {}),
          ...(tags ? { tags } : {}),
        }),
      );
      return r.match(
        (w) => text({ written: w.rel, lint: "clean" }),
        (e) => ({ isError: true, content: [{ type: "text" as const, text: `${e.code}: ${e.message}` }] }),
      );
    },
  );

  server.registerTool(
    "memory_list",
    {
      title: "List memories",
      description: "List memories (name, type, description), optionally filtered by bucket.",
      inputSchema: { type: bucketEnum.optional().describe("restrict to a bucket") },
    },
    async ({ type }) => text(listMemory(memoryDir, type)),
  );

  server.registerTool(
    "memory_links",
    {
      title: "Memory link graph",
      description: "Inbound and outbound [[wikilink]] neighbours for a memory.",
      inputSchema: { name: z.string().min(1).describe("memory slug/name") },
    },
    async ({ name }) => {
      const r = memoryLinks(memoryDir, name);
      return r.match(
        (g) => text(g),
        (e) => ({ isError: true, content: [{ type: "text" as const, text: `${e.code}: ${e.message}` }] }),
      );
    },
  );

  return server;
}

async function main(): Promise<void> {
  const dirs = resolveEnvDirs();
  const server = buildServer(dirs);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr only — stdout is the MCP channel.
  process.stderr.write(`memory-mcp serving brain at ${dirs.memoryDir}\n`);
}

const invokedDirectly = process.argv[1]?.endsWith("server.ts") || process.argv[1]?.endsWith("server.js");
if (invokedDirectly) {
  main().catch((e) => {
    process.stderr.write(`memory-mcp fatal: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  });
}
