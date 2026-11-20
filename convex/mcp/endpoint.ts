import { internal } from "../_generated/api";
import { httpAction } from "../_generated/server";
import { hashKey, KEY_PREFIX } from "../agentKeys";
import { agentHttpClient } from "./client";
import { handleMcp } from "./protocol";
import { agentTokensConfigured, signAgentToken } from "./token";
import { ALL_TOOLS } from "./tools";

// POST /mcp: checks the agent's API key (Authorization: Bearer velo_...),
// signs a 60-second token for that agent, and answers one MCP message with
// tools that call Velo's public functions as the agent.

const JSON_HEADERS = { "Content-Type": "application/json" };

function httpError(status: number, message: string, extra: Record<string, string> = {}) {
  return new Response(
    JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32001, message } }),
    { status, headers: { ...JSON_HEADERS, ...extra } },
  );
}

const unauthorized = (message: string) =>
  httpError(401, message, { "WWW-Authenticate": 'Bearer realm="velo"' });

export const mcpPost = httpAction(async (ctx, req) => {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (match === null || !match[1].startsWith(KEY_PREFIX)) {
    return unauthorized("Missing API key. Send `Authorization: Bearer velo_...`.");
  }
  if (!agentTokensConfigured()) {
    return httpError(503, "Agent access is not set up on this deployment.");
  }

  const auth = await ctx.runMutation(internal.mcp.auth.authenticate, {
    keyHash: await hashKey(match[1]),
  });
  if (!auth.ok) {
    if (auth.reason === "RATE_LIMITED") {
      return httpError(429, "Too many requests for this key.", {
        "Retry-After": String(Math.max(1, Math.ceil(auth.retryAfterMs / 1000))),
      });
    }
    return unauthorized("Invalid, revoked or disabled API key.");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = undefined;
  }

  const token = await signAgentToken(auth.caller, Date.now());
  const response = await handleMcp(body, req.headers, {
    tools: ALL_TOOLS,
    client: agentHttpClient(token),
  });
  if (response.status === 202) {
    return new Response(null, { status: 202 });
  }
  return new Response(JSON.stringify(response.body), {
    status: response.status,
    headers: JSON_HEADERS,
  });
});

/** GET and DELETE: this stateless server has no streams or sessions. */
export const mcpNotAllowed = httpAction(async () => {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
});
