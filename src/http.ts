import { join } from "node:path";
import { randomUUID } from "node:crypto";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { buildServer, resolveEnvDirs, type WriteGuard } from "./server.js";
import { createMutex } from "./lock.js";
import { authorize } from "./auth.js";

export interface HubOptions {
  /** Bearer token every request must present. */
  token: string;
  /** Root passed to the brain toolkit as CLAUDE_DIR. */
  claudeDir: string;
  /** Brain toolkit dir (index/hot/lint). */
  brainDir: string;
}

/**
 * Build the HTTP hub: any MCP client can connect over Streamable HTTP with the
 * bearer token. Stateful sessions (one transport per mcp-session-id). A single
 * shared write-lock serializes memory_write across all connected clients so the
 * index regeneration can't race.
 */
export function buildHttpApp(opts: HubOptions): Express {
  const memoryDir = join(opts.claudeDir, "memory");
  const mutex = createMutex();
  const writeGuard: WriteGuard = (fn) => mutex.runExclusive(fn);

  const transports: Record<string, StreamableHTTPServerTransport> = {};

  const app = express();
  app.use(express.json());

  const auth = (req: Request, res: Response, next: NextFunction): void => {
    const r = authorize(req.headers.authorization, opts.token);
    if (!r.ok) {
      res.status(r.status).json({ jsonrpc: "2.0", error: { code: -32001, message: r.message }, id: null });
      return;
    }
    next();
  };

  app.post("/mcp", auth, async (req: Request, res: Response) => {
    const sid = req.headers["mcp-session-id"] as string | undefined;
    let transport = sid ? transports[sid] : undefined;

    if (!transport && isInitializeRequest(req.body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          if (transport) transports[id] = transport;
        },
      });
      transport.onclose = () => {
        const s = transport?.sessionId;
        if (s) delete transports[s];
      };
      const server = buildServer({
        memoryDir,
        brainDir: opts.brainDir,
        claudeDir: opts.claudeDir,
        writeGuard,
      });
      // Cast: the SDK transport's optional props don't line up with the project's
      // exactOptionalPropertyTypes, but it does implement Transport structurally.
      await server.connect(transport as Transport);
    } else if (!transport) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "No valid session; send an initialize request first" },
        id: null,
      });
      return;
    }

    await transport.handleRequest(req, res, req.body);
  });

  // Server->client stream (GET) and session teardown (DELETE) for an open session.
  const sessionRoute = async (req: Request, res: Response): Promise<void> => {
    const sid = req.headers["mcp-session-id"] as string | undefined;
    const transport = sid ? transports[sid] : undefined;
    if (!transport) {
      res.status(400).send("No valid session");
      return;
    }
    await transport.handleRequest(req, res);
  };
  app.get("/mcp", auth, sessionRoute);
  app.delete("/mcp", auth, sessionRoute);

  return app;
}

/** CLI entrypoint: read config from the environment and start listening. */
export function startHub(): void {
  const token = process.env.MEMORY_MCP_TOKEN ?? "";
  if (!token) {
    process.stderr.write("memory-mcp http: refusing to start — MEMORY_MCP_TOKEN is not set\n");
    process.exit(1);
  }
  const { claudeDir, brainDir, memoryDir } = resolveEnvDirs();
  const host = process.env.MEMORY_MCP_HOST ?? "127.0.0.1";
  const port = Number(process.env.MEMORY_MCP_PORT ?? 41888);

  const app = buildHttpApp({ token, claudeDir, brainDir });
  app.listen(port, host, () => {
    process.stderr.write(`memory-mcp HTTP hub on http://${host}:${port}/mcp (brain: ${memoryDir})\n`);
    if (host !== "127.0.0.1") {
      process.stderr.write(
        `memory-mcp WARNING: bound to ${host} — reachable beyond localhost; ensure the token is strong.\n`,
      );
    }
  });
}

const invokedDirectly = process.argv[1]?.endsWith("http.ts") || process.argv[1]?.endsWith("http.js");
if (invokedDirectly) startHub();
