import { ConvexHttpClient } from "convex/browser";
import type { FunctionReference, FunctionReturnType } from "convex/server";
import { env } from "../_generated/server";

// How MCP tools reach Velo: through the same public functions the app uses,
// as the agent. In production the client sends a Velo-signed agent token
// (convex/mcp/token.ts); tests pass an adapter over convex-test's
// `withIdentity`, so tools are tested end to end without network.

type Ref<Type extends "query" | "mutation" | "action"> = FunctionReference<Type, "public">;

export interface AgentClient {
  query<F extends Ref<"query">>(ref: F, args: F["_args"]): Promise<FunctionReturnType<F>>;
  mutation<F extends Ref<"mutation">>(ref: F, args: F["_args"]): Promise<FunctionReturnType<F>>;
  action<F extends Ref<"action">>(ref: F, args: F["_args"]): Promise<FunctionReturnType<F>>;
}

/** A client that calls this deployment's public functions as the agent. */
export function agentHttpClient(token: string): AgentClient {
  const client = new ConvexHttpClient(env.CONVEX_CLOUD_URL);
  client.setAuth(token);
  return {
    query: (ref, args) => client.query(ref, args),
    mutation: (ref, args) => client.mutation(ref, args),
    action: (ref, args) => client.action(ref, args),
  };
}
