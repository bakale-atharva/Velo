"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { PageSkeleton } from "@/components/states/page-skeleton";
import { errorMessage } from "@/lib/errors";
import { AssigneeAvatar } from "./assignee-avatar";
import { useWorkspaceLookups } from "./lookups";
import { PriorityRamp } from "./priority-ramp";

type Issue = Omit<Doc<"issues">, "searchText">;
type Column = { stateId: Id<"workflowStates">; issues: Issue[] };

function BoardItem({ issue, orgSlug }: { issue: Issue; orgSlug: string }) {
  const { memberById } = useWorkspaceLookups();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: issue._id,
  });
  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      aria-roledescription="Draggable issue"
      className={`touch-none border-b border-border bg-background py-2 outline-none focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-ring ${
        isDragging ? "relative z-10 bg-card shadow-[0_8px_24px_rgb(0_0_0/0.14)]" : ""
      }`}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
        <span>{issue.identifier}</span>
        <PriorityRamp priority={issue.priority} />
        <span className="ml-auto">
          <AssigneeAvatar member={issue.assigneeId === null ? null : memberById.get(issue.assigneeId)} size={18} />
        </span>
      </div>
      <Link
        href={`/${orgSlug}/issue/${issue.identifier}`}
        className="mt-1 block text-[13px] leading-4 font-medium hover:underline"
        onPointerDown={(event) => event.stopPropagation()}
      >
        {issue.title}
      </Link>
      {issue.estimate !== null && (
        <span className="mt-1 block text-xs text-muted-foreground tabular-nums">{issue.estimate} pt</span>
      )}
    </li>
  );
}

function BoardColumn({
  state,
  column,
  orgSlug,
}: {
  state: Doc<"workflowStates">;
  column: Column;
  orgSlug: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: state._id });
  const finished = state.type === "completed" || state.type === "canceled";
  const countColor =
    state.type === "started" ? "var(--brand-ink)" : finished ? "var(--muted-foreground)" : undefined;
  return (
    <section
      aria-label={`${state.name}, ${column.issues.length} issues`}
      className="flex min-w-[240px] flex-col border-r border-border px-4 pt-4 last:border-r-0"
    >
      <header
        className="flex items-baseline justify-between border-b-4 pb-2"
        style={{ borderColor: finished ? "var(--state-canceled)" : `var(--state-${state.type})` }}
      >
        <h2 className={`text-[13px] font-semibold ${finished ? "text-muted-foreground" : ""}`}>{state.name}</h2>
        <span
          className="font-display text-[64px] leading-[56px] font-extrabold tracking-[-0.04em] tabular-nums [font-stretch:75%]"
          style={{ color: countColor }}
        >
          {column.issues.length}
        </span>
      </header>
      <SortableContext items={column.issues.map((issue) => issue._id)} strategy={verticalListSortingStrategy}>
        <ul
          ref={setNodeRef}
          className={`min-h-24 flex-1 pb-8 ${isOver ? "bg-muted" : ""}`}
        >
          {column.issues.map((issue) => (
            <BoardItem key={issue._id} issue={issue} orgSlug={orgSlug} />
          ))}
        </ul>
      </SortableContext>
    </section>
  );
}

/** Where a drop lands: the target column and the issue ids around the drop point. */
function dropTarget(columns: Column[], activeId: string, overId: string) {
  const columnOf = (id: string) =>
    columns.find((column) => column.stateId === id || column.issues.some((issue) => issue._id === id));
  const target = columnOf(overId);
  if (target === undefined) return null;
  const others = target.issues.filter((issue) => issue._id !== activeId);
  const overIndex = others.findIndex((issue) => issue._id === overId);
  const index = overIndex === -1 ? others.length : overIndex;
  // Dropping on an issue below the dragged one in the same column puts it after that issue.
  const source = columnOf(activeId);
  const activeIndex = target.issues.findIndex((issue) => issue._id === activeId);
  const shift = source === target && activeIndex !== -1 && activeIndex <= overIndex ? 1 : 0;
  const at = Math.min(index + shift, others.length);
  return {
    stateId: target.stateId,
    index: at,
    beforeRank: at > 0 ? others[at - 1]!.rank : null,
    afterRank: at < others.length ? others[at]!.rank : null,
  };
}

/** The team board: one column per state, drag to move or reorder. */
export function IssueBoard({
  teamId,
  states,
  orgSlug,
}: {
  teamId: Id<"teams">;
  states: Doc<"workflowStates">[];
  orgSlug: string;
}) {
  const columns = useQuery(api.issues.listForBoard, { teamId });
  const move = useMutation(api.issues.move).withOptimisticUpdate((store, args) => {
    const current = store.getQuery(api.issues.listForBoard, { teamId });
    if (current === undefined) return;
    const moving = current.flatMap((column) => column.issues).find((issue) => issue._id === args.issueId);
    const state = states.find((s) => s._id === args.stateId);
    if (moving === undefined || state === undefined) return;
    const updated = { ...moving, stateId: args.stateId, stateType: state.type };
    store.setQuery(
      api.issues.listForBoard,
      { teamId },
      current.map((column) => {
        const rest = column.issues.filter((issue) => issue._id !== args.issueId);
        if (column.stateId !== args.stateId) return { ...column, issues: rest };
        const at = args.afterRank === null ? rest.length : rest.findIndex((issue) => issue.rank === args.afterRank);
        const issues = [...rest];
        issues.splice(at === -1 ? rest.length : at, 0, updated);
        return { ...column, issues };
      }),
    );
  });
  if (columns === undefined) {
    return <PageSkeleton />;
  }
  return (
    <Board
      columns={columns}
      states={states}
      orgSlug={orgSlug}
      onMove={(args) => move(args).catch((error: unknown) => toast.error(errorMessage(error)))}
    />
  );
}

export type MoveArgs = {
  issueId: Id<"issues">;
  stateId: Id<"workflowStates">;
  beforeRank: string | null;
  afterRank: string | null;
};

/**
 * One column per state; dragging a card calls `onMove` with the target state
 * and the ranks of the cards it lands between. Columns hold issues in rank
 * order.
 */
export function Board({
  columns,
  states,
  orgSlug,
  onMove,
}: {
  columns: Column[];
  states: Doc<"workflowStates">[];
  orgSlug: string;
  onMove: (args: MoveArgs) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(event: DragEndEvent) {
    if (event.over === null) return;
    const activeId = String(event.active.id);
    const target = dropTarget(columns, activeId, String(event.over.id));
    if (target === null) return;
    const source = columns.find((column) => column.issues.some((issue) => issue._id === activeId));
    const sourceIndex = source?.issues.findIndex((issue) => issue._id === activeId) ?? -1;
    if (source?.stateId === target.stateId && sourceIndex === target.index) return;
    onMove({
      issueId: activeId as Id<"issues">,
      stateId: target.stateId,
      beforeRank: target.beforeRank,
      afterRank: target.afterRank,
    });
  }

  const byState = new Map(columns.map((column) => [column.stateId, column]));
  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
      <div className="grid flex-1 auto-cols-[minmax(240px,1fr)] grid-flow-col overflow-x-auto">
        {states.map((state) => (
          <BoardColumn
            key={state._id}
            state={state}
            column={byState.get(state._id) ?? { stateId: state._id, issues: [] }}
            orgSlug={orgSlug}
          />
        ))}
      </div>
    </DndContext>
  );
}
