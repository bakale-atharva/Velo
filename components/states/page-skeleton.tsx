import { Skeleton } from "@/components/ui/skeleton";

/** Loading state for a work page: title, rule, and a column of rows. */
export function PageSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="px-8 py-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-12 w-72" />
      <div className="mt-4 h-px bg-rule" />
      <div className="mt-2 divide-y divide-border">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center gap-4 py-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="size-4 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
