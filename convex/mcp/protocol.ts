import { ConvexError } from "convex/values";
import type { AgentClient } from "./client";
import { inputJsonSchema, ToolError, type Tool } from "./registry";

// A stateless MCP server over Streamable HTTP, as one pure function so it
// can be tested without HTTP. It speaks both protocol eras:
// - 2026-07-28 ("modern"): no handshake; every request carries its version
//   in `_meta` and the MCP-Protocol-Version header; `server/discover`.
// - 2025-03-26 to 2025-11-25 ("legacy"): `initialize` handshake. Velo keeps
//   no session, so the handshake only negotiates the version.
// Responses are always single JSON objects (no SSE streams).

export const MODERN_VERSIONS = ["2026-07-28"] as const;
export const LEGACY_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26"] as const;
export const SUPPORTED_VERSIONS: string[] = [...MODERN_VERSIONS, ...LEGACY_VERSIONS];

const VERSION_META = "io.modelcontextprotocol/protocolVersion";
const SERVER_INFO_META = "io.modelcontextprotocol/serverInfo";

// JSON-RPC and MCP error codes.
const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const HEADER_MISMATCH = -32020;
const UNSUPPORTED_VERSION = -32022;

export const SERVER_INFO = { name: "velo", title: "Velo", version: "1.0.0" };

export const INSTRUCTIONS = [
  "Velo is an issue tracker. You act as an agent member of one workspace, with your role's permissions; every change you make is recorded under your name.",
  "Issues are named by identifier (e.g. ENG-12), teams by key (e.g. ENG). Priority: 0 none, 1 urgent, 2 high, 3 medium, 4 low. Dates are ISO strings (YYYY-MM-DD).",
  "Start with `whoami` and `list_teams`. Use `list_members` to find people and agents to assign; agents have isAgent: true.",
  "If `whoami` says you're a master agent (canCreateAgents), you can build a team: `create_agent` makes one of your agents (a regular member that can't create agents), `create_agent_key` gives it its own key, `add_team_member` puts it in a team, and `update_issue` with assignee hands it work.",
].join("\n");

export type McpDeps = {
  tools: Tool[];
  client: AgentClient;
};

export type McpResponse = { status: number; body: unknown };

type Id = string | number;
type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function rpcError(id: Id | null, code: number, message: string, data?: unknown, status = 200): McpResponse {
  return {
    status,
    body: { jsonrpc: "2.0", id, error: { code, message, ...(data === undefined ? {} : { data }) } },
  };
}

// --- Tool errors ---------------------------------------------------------------

const ERROR_MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: "Not signed in. Check the agent's API key.",
  NO_ACTIVE_ORG: "The agent has no active workspace.",
  FORBIDDEN: "Not allowed: your role or permissions don't cover this.",
  NOT_FOUND: "Not found, or not visible to you (private teams are visible only to their members).",
  FEATURE_NOT_IN_PLAN: "The workspace's plan doesn't include this feature.",
  LIMIT_REACHED: "A limit was reached.",
  SEAT_LIMIT_REACHED: "The workspace is over its seat limit.",
  INVALID_INPUT: "Invalid input. Check the values and try again.",
};

/** The error code Velo threw (a ConvexError code), if any. */
export function errorCode(error: unknown): string | null {
  if (error instanceof ConvexError && typeof error.data === "string") return error.data;
  const message = error instanceof Error ? error.message : String(error);
  const match = /\b(UNAUTHENTICATED|NO_ACTIVE_ORG|FORBIDDEN|NOT_FOUND|FEATURE_NOT_IN_PLAN|LIMIT_REACHED|SEAT_LIMIT_REACHED|INVALID_INPUT)\b/.exec(message);
  if (match) return match[1];
  if (/ArgumentValidationError|Validator error|Value does not match validator/.test(message)) {
    return "INVALID_INPUT";
  }
  return null;
}

function toolError(text: string) {
  return { content: [{ type: "text", text }], isError: true };
}

async function callTool(tool: Tool, args: unknown, client: AgentClient) {
  const parsed = tool.input.safeParse(args ?? {});
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
      .join("; ");
    return toolError(`INVALID_INPUT: ${problems}`);
  }
  try {
    const result = await tool.run(client, parsed.data);
    const value = result === undefined ? null : result;
    return {
      content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
      ...(isObject(value) ? { structuredContent: value } : {}),
      isError: false,
    };
  } catch (error) {
    if (error instanceof ToolError) {
      return toolError(error.message);
    }
    const code = errorCode(error);
    if (code !== null) {
      return toolError(`${code}: ${ERROR_MESSAGES[code] ?? code}`);
    }
    console.error(`MCP tool ${tool.name} failed`, error);
    return toolError("INTERNAL_ERROR: Velo could not complete this call. Try again later.");
  }
}

// --- Dispatch --------------------------------------------------------------------

export async function handleMcp(
  raw: unknown,
  headers: Headers,
  deps: McpDeps,
): Promise<McpResponse> {
  if (raw === undefined) return rpcError(null, PARSE_ERROR, "Parse error", undefined, 400);
  if (!isObject(raw) || raw.jsonrpc !== "2.0") {
    return rpcError(null, INVALID_REQUEST, "Expected a single JSON-RPC 2.0 message", undefined, 400);
  }
  if ("result" in raw || "error" in raw) {
    return rpcError(null, INVALID_REQUEST, "Clients must not send JSON-RPC responses", undefined, 400);
  }
  if (typeof raw.method !== "string") {
    return rpcError(null, INVALID_REQUEST, "Missing method", undefined, 400);
  }
  const method = raw.method;
  const params = isObject(raw.params) ? raw.params : {};

  // Notifications (no id): nothing to do; accepted.
  if (!("id" in raw)) return { status: 202, body: null };
  const id = raw.id;
  if (typeof id !== "string" && typeof id !== "number") {
    return rpcError(null, INVALID_REQUEST, "Invalid id", undefined, 400);
  }

  // Which era this request speaks.
  const headerVersion = headers.get("mcp-protocol-version");
  const meta = isObject(params._meta) ? params._meta : {};
  const metaVersion = typeof meta[VERSION_META] === "string" ? (meta[VERSION_META] as string) : null;
  const modern = metaVersion !== null;

  if (modern) {
    if (headerVersion !== metaVersion) {
      return rpcError(id, HEADER_MISMATCH, `Header mismatch: MCP-Protocol-Version header value '${headerVersion ?? ""}' does not match body value '${metaVersion}'`, undefined, 400);
    }
    if (!(MODERN_VERSIONS as readonly string[]).includes(metaVersion)) {
      return rpcError(id, UNSUPPORTED_VERSION, "Unsupported protocol version", { supported: SUPPORTED_VERSIONS, requested: metaVersion }, 400);
    }
    const methodHeader = headers.get("mcp-method");
    if (methodHeader !== null && methodHeader !== method) {
      return rpcError(id, HEADER_MISMATCH, `Header mismatch: Mcp-Method header value '${methodHeader}' does not match body value '${method}'`, undefined, 400);
    }
    const nameHeader = headers.get("mcp-name");
    if (nameHeader !== null && method === "tools/call" && nameHeader !== params.name) {
      return rpcError(id, HEADER_MISMATCH, `Header mismatch: Mcp-Name header value '${nameHeader}' does not match body value '${String(params.name)}'`, undefined, 400);
    }
  } else if (headerVersion !== null && !SUPPORTED_VERSIONS.includes(headerVersion)) {
    return rpcError(id, UNSUPPORTED_VERSION, "Unsupported protocol version", { supported: SUPPORTED_VERSIONS, requested: headerVersion }, 400);
  }

  const ok = (result: Json): McpResponse => ({
    status: 200,
    body: {
      jsonrpc: "2.0",
      id,
      result: modern
        ? { resultType: "complete", ...result, _meta: { [SERVER_INFO_META]: SERVER_INFO } }
        : result,
    },
  });

  switch (method) {
    case "initialize": {
      const requested = typeof params.protocolVersion === "string" ? params.protocolVersion : "";
      const version = (LEGACY_VERSIONS as readonly string[]).includes(requested)
        ? requested
        : LEGACY_VERSIONS[0];
      return ok({
        protocolVersion: version,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      });
    }
    case "server/discover":
      return ok({
        supportedVersions: SUPPORTED_VERSIONS,
        capabilities: { tools: { listChanged: false } },
        instructions: INSTRUCTIONS,
        ttlMs: 3_600_000,
        cacheScope: "private",
        ...(modern ? {} : { _meta: { [SERVER_INFO_META]: SERVER_INFO } }),
      });
    case "ping":
      return ok({});
    case "tools/list":
      return ok({
        tools: deps.tools.map((tool) => ({
          name: tool.name,
          title: tool.title,
          description: tool.description,
          inputSchema: inputJsonSchema(tool),
          annotations: { title: tool.title, ...tool.annotations },
        })),
        ttlMs: 300_000,
        cacheScope: "private",
      });
    case "tools/call": {
      const tool = deps.tools.find((t) => t.name === params.name);
      if (tool === undefined) {
        return rpcError(id, INVALID_PARAMS, `Unknown tool: ${String(params.name)}`);
      }
      return ok(await callTool(tool, params.arguments, deps.client));
    }
    default:
      return rpcError(id, METHOD_NOT_FOUND, `Method not found: ${method}`, undefined, modern ? 404 : 200);
  }
}
