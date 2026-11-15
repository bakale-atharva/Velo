/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as billing from "../billing.js";
import type * as clerkSync from "../clerkSync.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_entitlements from "../lib/entitlements.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_plans from "../lib/plans.js";
import type * as lib_seats from "../lib/seats.js";
import type * as members from "../members.js";
import type * as organizations from "../organizations.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  billing: typeof billing;
  clerkSync: typeof clerkSync;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  "lib/entitlements": typeof lib_entitlements;
  "lib/errors": typeof lib_errors;
  "lib/plans": typeof lib_plans;
  "lib/seats": typeof lib_seats;
  members: typeof members;
  organizations: typeof organizations;
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
