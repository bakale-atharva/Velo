import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { displayName, initials, type Member } from "./lookups";

// Initials sit on one of four greys from the signal scale (white text ≥ 4.5:1).
const FALLBACKS = ["#262626", "#3d3d3d", "#525252", "#171717"];

function hash(value: string) {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * A member's avatar, or a dashed empty circle for "unassigned". People are
 * round; agents are square (2px corners), so an agent reads as one at any
 * size without colour.
 */
export function AssigneeAvatar({ member, size = 20 }: { member: Member | undefined | null; size?: number }) {
  if (member === null || member === undefined) {
    return (
      <span
        role="img"
        aria-label="Unassigned"
        className="inline-block shrink-0 rounded-full border border-dashed border-input"
        style={{ width: size, height: size }}
      />
    );
  }
  const square = member.isAgent ? "rounded-[2px] after:rounded-[2px]" : "";
  return (
    <Avatar
      style={{ width: size, height: size }}
      className={`shrink-0 ring-1 ring-rule ${square}`}
      title={member.isAgent ? `${displayName(member)} (agent)` : displayName(member)}
    >
      {member.imageUrl !== null && (
        <AvatarImage src={member.imageUrl} alt="" className={`grayscale ${member.isAgent ? "rounded-[2px]" : ""}`} />
      )}
      <AvatarFallback
        className={`font-mono font-medium text-white ${member.isAgent ? "rounded-[2px]" : ""}`}
        style={{ background: FALLBACKS[hash(member.userId) % FALLBACKS.length], fontSize: Math.max(9, size * 0.36) }}
      >
        {initials(member)}
      </AvatarFallback>
    </Avatar>
  );
}
