/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activities from "../activities.js";
import type * as agentKeys from "../agentKeys.js";
import type * as agents from "../agents.js";
import type * as ai_agent from "../ai/agent.js";
import type * as ai_chat from "../ai/chat.js";
import type * as ai_data from "../ai/data.js";
import type * as ai_duplicates from "../ai/duplicates.js";
import type * as ai_embeddingConfig from "../ai/embeddingConfig.js";
import type * as ai_embeddings from "../ai/embeddings.js";
import type * as ai_guard from "../ai/guard.js";
import type * as ai_models from "../ai/models.js";
import type * as ai_proposals from "../ai/proposals.js";
import type * as ai_suggestions from "../ai/suggestions.js";
import type * as ai_tools from "../ai/tools.js";
import type * as auditLogs from "../auditLogs.js";
import type * as billing from "../billing.js";
import type * as clerkSync from "../clerkSync.js";
import type * as comments from "../comments.js";
import type * as crons from "../crons.js";
import type * as cycles from "../cycles.js";
import type * as http from "../http.js";
import type * as issueFilters from "../issueFilters.js";
import type * as issues from "../issues.js";
import type * as labels from "../labels.js";
import type * as lib_activity from "../lib/activity.js";
import type * as lib_agentAccess from "../lib/agentAccess.js";
import type * as lib_agentIds from "../lib/agentIds.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_entitlements from "../lib/entitlements.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_input from "../lib/input.js";
import type * as lib_issueOps from "../lib/issueOps.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as lib_plans from "../lib/plans.js";
import type * as lib_projectCounts from "../lib/projectCounts.js";
import type * as lib_seats from "../lib/seats.js";
import type * as lib_teamAccess from "../lib/teamAccess.js";
import type * as mcp_auth from "../mcp/auth.js";
import type * as mcp_client from "../mcp/client.js";
import type * as mcp_endpoint from "../mcp/endpoint.js";
import type * as mcp_issuer from "../mcp/issuer.js";
import type * as mcp_protocol from "../mcp/protocol.js";
import type * as mcp_registry from "../mcp/registry.js";
import type * as mcp_token from "../mcp/token.js";
import type * as mcp_tools_index from "../mcp/tools/index.js";
import type * as members from "../members.js";
import type * as organizations from "../organizations.js";
import type * as projects from "../projects.js";
import type * as roles from "../roles.js";
import type * as savedViews from "../savedViews.js";
import type * as search from "../search.js";
import type * as seed from "../seed.js";
import type * as teams from "../teams.js";
import type * as workflowStates from "../workflowStates.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activities: typeof activities;
  agentKeys: typeof agentKeys;
  agents: typeof agents;
  "ai/agent": typeof ai_agent;
  "ai/chat": typeof ai_chat;
  "ai/data": typeof ai_data;
  "ai/duplicates": typeof ai_duplicates;
  "ai/embeddingConfig": typeof ai_embeddingConfig;
  "ai/embeddings": typeof ai_embeddings;
  "ai/guard": typeof ai_guard;
  "ai/models": typeof ai_models;
  "ai/proposals": typeof ai_proposals;
  "ai/suggestions": typeof ai_suggestions;
  "ai/tools": typeof ai_tools;
  auditLogs: typeof auditLogs;
  billing: typeof billing;
  clerkSync: typeof clerkSync;
  comments: typeof comments;
  crons: typeof crons;
  cycles: typeof cycles;
  http: typeof http;
  issueFilters: typeof issueFilters;
  issues: typeof issues;
  labels: typeof labels;
  "lib/activity": typeof lib_activity;
  "lib/agentAccess": typeof lib_agentAccess;
  "lib/agentIds": typeof lib_agentIds;
  "lib/audit": typeof lib_audit;
  "lib/auth": typeof lib_auth;
  "lib/entitlements": typeof lib_entitlements;
  "lib/errors": typeof lib_errors;
  "lib/input": typeof lib_input;
  "lib/issueOps": typeof lib_issueOps;
  "lib/permissions": typeof lib_permissions;
  "lib/plans": typeof lib_plans;
  "lib/projectCounts": typeof lib_projectCounts;
  "lib/seats": typeof lib_seats;
  "lib/teamAccess": typeof lib_teamAccess;
  "mcp/auth": typeof mcp_auth;
  "mcp/client": typeof mcp_client;
  "mcp/endpoint": typeof mcp_endpoint;
  "mcp/issuer": typeof mcp_issuer;
  "mcp/protocol": typeof mcp_protocol;
  "mcp/registry": typeof mcp_registry;
  "mcp/token": typeof mcp_token;
  "mcp/tools/index": typeof mcp_tools_index;
  members: typeof members;
  organizations: typeof organizations;
  projects: typeof projects;
  roles: typeof roles;
  savedViews: typeof savedViews;
  search: typeof search;
  seed: typeof seed;
  teams: typeof teams;
  workflowStates: typeof workflowStates;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  agent: import("@convex-dev/agent/_generated/component.js").ComponentApi<"agent">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
