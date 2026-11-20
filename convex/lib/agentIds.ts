// Agents are members whose user id is "agent_<random>" instead of a Clerk
// "user_..." id. Clerk never issues ids with this prefix.
export const AGENT_USER_PREFIX = "agent_";

export function isAgentUserId(userId: string): boolean {
  return userId.startsWith(AGENT_USER_PREFIX);
}
