import { api } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import type { AgentClient } from "../client";
import { formatDate } from "./resolve";

// Issues as an agent reads them: ids kept, plus the names behind them
// (state, labels, assignee, project) and dates as YYYY-MM-DD.

type PublicIssue = Omit<Doc<"issues">, "searchText" | "projectId" | "cycleId"> & {
  projectId: Id<"projects"> | null;
  cycleId: Id<"cycles"> | null;
};

const PRIORITY = ["none", "urgent", "high", "medium", "low"];

export async function presentIssues(client: AgentClient, issues: PublicIssue[]) {
  if (issues.length === 0) return [];
  const teamIds = [...new Set(issues.map((i) => i.teamId))];
  const [labels, members, projects, ...stateLists] = await Promise.all([
    client.query(api.labels.list, {}),
    client.query(api.members.list, {}),
    issues.some((i) => i.projectId !== null) ? client.query(api.projects.list, {}) : Promise.resolve([]),
    ...teamIds.map((teamId) => client.query(api.workflowStates.list, { teamId })),
  ]);
  const stateName = new Map(stateLists.flat().map((s) => [s._id as string, s.name]));
  const labelName = new Map(labels.map((l) => [l._id as string, l.name]));
  const memberName = new Map(members.map((m) => [m.userId, m.name ?? m.email ?? m.userId]));
  const projectName = new Map(projects.map((p) => [p._id as string, p.name]));
  return issues.map((issue) => ({
    _id: issue._id,
    identifier: issue.identifier,
    title: issue.title,
    description: issue.description,
    teamId: issue.teamId,
    state: stateName.get(issue.stateId) ?? null,
    stateId: issue.stateId,
    stateType: issue.stateType,
    priority: issue.priority,
    priorityName: PRIORITY[issue.priority] ?? "none",
    assigneeId: issue.assigneeId,
    assignee: issue.assigneeId === null ? null : (memberName.get(issue.assigneeId) ?? issue.assigneeId),
    creatorId: issue.creatorId,
    labels: issue.labelIds.map((id) => labelName.get(id)).filter((n): n is string => n !== undefined),
    labelIds: issue.labelIds,
    estimate: issue.estimate,
    dueDate: formatDate(issue.dueDate),
    parentId: issue.parentId,
    projectId: issue.projectId,
    project: issue.projectId === null ? null : (projectName.get(issue.projectId) ?? null),
    cycleId: issue.cycleId,
    archived: issue.archivedAt !== null,
    completedAt: issue.completedAt === null ? null : new Date(issue.completedAt).toISOString(),
    createdAt: new Date(issue._creationTime).toISOString(),
  }));
}
