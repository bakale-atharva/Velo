"use client";

import { useMutation, useQuery } from "convex/react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/errors";
import {
  AssigneeSelect,
  CycleSelect,
  EstimateInput,
  LabelPicker,
  PrioritySelect,
  ProjectSelect,
  StateSelect,
} from "./fields";
import { IssueRow } from "./issue-row";
import { useWorkspaceLookups } from "./lookups";
import { Markdown } from "./markdown";
import { StateHeading } from "./state-heading";

type Issue = Omit<Doc<"issues">, "searchText">;
type Patch = Omit<Parameters<ReturnType<typeof useMutation<typeof api.issues.update>>>[0], "issueId">;

function useUpdate(issueId: Id<"issues">) {
  const update = useMutation(api.issues.update);
  return (patch: Patch) =>
    update({ issueId, ...patch }).catch((error: unknown) => toast.error(errorMessage(error)));
}

function Title({ issue }: { issue: Issue }) {
  const update = useUpdate(issue._id);
  const [value, setValue] = useState(issue.title);
  const [lastSynced, setLastSynced] = useState(issue.title);
  // A teammate renamed it while we were not editing: take their title.
  if (issue.title !== lastSynced) {
    setLastSynced(issue.title);
    setValue(issue.title);
  }
  const save = () => {
    const title = value.trim();
    if (title === "") setValue(issue.title);
    else if (title !== issue.title) void update({ title });
  };
  return (
    <textarea
      aria-label="Title"
      rows={1}
      value={value}
      maxLength={300}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      className="field-sizing-content w-full resize-none rounded-lg bg-transparent text-[30px] leading-9 font-semibold tracking-[-0.02em] outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
    />
  );
}

function Description({ issue }: { issue: Issue }) {
  const update = useUpdate(issue._id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(issue.description);
  if (!editing) {
    return (
      <section aria-label="Description" className="mt-4">
        {issue.description.trim() === "" ? (
          <p className="text-[15px] text-muted-foreground">No description.</p>
        ) : (
          <Markdown>{issue.description}</Markdown>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 -ml-2"
          onClick={() => {
            setDraft(issue.description);
            setEditing(true);
          }}
        >
          Edit description
        </Button>
      </section>
    );
  }
  return (
    <section aria-label="Edit description" className="mt-4 grid gap-2">
      <Textarea
        autoFocus
        rows={10}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Markdown supported"
        className="font-mono text-xs"
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={async () => {
            await update({ description: draft });
            setEditing(false);
          }}
        >
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
      {draft.trim() !== "" && (
        <div className="mt-2 rounded-[14px] bg-tile p-4">
          <p className="mb-2 text-[13px] font-medium text-muted-foreground">Preview</p>
          <Markdown>{draft}</Markdown>
        </div>
      )}
    </section>
  );
}

function Properties({ issue, states }: { issue: Issue; states: Doc<"workflowStates">[] }) {
  const update = useUpdate(issue._id);
  const { labels, members } = useWorkspaceLookups();
  const projects = useQuery(api.projects.list, {});
  const cycles = useQuery(api.cycles.list, { teamId: issue.teamId });
  const id = useId();
  const due = issue.dueDate === null ? "" : new Date(issue.dueDate).toISOString().slice(0, 10);
  const row = "grid grid-cols-[92px_minmax(0,1fr)] items-center gap-3 py-1.5 text-[14px]";
  return (
    <aside aria-label="Properties" className="panel p-5">
      <h2 className="mb-2 flex items-center gap-3 text-[15px] font-medium">
        <span aria-hidden className="h-6 w-[3px] rounded-full" style={{ background: `var(--state-${issue.stateType})` }} />
        Properties
      </h2>
      <label htmlFor={`${id}-state`} className={row}>
        <span className="text-muted-foreground">State</span>
        <StateSelect id={`${id}-state`} states={states} value={issue.stateId} onChange={(stateId) => update({ stateId })} />
      </label>
      <label htmlFor={`${id}-priority`} className={row}>
        <span className="text-muted-foreground">Priority</span>
        <PrioritySelect id={`${id}-priority`} value={issue.priority} onChange={(priority) => update({ priority })} />
      </label>
      <label htmlFor={`${id}-assignee`} className={row}>
        <span className="text-muted-foreground">Assignee</span>
        <AssigneeSelect id={`${id}-assignee`} members={members} value={issue.assigneeId} onChange={(assigneeId) => update({ assigneeId })} />
      </label>
      <div className={row}>
        <span className="text-muted-foreground">Labels</span>
        <LabelPicker labels={labels} value={issue.labelIds} onChange={(labelIds) => update({ labelIds })} />
      </div>
      <label htmlFor={`${id}-estimate`} className={row}>
        <span className="text-muted-foreground">Estimate</span>
        <EstimateInput id={`${id}-estimate`} value={issue.estimate} onChange={(estimate) => update({ estimate })} />
      </label>
      <label htmlFor={`${id}-due`} className={row}>
        <span className="text-muted-foreground">Due date</span>
        <Input
          id={`${id}-due`}
          type="date"
          value={due}
          onChange={(e) =>
            update({ dueDate: e.target.value === "" ? null : Date.parse(`${e.target.value}T00:00:00Z`) })
          }
          className="tabular-nums"
        />
      </label>
      <label htmlFor={`${id}-project`} className={row}>
        <span className="text-muted-foreground">Project</span>
        <ProjectSelect
          id={`${id}-project`}
          projects={projects ?? []}
          value={issue.projectId ?? null}
          onChange={(projectId) => update({ projectId })}
        />
      </label>
      <label htmlFor={`${id}-cycle`} className={row}>
        <span className="text-muted-foreground">Cycle</span>
        <CycleSelect
          id={`${id}-cycle`}
          cycles={cycles ?? []}
          value={issue.cycleId ?? null}
          onChange={(cycleId) => update({ cycleId })}
        />
      </label>
      <ParentRow issue={issue} />
    </aside>
  );
}

/**
 * Parents are set by adding a sub-issue from the parent's page. Linking to the
 * parent by identifier needs a backend lookup by id (planned with B6).
 */
function ParentRow({ issue }: { issue: Issue }) {
  const update = useUpdate(issue._id);
  return (
    <div className="grid grid-cols-[92px_minmax(0,1fr)] items-center gap-3 py-1.5 text-[14px]">
      <span className="text-muted-foreground">Parent</span>
      {issue.parentId === null ? (
        <span className="text-muted-foreground">None</span>
      ) : (
        <span className="flex items-center gap-2">
          <span>Sub-issue</span>
          <button type="button" className="text-muted-foreground underline" onClick={() => update({ parentId: null })}>
            Remove parent
          </button>
        </span>
      )}
    </div>
  );
}

function SubIssues({ issue, orgSlug }: { issue: Issue; orgSlug: string }) {
  const children = useQuery(api.issues.listSubIssues, { issueId: issue._id });
  const create = useMutation(api.issues.create);
  const [title, setTitle] = useState("");
  return (
    <section aria-label="Sub-issues" className="mt-10">
      <StateHeading name="Sub-issues" count={children?.length ?? 0} color="var(--state-started)" />
      <ul className="-mx-3 mt-3 flex flex-col gap-0.5">
        {children?.map((child) => (
          <li key={child._id}>
            <IssueRow issue={child} orgSlug={orgSlug} />
          </li>
        ))}
      </ul>
      <form
        className="mt-2 flex gap-2"
        onSubmit={async (event) => {
          event.preventDefault();
          if (title.trim() === "") return;
          try {
            await create({ teamId: issue.teamId, title, parentId: issue._id });
            setTitle("");
          } catch (error) {
            toast.error(errorMessage(error));
          }
        }}
      >
        <Input aria-label="New sub-issue title" placeholder="Add a sub-issue" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Button type="submit" variant="outline" disabled={title.trim() === ""}>
          Add
        </Button>
      </form>
    </section>
  );
}

export function IssueDetail({
  issue,
  states,
  orgSlug,
  children,
}: {
  issue: Issue;
  states: Doc<"workflowStates">[];
  orgSlug: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="grid items-start gap-5 px-3 pt-5 pb-12 md:px-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <article className="panel min-w-0 p-6 md:p-8">
        <span className="inline-flex h-7 items-center rounded-lg bg-chip px-2.5 text-[13px] font-medium text-muted-foreground tabular-nums">
          {issue.identifier}
        </span>
        <div className="mt-4">
          <Title key={issue._id} issue={issue} />
        </div>
        <Description key={`d-${issue._id}`} issue={issue} />
        <SubIssues issue={issue} orgSlug={orgSlug} />
        {children}
      </article>
      <Properties issue={issue} states={states} />
    </div>
  );
}
