import { z } from "zod";
import type { AgentClient } from "./client";

// An MCP tool: a zod input schema (sent to clients as JSON Schema, and used
// to parse every call) and a `run` that calls Velo's public functions
// through the agent's client. Tools never touch the database themselves, so
// they get exactly the access the agent's role gives it.

export type ToolAnnotations = {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
};

export type Tool<Input extends z.ZodObject = z.ZodObject> = {
  name: string;
  title: string;
  description: string;
  input: Input;
  annotations: ToolAnnotations;
  run: (client: AgentClient, input: z.infer<Input>) => Promise<unknown>;
};

export function defineTool<Input extends z.ZodObject>(tool: Tool<Input>): Tool {
  return tool as unknown as Tool;
}

/** Read-only tools. */
export const READ: ToolAnnotations = { readOnlyHint: true };
/** Tools that change data without deleting anything. */
export const WRITE: ToolAnnotations = { readOnlyHint: false, destructiveHint: false };
/** Tools that delete, archive or revoke. Clients ask before running them. */
export const DESTRUCTIVE: ToolAnnotations = { readOnlyHint: false, destructiveHint: true };

/** The tool's input schema as JSON Schema, for `tools/list`. */
export function inputJsonSchema(tool: Tool): Record<string, unknown> {
  const schema = z.toJSONSchema(tool.input) as Record<string, unknown>;
  delete schema.$schema;
  return schema;
}
