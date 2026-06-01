import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

/**
 * Shared MCP server bootstrap (ADR-008). Each server wraps the SAME internal modules the
 * orchestrator uses; the protocol is the boundary for external MCP clients.
 * stdio discipline: NEVER write to stdout except JSON-RPC (no logger to stdout).
 */
export async function serve(name: string, register: (server: McpServer) => void): Promise<void> {
  const server = new McpServer({ name: `jobagent-${name}`, version: "0.1.0" });
  register(server);
  await server.connect(new StdioServerTransport());
}

/** Wrap any value as an MCP text tool result. */
export function text(value: unknown): { content: { type: "text"; text: string }[] } {
  const t = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return { content: [{ type: "text", text: t }] };
}
