import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { buildHttpApp } from "../src/http.js";

// The brain toolkit is real; it operates on an isolated temp CLAUDE_DIR.
const BRAIN_DIR = join(homedir(), ".claude", "tools", "brain");
const TOKEN = "test-token";

let claudeDir: string;
let server: Server;
let port: number;

beforeEach(async () => {
  claudeDir = mkdtempSync(join(tmpdir(), "mcp-http-"));
  for (const b of ["user", "feedback", "project", "reference"]) {
    mkdirSync(join(claudeDir, "memory", b), { recursive: true });
  }
  const app = buildHttpApp({ token: TOKEN, claudeDir, brainDir: BRAIN_DIR });
  server = app.listen(0);
  await new Promise<void>((r) => server.once("listening", () => r()));
  port = (server.address() as { port: number }).port;
});

afterEach(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  rmSync(claudeDir, { recursive: true, force: true });
});

const mcpUrl = () => new URL(`http://127.0.0.1:${port}/mcp`);

describe("buildHttpApp", () => {
  it("rejects MCP requests without a bearer token (401)", async () => {
    const res = await fetch(mcpUrl(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "t", version: "1" },
        },
      }),
    });
    expect(res.status).toBe(401);
  });

  it("serves the brain over authenticated HTTP (handshake + tool list + write)", async () => {
    const client = new Client({ name: "http-test", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(mcpUrl(), {
      requestInit: { headers: { Authorization: `Bearer ${TOKEN}` } },
    });
    await client.connect(transport as Transport);

    const tools = await client.listTools();
    expect(tools.tools.map((t) => t.name)).toContain("memory_write");

    await client.callTool({
      name: "memory_write",
      arguments: {
        name: "hub-fact",
        type: "project",
        description: "written via the http hub",
        body: "hub round-trip works",
      },
    });
    expect(existsSync(join(claudeDir, "memory", "project", "hub-fact.md"))).toBe(true);

    await client.close();
  });
});
