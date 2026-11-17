import { Skeleton } from "@/components/ui/skeleton";

/** Shown while the workspace session resolves: rail plus an empty field. */
export function ShellSkeleton() {
  return (
    <div className="flex min-h-svh w-full">
      <div className="hidden w-64 shrink-0 bg-sidebar md:block" aria-hidden />
      <div className="flex-1 px-8 py-6" aria-busy="true" aria-label="Loading workspace">
        <Skeleton className="h-12 w-64" />
        <div className="mt-4 h-px bg-rule" />
        <div className="mt-6 grid gap-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-8 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
