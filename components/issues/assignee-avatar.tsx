import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { displayName, initials, type Member } from "./lookups";

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
      <AvatarFallback className="bg-primary text-[11px] font-medium text-primary-foreground">
        {initials(member)}
      </AvatarFallback>
    </Avatar>
  );
}
