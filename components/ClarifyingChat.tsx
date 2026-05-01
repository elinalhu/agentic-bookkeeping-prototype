"use client";

import { useEffect, useRef, useState } from "react";
import type { AgentHypothesis, Transaction } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  companyId: string;
  txn: Transaction;
  hypothesis: AgentHypothesis;
  // Suggestions shown as quick-pick chips above the input. Vary per
  // transaction — the deep-dive (AWS) gets COGS-flavored suggestions,
  // the owner $15k gets reimbursement / loan / bonus follow-ups.
  suggestions?: string[];
}

const DEFAULT_SUGGESTIONS = [
  "Why didn't you pick the alternative?",
  "What would change your mind?",
  "How does this affect my tax return?",
];

export function ClarifyingChat({
  companyId,
  txn,
  hypothesis,
  suggestions,
}: Props) {
  // Collapsed by default — most decisions resolve via the structured
  // action panel; chat earns its keep on deep-dive edge cases. Hide it
  // until the user explicitly opens it.
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom on every message update.
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || sending) return;
    setError(null);
    setInput("");
    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: text },
    ];
    // Push an empty assistant message we'll fill via stream.
    setMessages([...nextMessages, { role: "assistant", content: "" }]);
    setSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          transactionId: txn.id,
          hypothesis,
          messages: nextMessages,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(
          errBody?.error ?? `Chat request failed (HTTP ${res.status})`,
        );
      }

      if (!res.body) throw new Error("No response stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantText += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: "assistant",
            content: assistantText,
          };
          return next;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      // Drop the empty assistant message.
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setSending(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="group flex w-full items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-left shadow-sm transition-colors hover:border-violet-300 hover:bg-violet-50"
      >
        <ChatBubbleIcon />
        <span className="flex-1">
          <span className="block text-sm font-medium text-zinc-900 group-hover:text-violet-900">
            Discuss with the agent
          </span>
          <span className="block text-xs text-zinc-500 group-hover:text-violet-700">
            Ask follow-ups, or give new info to revise the agent&apos;s
            recommendation
          </span>
        </span>
        <span className="text-zinc-400 group-hover:text-violet-700">→</span>
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">
            Discuss with the agent
          </h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            Follow-up questions stay scoped to this transaction. The agent
            can revise its hypothesis if you give it new info.
          </p>
        </div>
        <button
          onClick={() => setExpanded(false)}
          className="shrink-0 rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
        >
          Hide
        </button>
      </div>

      {messages.length > 0 ? (
        <div
          ref={scrollRef}
          className="mt-4 max-h-80 space-y-3 overflow-y-auto rounded-md border border-zinc-200 bg-zinc-50 p-3"
        >
          {messages.map((m, i) => (
            <Message key={i} role={m.role} content={m.content} />
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
          {error}
        </div>
      ) : null}

      {messages.length === 0 && (suggestions ?? DEFAULT_SUGGESTIONS).length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {(suggestions ?? DEFAULT_SUGGESTIONS).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void send(s)}
              disabled={sending}
              className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50 disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="mt-3 flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
          placeholder="Ask a follow-up… (Enter to send, Shift+Enter for newline)"
          rows={2}
          className="min-h-[40px] flex-1 resize-y rounded-md border border-zinc-300 bg-white p-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
          disabled={sending}
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="rounded-md bg-violet-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          {sending ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
}

function ChatBubbleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0 text-violet-600"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function Message({ role, content }: ChatMessage) {
  const isUser = role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3 py-2 text-sm",
          isUser
            ? "bg-zinc-900 text-white"
            : "bg-white text-zinc-900 ring-1 ring-inset ring-zinc-200",
        )}
      >
        {content || (
          <span className="inline-block animate-pulse text-zinc-400">▍</span>
        )}
      </div>
    </div>
  );
}
