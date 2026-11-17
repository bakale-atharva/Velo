import { Skeleton } from "@/components/ui/skeleton";

/** Loading state for a work page: title, rule, and a panel of rows. */
export function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="px-3 pt-8 md:px-6" aria-busy="true" aria-label="Loading">
      <div className="flex items-center gap-4">
        <Skeleton className="size-[18px] rounded-full" />
        <Skeleton className="h-9 w-64 rounded-xl" />
      </div>
      <div className="mt-8 h-[3px] rounded-full bg-rule" />
      <div className="panel mt-8 grid gap-2 p-4">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center gap-4 rounded-xl px-2 py-2">
            <Skeleton className="h-7 w-[72px] rounded-lg" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="size-6 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
