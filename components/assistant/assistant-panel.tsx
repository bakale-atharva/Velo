"use client";

import { useAction, useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { ArrowUp, Plus, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Markdown } from "@/components/issues/markdown";
import { UpgradePrompt } from "@/components/states/upgrade-prompt";
import { errorMessage } from "@/lib/errors";
import { ProposalCard } from "./proposal-card";

const PAGE_SIZE = 40;
const MAX_LENGTH = 4000;

const STARTERS = [
  "What’s urgent and still open?",
  "Summarize what my team did this week",
  "Which issues are assigned to me?",
];

type Notice = { tone: "error" | "info"; text: string } | null;

function Messages({ threadId }: { threadId: Id<"aiThreads"> }) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.ai.chat.listMessages,
    { threadId },
    { initialNumItems: PAGE_SIZE },
  );
  const proposals = useQuery(api.ai.proposals.listForThread, { threadId });
  const end = useRef<HTMLDivElement>(null);
  const messages = [...results].reverse().filter(
    (m) => m.status === "pending" || (m.text ?? "").trim() !== "",
  );
  // Proposals sit in the conversation where they were made.
  const oldestLoaded = messages[0]?._creationTime ?? 0;
  const timeline = [
    ...messages.map((m) => ({ kind: "message" as const, at: m._creationTime, message: m })),
    ...(proposals ?? [])
      .filter((p) => status === "Exhausted" || p._creationTime >= oldestLoaded)
      .map((p) => ({ kind: "proposal" as const, at: p._creationTime, proposal: p })),
  ].sort((a, b) => a.at - b.at);
  const last = timeline.at(-1);
  const lastKey = last === undefined ? undefined : last.kind === "message" ? last.message._id : last.proposal._id;
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [lastKey]);

  return (
    <div className="flex flex-col gap-4">
      {status === "CanLoadMore" && (
        <button
          type="button"
          onClick={() => loadMore(PAGE_SIZE)}
          className="self-center text-[13px] text-muted-foreground hover:text-foreground"
        >
          Load earlier messages
        </button>
      )}
      {timeline.map((item) => {
        if (item.kind === "proposal") {
          return <ProposalCard key={item.proposal._id} proposal={item.proposal} />;
        }
        const m = item.message;
        const role = m.message?.role;
        if (role === "user") {
          return (
            <div key={m._id} className="max-w-[85%] self-end rounded-[18px] rounded-br-md bg-primary px-4 py-2.5 text-[15px] leading-6 whitespace-pre-wrap text-primary-foreground">
              {m.text}
            </div>
          );
        }
        if (m.status === "pending" && (m.text ?? "") === "") {
          return <Thinking key={m._id} />;
        }
        return (
          <div key={m._id} className="max-w-full rounded-[18px] rounded-bl-md bg-tile px-4 py-3 text-[15px]">
            <Markdown>{m.text ?? ""}</Markdown>
          </div>
        );
      })}
      <div ref={end} />
    </div>
  );
}

function Thinking() {
  return (
    <div role="status" className="inline-flex items-center gap-2 self-start rounded-[18px] bg-tile px-4 py-3 text-[14px] text-muted-foreground">
      <span className="flex gap-1" aria-hidden>
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="size-1.5 animate-pulse rounded-full bg-muted-foreground motion-reduce:animate-none"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </span>
      Thinking…
    </div>
  );
}

function Chat() {
  const threads = useQuery(api.ai.chat.listThreads, {});
  const createThread = useMutation(api.ai.chat.createThread);
  const send = useAction(api.ai.chat.sendMessage);
  const [threadId, setThreadId] = useState<Id<"aiThreads"> | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  // Open the latest conversation until the member picks or starts one.
  const current = threadId ?? threads?.[0]?._id ?? null;

  async function submit(value: string) {
    const message = value.trim();
    if (message === "" || sending) return;
    setSending(true);
    setNotice(null);
    setText("");
    try {
      const id = current ?? (await createThread({}));
      setThreadId(id);
      const result = await send({ threadId: id, text: message });
      if (!result.ok) {
        setNotice({ tone: "error", text: "The assistant’s models are busy right now. Try again in a minute." });
      }
    } catch (error) {
      setText(message);
      setNotice({ tone: "error", text: errorMessage(error) });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 pb-3">
        <select
          aria-label="Conversation"
          value={current ?? ""}
          onChange={(e) => setThreadId(e.target.value === "" ? null : (e.target.value as Id<"aiThreads">))}
          disabled={threads === undefined || threads.length === 0}
          className="h-9 min-w-0 flex-1 rounded-[10px] border border-input bg-popover px-2 text-[14px] focus-visible:outline-2 focus-visible:outline-ring"
        >
          {(threads ?? []).length === 0 && <option value="">New conversation</option>}
          {(threads ?? []).map((thread) => (
            <option key={thread._id} value={thread._id}>
              {thread.title}
            </option>
          ))}
        </select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setNotice(null);
            void createThread({}).then(setThreadId);
          }}
        >
          <Plus aria-hidden />
          New chat
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
        {current === null ? (
          <div className="grid gap-3 pt-6">
            <p className="text-[15px] text-muted-foreground">
              Ask about your workspace, or ask it to draft issues. It shows every change as a proposal you apply yourself.
            </p>
            {STARTERS.map((starter) => (
              <button
                key={starter}
                type="button"
                onClick={() => void submit(starter)}
                className="rounded-[14px] bg-tile px-4 py-3 text-left text-[15px] hover:bg-muted"
              >
                {starter}
              </button>
            ))}
          </div>
        ) : (
          <Messages threadId={current} />
        )}
        {sending && current === null && <div className="pt-4"><Thinking /></div>}
      </div>

      {notice !== null && (
        <p role="alert" className={`mx-4 mb-2 rounded-[12px] px-3 py-2 text-[13px] ${notice.tone === "error" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
          {notice.text}
        </p>
      )}

      <form
        className="border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(text);
        }}
      >
        <div className="flex items-end gap-2 rounded-[16px] border border-input bg-popover p-2 focus-within:outline-2 focus-within:outline-ring">
          <textarea
            aria-label="Message the assistant"
            rows={2}
            maxLength={MAX_LENGTH}
            placeholder="Ask anything about your issues…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void submit(text);
              }
            }}
            className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-2 py-1.5 text-[15px] outline-none placeholder:text-muted-foreground"
          />
          <Button type="submit" size="icon" aria-label="Send" disabled={sending || text.trim() === ""} className="rounded-full">
            <ArrowUp aria-hidden />
          </Button>
        </div>
        <p className="mt-1.5 px-1 text-[12px] text-muted-foreground">Enter to send, Shift+Enter for a new line.</p>
      </form>
    </div>
  );
}

/** The assistant in a right-hand sheet. Without the plan feature, the upgrade prompt. */
export function AssistantPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const plan = useQuery(api.billing.currentPlan, open ? {} : "skip");
  const enabled = plan?.features.includes("ai_assistant");
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="px-4 pt-4 pb-3">
          <SheetTitle className="inline-flex items-center gap-2">
            <Sparkles className="size-4" aria-hidden />
            Assistant
          </SheetTitle>
          <SheetDescription>Answers from your workspace. Changes wait for your OK.</SheetDescription>
        </SheetHeader>
        {plan === undefined ? null : enabled ? (
          <Chat />
        ) : (
          <div className="p-4">
            <UpgradePrompt feature="ai_assistant" />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
