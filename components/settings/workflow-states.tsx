"use client";

import { useMutation } from "convex/react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/errors";

type StateType = Doc<"workflowStates">["type"];

const TYPES: { value: StateType; label: string }[] = [
  { value: "backlog", label: "Backlog" },
  { value: "unstarted", label: "Unstarted" },
  { value: "started", label: "Started" },
  { value: "completed", label: "Completed" },
  { value: "canceled", label: "Canceled" },
];

const typeLabel = (type: StateType) => TYPES.find((t) => t.value === type)!.label;

const iconButton =
  "grid size-8 place-items-center rounded-[10px] text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-ring";

const MESSAGES = {
  INVALID_INPUT: "That didn’t work. A state in use by issues can’t be deleted, and a team keeps at least one state.",
  FORBIDDEN: "Your role can’t change workflows. Ask a workspace admin.",
};

/** One state: colour, name (saved when you leave the field), type, order, delete. */
function StateRow({
  state,
  index,
  count,
  canManage,
  onMove,
}: {
  state: Doc<"workflowStates">;
  index: number;
  count: number;
  canManage: boolean;
  onMove: (from: number, to: number) => void;
}) {
  const update = useMutation(api.workflowStates.update);
  const remove = useMutation(api.workflowStates.remove);
  const [name, setName] = useState(state.name);
  const [color, setColor] = useState(state.color);

  const save = (patch: { name?: string; color?: string }) =>
    update({ stateId: state._id, ...patch }).catch((error: unknown) => {
      toast.error(errorMessage(error, MESSAGES));
      setName(state.name);
      setColor(state.color);
    });

  return (
    <li className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 rounded-[14px] px-3 py-2 hover:bg-tile/60 sm:grid-cols-[32px_minmax(0,1fr)_110px_auto]">
      <input
        type="color"
        aria-label={`Colour of ${state.name}`}
        disabled={!canManage}
        value={color}
        onChange={(e) => setColor(e.target.value)}
        onBlur={() => color !== state.color && save({ color })}
        className="size-8 cursor-pointer rounded-[10px] border border-input bg-transparent p-1 disabled:cursor-default"
      />
      <Input
        aria-label="State name"
        maxLength={40}
        readOnly={!canManage}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          if (name.trim() === "") setName(state.name);
          else if (name !== state.name) void save({ name });
        }}
      />
      <span className="hidden text-[13px] text-muted-foreground sm:block">{typeLabel(state.type)}</span>
      {canManage ? (
        <span className="flex items-center gap-1">
          <button type="button" aria-label={`Move ${state.name} up`} disabled={index === 0} onClick={() => onMove(index, index - 1)} className={iconButton}>
            <ArrowUp className="size-4" />
          </button>
          <button type="button" aria-label={`Move ${state.name} down`} disabled={index === count - 1} onClick={() => onMove(index, index + 1)} className={iconButton}>
            <ArrowDown className="size-4" />
          </button>
          <button
            type="button"
            aria-label={`Delete ${state.name}`}
            disabled={count === 1}
            onClick={() =>
              remove({ stateId: state._id })
                .then(() => toast.success(`Deleted ${state.name}`))
                .catch((error: unknown) => toast.error(errorMessage(error, MESSAGES)))
            }
            className={`${iconButton} hover:text-destructive`}
          >
            <Trash2 className="size-4" />
          </button>
        </span>
      ) : (
        <span />
      )}
    </li>
  );
}

/** A team's workflow: states in board order, editable with `teams.manage`. */
export function WorkflowStates({
  teamId,
  states,
  canManage,
}: {
  teamId: Id<"teams">;
  states: Doc<"workflowStates">[];
  canManage: boolean;
}) {
  const create = useMutation(api.workflowStates.create);
  const reorder = useMutation(api.workflowStates.reorder).withOptimisticUpdate((store, args) => {
    const current = store.getQuery(api.workflowStates.list, { teamId });
    if (current === undefined) return;
    const byId = new Map(current.map((s) => [s._id, s]));
    store.setQuery(
      api.workflowStates.list,
      { teamId },
      args.stateIds.map((id, position) => ({ ...byId.get(id)!, position })),
    );
  });
  const [name, setName] = useState("");
  const [type, setType] = useState<StateType>("unstarted");
  const [color, setColor] = useState("#6366d6");

  function move(from: number, to: number) {
    const ids = states.map((s) => s._id);
    [ids[from], ids[to]] = [ids[to]!, ids[from]!];
    reorder({ teamId, stateIds: ids }).catch((error: unknown) => toast.error(errorMessage(error, MESSAGES)));
  }

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (name.trim() === "") return;
    try {
      await create({ teamId, name, type, color });
      setName("");
    } catch (error) {
      toast.error(errorMessage(error, MESSAGES));
    }
  }

  return (
    <>
      <ul className="flex flex-col gap-0.5">
        {states.map((state, index) => (
          <StateRow
            key={state._id}
            state={state}
            index={index}
            count={states.length}
            canManage={canManage}
            onMove={move}
          />
        ))}
      </ul>
      {canManage && (
        <form onSubmit={add} className="mt-4 flex flex-wrap items-center gap-2 border-t border-border px-3 pt-4">
          <input
            type="color"
            aria-label="New state colour"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="size-9 cursor-pointer rounded-[10px] border border-input bg-transparent p-1"
          />
          <Input
            aria-label="New state name"
            placeholder="New state, e.g. In review"
            maxLength={40}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-56"
          />
          <select
            aria-label="New state type"
            value={type}
            onChange={(e) => setType(e.target.value as StateType)}
            className="h-9 rounded-[10px] border border-input bg-popover px-2 text-[14px] focus-visible:outline-2 focus-visible:outline-ring"
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <Button type="submit" variant="outline" disabled={name.trim() === ""}>
            Add state
          </Button>
        </form>
      )}
    </>
  );
}
