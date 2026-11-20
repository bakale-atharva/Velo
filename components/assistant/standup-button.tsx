"use client";

import { useQuery } from "convex/react";
import { Newspaper } from "lucide-react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ReportDialog } from "./report-dialog";

/** Picks a team, then shows its standup digest (done in the last day, in progress). */
export function StandupButton() {
  const teams = useQuery(api.teams.list, {});
  const [team, setTeam] = useState<{ id: Id<"teams">; name: string } | null>(null);
  const [picking, setPicking] = useState(false);
  return (
    <>
      <Popover open={picking} onOpenChange={setPicking}>
        <PopoverTrigger render={<Button variant="outline" size="sm" />}>
          <Newspaper aria-hidden />
          Standup
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 p-1">
          <p className="px-2 py-1.5 text-[12px] text-muted-foreground">Standup digest for…</p>
          {(teams ?? []).map((t) => (
            <button
              key={t._id}
              type="button"
              onClick={() => {
                setPicking(false);
                setTeam({ id: t._id, name: t.name });
              }}
              className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-[13.5px] hover:bg-muted"
            >
              <span className="text-[12px] text-muted-foreground">{t.key}</span>
              {t.name}
            </button>
          ))}
        </PopoverContent>
      </Popover>
      {team !== null && (
        <ReportDialog
          key={team.id}
          kind="standup"
          id={team.id}
          subject={`${team.name}, today`}
          open
          onOpenChange={(open) => {
            if (!open) setTeam(null);
          }}
        />
      )}
    </>
  );
}
