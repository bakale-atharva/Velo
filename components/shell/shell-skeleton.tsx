import { Skeleton } from "@/components/ui/skeleton";

/** Shown while the workspace session resolves: sidebar and top bar panels on the canvas. */
export function ShellSkeleton() {
  return (
    <div className="flex min-h-svh w-full gap-3 p-3">
      <div className="panel hidden w-[calc(17.5rem-12px)] shrink-0 md:block" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-3" aria-busy="true" aria-label="Loading workspace">
        <div className="panel h-[68px]" />
        <div className="px-3 pt-8 md:px-6">
          <Skeleton className="h-9 w-64 rounded-xl" />
          <div className="mt-8 h-[3px] rounded-full bg-rule" />
          <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-80 rounded-[20px]" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
