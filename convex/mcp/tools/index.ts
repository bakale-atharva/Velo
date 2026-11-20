import type { Tool } from "../registry";
import { agentTools } from "./agents";
import { workspaceTools } from "./workspace";

/** Every tool the MCP server offers, in `tools/list` order. */
export const ALL_TOOLS: Tool[] = [...workspaceTools, ...agentTools];
