import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer } from "../src/server.ts";

const server = buildServer();
const [clientT, serverT] = InMemoryTransport.createLinkedPair();
await server.connect(serverT);
const client = new Client({ name: "g1-demo", version: "0.0.0" });
await client.connect(clientT);

const tools = await client.listTools();
console.log("TOOLS:", tools.tools.map((t) => t.name).join(", "));

async function call(name: string, args: Record<string, unknown>) {
  const r = await client.callTool({ name, arguments: args });
  const first = Array.isArray(r.content) ? r.content[0] : undefined;
  const txt = first && first.type === "text" ? first.text : JSON.stringify(r);
  return txt as string;
}

const search = JSON.parse(await call("memory_search", { query: "agentforge", limit: 3 }));
console.log("\nSEARCH 'agentforge' ->", search.length, "hits:");
for (const h of search) console.log(`  [${h.type}] ${h.name} (score ${h.score}) — ${h.description.slice(0, 60)}`);

const list = JSON.parse(await call("memory_list", { type: "project" }));
console.log("\nLIST project ->", list.map((e: { name: string }) => e.name).join(", "));

const read = JSON.parse(await call("memory_read", { name: "second-brain" }));
console.log("\nREAD second-brain -> type:", read.type, "| outbound links:", read.outboundLinks.map((l: {target:string;rel:string|null}) => `${l.target}${l.rel ? "" : "(dangling)"}`).join(", "));

const links = JSON.parse(await call("memory_links", { name: "second-brain" }));
console.log("LINKS second-brain -> inbound:", links.inbound.join(", ") || "(none)", "| outbound:", links.outbound.join(", ") || "(none)");

const miss = await call("memory_read", { name: "does-not-exist" });
console.log("\nREAD missing -> ", miss);
await client.close();
