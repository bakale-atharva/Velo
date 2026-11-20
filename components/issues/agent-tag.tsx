import type { Member } from "./lookups";

/**
 * Marks an agent member next to its name: a hairline-framed mono tag.
 * Paired with the square avatar, so agents never rely on one cue alone.
 */
export function AgentTag({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex h-[15px] shrink-0 items-center border border-current/40 px-1 font-mono text-[9.5px] leading-none tracking-[0.14em] uppercase opacity-80 ${className}`}
    >
      Agent
    </span>
  );
}

/** A member's name with the tag when it is an agent. */
export function MemberName({
  member,
  fallback = "Unknown member",
  className = "",
}: {
  member: Member | undefined | null;
  fallback?: string;
  className?: string;
}) {
  const name = member ? (member.name ?? member.email ?? fallback) : fallback;
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 ${className}`}>
      <span className="truncate">{name}</span>
      {member?.isAgent && <AgentTag />}
    </span>
  );
}

/**
 * `<option>`s for a native member select: people, then agents in their own
 * group (native selects can't show the tag, so the group label carries it).
 */
export function MemberOptions({ members }: { members: Member[] }) {
  const people = members.filter((m) => !m.isAgent);
  const agents = members.filter((m) => m.isAgent);
  const option = (m: Member) => (
    <option key={m.userId} value={m.userId}>
      {m.name ?? m.email ?? "Unknown member"}
    </option>
  );
  if (agents.length === 0) return <>{people.map(option)}</>;
  return (
    <>
      <optgroup label="People">{people.map(option)}</optgroup>
      <optgroup label="Agents">{agents.map(option)}</optgroup>
    </>
  );
}
