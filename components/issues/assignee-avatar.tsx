import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { displayName, initials, type Member } from "./lookups";

// Initials sit on one of four deep tones (white text ≥ 4.5:1), picked per member.
const FALLBACKS = ["#12705f", "#b5501f", "#4f52c9", "#5b6b2e"];

function hash(value: string) {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return h;
}

/** A member's avatar, or a dashed empty circle for "unassigned". */
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
  return (
    <Avatar style={{ width: size, height: size }} className="shrink-0" title={displayName(member)}>
      {member.imageUrl !== null && <AvatarImage src={member.imageUrl} alt="" />}
      <AvatarFallback
        className="font-semibold text-white"
        style={{ background: FALLBACKS[hash(member.userId) % FALLBACKS.length], fontSize: Math.max(10, size * 0.38) }}
      >
        {initials(member)}
      </AvatarFallback>
    </Avatar>
  );
}
