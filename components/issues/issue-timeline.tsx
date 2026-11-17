"use client";

import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/errors";
import { AssigneeAvatar } from "./assignee-avatar";
import { displayName, PRIORITY_LABELS, useWorkspaceLookups, type Member } from "./lookups";
import { Markdown } from "./markdown";

const PAGE = 50;

type Entry =
  | { kind: "comment"; at: number; comment: Doc<"comments"> }
  | { kind: "activity"; at: number; activity: Doc<"activities"> };

const time = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

function actorName(actorId: string, memberById: Map<string, Member>) {
  if (actorId === "system") return "Velo";
  return displayName(memberById.get(actorId));
}

/** One line per change, in plain words. */
function describe(activity: Doc<"activities">, memberById: Map<string, Member>): string {
  const { type, from, to } = activity;
  const person = (id: string | null) => (id === null ? "nobody" : displayName(memberById.get(id)));
  switch (type) {
    case "created":
      return "created the issue";
    case "title":
      return `renamed it to “${to}”`;
    case "description":
      return "edited the description";
    case "state":
      return `moved it from ${from} to ${to}`;
    case "priority":
      return `set priority to ${PRIORITY_LABELS[Number(to)] ?? to}`;
    case "assignee":
      return to === null ? `unassigned ${person(from)}` : `assigned ${person(to)}`;
    case "labels":
      return to === null ? "removed all labels" : `set labels to ${to}`;
    case "estimate":
      return to === null ? "cleared the estimate" : `set the estimate to ${to}`;
    case "dueDate":
      return to === null ? "cleared the due date" : `set the due date to ${new Date(Number(to)).toLocaleDateString()}`;
    case "parent":
      return to === null ? "removed the parent" : `made it a sub-issue of ${to}`;
    case "project":
      return to === null ? "removed it from its project" : `added it to ${to}`;
    case "cycle":
      return to === null ? "removed it from its cycle" : `moved it to ${to}`;
    case "comment":
      return to === "deleted" ? "deleted a comment" : to === "edited" ? "edited a comment" : "commented";
    case "archived":
      return "archived the issue";
  }
}

function CommentItem({ comment, me }: { comment: Doc<"comments">; me: string | undefined }) {
  const { memberById } = useWorkspaceLookups();
  const update = useMutation(api.comments.update);
  const remove = useMutation(api.comments.remove);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const author = memberById.get(comment.authorId);
  const mine = me === comment.authorId;
  return (
    <li className="grid grid-cols-[24px_minmax(0,1fr)] gap-3 border-t border-border py-3">
      <AssigneeAvatar member={author} size={24} />
      <div className="min-w-0">
        <p className="text-xs">
          <span className="font-semibold">{displayName(author)}</span>{" "}
          <span className="text-muted-foreground tabular-nums">
            {time.format(comment._creationTime)}
            {comment.editedAt !== null && " · edited"}
          </span>
        </p>
        {editing ? (
          <form
            className="mt-2 grid gap-2"
            onSubmit={async (event) => {
              event.preventDefault();
              try {
                await update({ commentId: comment._id, body: draft });
                setEditing(false);
              } catch (error) {
                toast.error(errorMessage(error));
              }
            }}
          >
            <Textarea aria-label="Edit comment" value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} />
            <div className="flex gap-2">
              <Button size="sm" type="submit" disabled={draft.trim() === ""}>
                Save
              </Button>
              <Button size="sm" variant="ghost" type="button" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <>
            <Markdown>{comment.body}</Markdown>
            {mine && (
              <div className="flex gap-3 text-xs text-muted-foreground">
                <button type="button" className="hover:text-foreground hover:underline" onClick={() => setEditing(true)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="hover:text-destructive hover:underline"
                  onClick={() => {
                    if (window.confirm("Delete this comment? This can’t be undone.")) {
                      remove({ commentId: comment._id }).catch((error: unknown) => toast.error(errorMessage(error)));
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </li>
  );
}

/** Comments and the activity feed, merged in time order, with a composer. */
export function IssueTimeline({ issueId }: { issueId: Id<"issues"> }) {
  const { memberById } = useWorkspaceLookups();
  const me = useQuery(api.members.me, {});
  const comments = usePaginatedQuery(api.comments.list, { issueId }, { initialNumItems: PAGE });
  const activities = usePaginatedQuery(api.activities.listForIssue, { issueId }, { initialNumItems: PAGE });
  const createComment = useMutation(api.comments.create);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const entries: Entry[] = [
    ...comments.results.map((comment) => ({ kind: "comment" as const, at: comment._creationTime, comment })),
    // Comment activities duplicate the comments themselves; keep only edits and deletions.
    ...activities.results
      .filter((activity) => activity.type !== "comment" || activity.to !== "created")
      .map((activity) => ({ kind: "activity" as const, at: activity._creationTime, activity })),
  ].sort((a, b) => a.at - b.at);

  const canLoadMore = comments.status === "CanLoadMore" || activities.status === "CanLoadMore";

  return (
    <section aria-label="Activity" className="mt-10">
      <h2 className="flex items-center gap-3 text-[15px] font-medium">
        <span aria-hidden className="h-6 w-[3px] rounded-full bg-state-completed" />
        Activity
      </h2>
      {canLoadMore && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2"
          onClick={() => {
            if (comments.status === "CanLoadMore") comments.loadMore(PAGE);
            if (activities.status === "CanLoadMore") activities.loadMore(PAGE);
          }}
        >
          Show older activity
        </Button>
      )}
      <ol>
        {entries.map((entry) =>
          entry.kind === "comment" ? (
            <CommentItem key={entry.comment._id} comment={entry.comment} me={me?.userId} />
          ) : (
            <li key={entry.activity._id} className="flex items-baseline gap-2 py-2 pl-9 text-[13px] text-muted-foreground">
              <span>
                <span className="font-medium text-foreground">{actorName(entry.activity.actorId, memberById)}</span>{" "}
                {describe(entry.activity, memberById)}
              </span>
              {entry.activity.viaAssistant && (
                <span className="iris-ring rounded-full px-2 text-[12px] leading-5 text-foreground [--iris-fill:var(--panel)]">
                  via assistant
                </span>
              )}
              <span className="ml-auto shrink-0 tabular-nums">{time.format(entry.activity._creationTime)}</span>
            </li>
          ),
        )}
      </ol>
      <form
        className="mt-4 grid gap-3 rounded-[18px] bg-tile p-4"
        onSubmit={async (event) => {
          event.preventDefault();
          if (body.trim() === "") return;
          setSending(true);
          try {
            await createComment({ issueId, body });
            setBody("");
          } catch (error) {
            toast.error(errorMessage(error));
          } finally {
            setSending(false);
          }
        }}
      >
        <Textarea
          aria-label="Comment"
          placeholder="Leave a comment (Markdown). ⌘↵ to send."
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
          }}
        />
        <div>
          <Button type="submit" disabled={sending || body.trim() === ""}>
            {sending ? "Sending…" : "Comment"}
          </Button>
        </div>
      </form>
    </section>
  );
}
