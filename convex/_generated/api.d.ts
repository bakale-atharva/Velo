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
import type * as lib_auth from "../lib/auth.js";
import type * as lib_entitlements from "../lib/entitlements.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_input from "../lib/input.js";
import type * as lib_issueOps from "../lib/issueOps.js";
import type * as lib_plans from "../lib/plans.js";
import type * as lib_projectCounts from "../lib/projectCounts.js";
import type * as lib_seats from "../lib/seats.js";
import type * as lib_teamAccess from "../lib/teamAccess.js";
import type * as members from "../members.js";
import type * as organizations from "../organizations.js";
import type * as projects from "../projects.js";
import type * as teams from "../teams.js";
import type * as workflowStates from "../workflowStates.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activities: typeof activities;
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
  "lib/auth": typeof lib_auth;
  "lib/entitlements": typeof lib_entitlements;
  "lib/errors": typeof lib_errors;
  "lib/input": typeof lib_input;
  "lib/issueOps": typeof lib_issueOps;
  "lib/plans": typeof lib_plans;
  "lib/projectCounts": typeof lib_projectCounts;
  "lib/seats": typeof lib_seats;
  "lib/teamAccess": typeof lib_teamAccess;
  members: typeof members;
  organizations: typeof organizations;
  projects: typeof projects;
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

export declare const components: {};
