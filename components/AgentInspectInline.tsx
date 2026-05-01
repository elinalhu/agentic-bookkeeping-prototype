"use client";

import { useState } from "react";
import type { AgentResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  inspect: AgentResponse["inspect"];
}

// "Inline Inspect" — replaces the old slide-over drawer. Three
// collapsible cards (system prompt, full context, raw output) plus an
// always-visible stats line. Lives in the left pane, between the
// hypothesis and historic context, so the agent's transparency is
// front-and-center.

export function AgentInspectInline({ inspect }: Props) {
  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-4">
      <div className="flex items-center gap-2">
        <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-800">
          Pilot internal
        </span>
        <span className="text-xs text-violet-900">
          Agent internals — for QA & audit, not surfaced to customers
        </span>
      </div>

      <div className="mt-2 font-mono text-[11px] text-violet-800">
        <span className="font-semibold">model</span> {inspect.model}
        <span className="mx-2 text-violet-300">·</span>
        <span className="font-semibold">latency</span> {inspect.latencyMs}ms
        <span className="mx-2 text-violet-300">·</span>
        <span className="font-semibold">tokens</span>{" "}
        {(
          inspect.tokenUsage.input +
          inspect.tokenUsage.cacheCreationInput +
          inspect.tokenUsage.cacheReadInput
        ).toLocaleString()}in / {inspect.tokenUsage.output.toLocaleString()}out
        {inspect.tokenUsage.cacheReadInput > 0 ? (
          <>
            <span className="mx-2 text-violet-300">·</span>
            <span className="font-semibold">cache</span>{" "}
            {cachePct(inspect.tokenUsage)} hit
          </>
        ) : null}
      </div>

      <div className="mt-4 space-y-2">
        <Collapsible
          title="System prompt"
          subtitle="The instructions sent to the model on every call. Identical for every transaction; cached after the first request."
        >
          <Pre value={inspect.systemPrompt} />
        </Collapsible>

        <Collapsible
          title="Full context fed to the agent"
          subtitle="Business profile, chart of accounts, this transaction, prior similar transactions, active rules, cold-start flag."
        >
          <Json value={inspect.contextSentToAgent} />
        </Collapsible>

        <Collapsible
          title="Raw model output"
          subtitle="Exactly what the propose_categorization tool returned, before any UI massaging."
        >
          <Json value={inspect.rawModelOutput} />
        </Collapsible>
      </div>
    </div>
  );
}

function cachePct(u: AgentResponse["inspect"]["tokenUsage"]): string {
  const totalIn =
    u.input + u.cacheCreationInput + u.cacheReadInput;
  if (totalIn === 0) return "0%";
  return `${Math.round((u.cacheReadInput / totalIn) * 100)}%`;
}

function Collapsible({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50",
          open ? "border-b border-zinc-200" : "",
        )}
      >
        <div className="flex-1">
          <div className="text-sm font-semibold text-zinc-900">{title}</div>
          {subtitle ? (
            <div className="mt-0.5 text-xs text-zinc-500">{subtitle}</div>
          ) : null}
        </div>
        <span className="mt-0.5 text-zinc-400">{open ? "↑" : "↓"}</span>
      </button>
      {open ? (
        <div className="bg-zinc-50 p-4">
          <div className="max-h-96 overflow-auto">{children}</div>
        </div>
      ) : null}
    </div>
  );
}

function Pre({ value }: { value: string }) {
  return (
    <pre className="whitespace-pre-wrap font-mono text-xs leading-5 text-zinc-800">
      {value}
    </pre>
  );
}

function Json({ value }: { value: unknown }) {
  return (
    <pre className="whitespace-pre-wrap font-mono text-xs leading-5 text-zinc-800">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
