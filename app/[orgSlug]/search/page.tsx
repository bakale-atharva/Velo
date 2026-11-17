"use client";

import { useQuery } from "convex/react";
import { Search as SearchIcon } from "lucide-react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { IssueRow } from "@/components/issues/issue-row";
import { TeamPageHeader } from "@/components/issues/team-page-header";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorBoundary } from "@/components/states/error-boundary";
import { PageSkeleton } from "@/components/states/page-skeleton";

const DEBOUNCE_MS = 200;
const MAX_LENGTH = 200;

/** `value`, once it has stopped changing for `ms`. */
function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

function Search() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [text, setText] = useState(() => params.get("q") ?? "");
  const query = useDebounced(text.trim(), DEBOUNCE_MS);
  const results = useQuery(api.search.issues, query === "" ? "skip" : { query });

  // Keep the settled query in the URL so a search can be shared or reloaded.
  useEffect(() => {
    const current = new URLSearchParams(window.location.search).get("q") ?? "";
    if (current === query) return;
    router.replace(query === "" ? pathname : `${pathname}?q=${encodeURIComponent(query)}`, {
      scroll: false,
    });
  }, [query, pathname, router]);

  const pending = text.trim() !== query || (query !== "" && results === undefined);

  return (
    <div className="flex flex-1 flex-col">
      <TeamPageHeader title="Search" />
      <div className="px-3 pt-8 md:px-6">
        <label className="panel flex h-16 max-w-2xl items-center gap-3 px-5 focus-within:shadow-[inset_0_0_0_2px_var(--ring)]">
          <SearchIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <input
            type="search"
            aria-label="Search issues"
            autoFocus
            maxLength={MAX_LENGTH}
            placeholder="Search issue titles and descriptions"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full bg-transparent text-lg outline-none placeholder:text-muted-foreground"
          />
        </label>
        <p aria-live="polite" className="mt-3 h-5 px-1 text-[13px] text-muted-foreground tabular-nums">
          {query === ""
            ? "Matches words in titles and descriptions across every team you can see."
            : pending
              ? "Searching…"
              : `${results!.length} ${results!.length === 1 ? "result" : "results"}${
                  results!.length === 25 ? " (best 25 shown)" : ""
                }`}
        </p>
      </div>

      {query !== "" && results !== undefined && results.length === 0 && !pending && (
        <div className="px-3 pt-6 md:px-6">
          <EmptyState title={`Nothing matches “${query}”`}>
            Try fewer or different words. Archived issues aren’t searched.
          </EmptyState>
        </div>
      )}
      {results !== undefined && results.length > 0 && (
        <ul className={`panel mx-3 mt-6 mb-12 flex flex-col gap-0.5 p-3 md:mx-6 ${pending ? "opacity-60" : ""}`}>
          {results.map((issue) => (
            <li key={issue._id}>
              <IssueRow issue={issue} orgSlug={orgSlug} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageSkeleton />}>
        <Search />
      </Suspense>
    </ErrorBoundary>
  );
}
