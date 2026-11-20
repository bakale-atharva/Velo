import { Skeleton } from "@/components/ui/skeleton";

/** Shown while the workspace session resolves: the ruled sidebar and top strip. */
export function ShellSkeleton() {
  return (
    <div className="flex min-h-svh w-full">
      <div className="hidden w-60 shrink-0 border-r border-rule md:block" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col" aria-busy="true" aria-label="Loading workspace">
        <div className="h-12 border-b border-rule" />
        <div className="px-3 pt-8 md:px-6">
          <Skeleton className="h-14 w-72" />
          <div className="mt-6 h-16 border-y border-rule" />
          <div className="mt-6 grid gap-px">
            {Array.from({ length: 8 }, (_, index) => (
              <Skeleton key={index} className="h-9" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
