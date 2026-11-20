"use client";

import { AssigneeAvatar } from "./assignee-avatar";
import { displayName, useWorkspaceLookups } from "./lookups";

/** The first few workspace members as overlapping avatars, then "+N". */
export function MemberStack({ max = 3 }: { max?: number }) {
  const { members } = useWorkspaceLookups();
  if (members.length === 0) return null;
  const shown = members.slice(0, max);
  const rest = members.length - shown.length;
  return (
    <div
      role="img"
      aria-label={`${members.length} members: ${members.map(displayName).join(", ")}`}
      className="flex items-center"
    >
      {shown.map((member, index) => (
        <span key={member.userId} className={`rounded-full ring-2 ring-background ${index > 0 ? "-ml-2" : ""}`}>
          <AssigneeAvatar member={member} size={28} />
        </span>
      ))}
      {rest > 0 && (
        <span className="data -ml-2 grid size-8 place-items-center rounded-full bg-popover text-[11px] ring-2 ring-background">
          +{rest}
        </span>
      )}
    </div>
  );
}
