import { env } from "../_generated/server";
import { AGENT_AUDIENCE, agentIssuer } from "./issuer";

// Signs the short-lived token an agent's tool calls run with. It has the
// same shape as a Clerk session token (`sub` + `o: { id, slg, rol }`), so
// `requireMember` and every permission check treat the agent like any
// member. The token never leaves the server: the MCP endpoint makes one per
// request after checking the agent's API key.

export const AGENT_TOKEN_TTL_SECONDS = 60;

export type AgentCaller = {
  userId: string;
  orgId: string;
  orgSlug: string;
  role: string;
};

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const encodeJson = (value: unknown) => base64url(new TextEncoder().encode(JSON.stringify(value)));

/** Whether the signing key is configured (see scripts/agent-jwt-keys.mjs). */
export function agentTokensConfigured(): boolean {
  return Boolean(env.AGENT_JWT_PRIVATE_KEY && env.AGENT_JWT_JWKS);
}

export async function signAgentToken(caller: AgentCaller, nowMs: number): Promise<string> {
  const raw = env.AGENT_JWT_PRIVATE_KEY;
  if (!raw) {
    throw new Error("AGENT_JWT_PRIVATE_KEY is not set");
  }
  const jwk = JSON.parse(raw) as JsonWebKey & { kid?: string };
  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const iat = Math.floor(nowMs / 1000);
  const header = { alg: "ES256", typ: "JWT", ...(jwk.kid ? { kid: jwk.kid } : {}) };
  const payload = {
    iss: agentIssuer(),
    aud: AGENT_AUDIENCE,
    sub: caller.userId,
    iat,
    nbf: iat - 5,
    exp: iat + AGENT_TOKEN_TTL_SECONDS,
    o: { id: caller.orgId, slg: caller.orgSlug, rol: caller.role },
  };
  const signingInput = `${encodeJson(header)}.${encodeJson(payload)}`;
  // WebCrypto ECDSA signatures are raw r||s, which is what JWS ES256 uses.
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${base64url(new Uint8Array(signature))}`;
}
