import { Skeleton } from "@/components/ui/skeleton";

/** Loading state for a work page: title, the ruled header, and table rows. */
export function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="pt-8" aria-busy="true" aria-label="Loading">
      <div className="px-3 md:px-6">
        <Skeleton className="h-12 w-72" />
      </div>
      <div className="mt-6 border-b border-rule" />
      <div className="mt-5 grid">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex h-10 items-center gap-4 border-b border-border px-3 md:px-6">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-2 w-14" />
            <Skeleton className="h-3 flex-1" />
            <Skeleton className="size-5 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
