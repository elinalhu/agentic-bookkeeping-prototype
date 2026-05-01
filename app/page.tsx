"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  effectiveTransaction,
  useActiveCompany,
  useDecisions,
} from "@/lib/store";
import { cn, formatCurrency } from "@/lib/utils";

// Dashboard stub modeled on Pilot's real dashboard. Most cards are mock
// numbers — this take-home is about the agentic Tasks enhancement, not
// the whole product. The dashboard mainly serves as a believable
// surface to land on, with one real link (Tasks) tied to the inbox.

export default function DashboardPage() {
  const { company, hydrated } = useActiveCompany();
  const { decisions } = useDecisions(company.id);

  const pendingTasks = useMemo(() => {
    if (!hydrated) return 0;
    return company.inbox
      .map((t) => effectiveTransaction(t, decisions))
      .filter((t) => t.status === "needs_review").length;
  }, [hydrated, company, decisions]);

  if (!hydrated) {
    return <div className="h-96 animate-pulse rounded-lg bg-zinc-100" />;
  }

  // Pretend numbers — labeled as such via a small footer note. Realistic
  // shapes (trend %, period vs prior month) so the dashboard reads as
  // intended rather than as obviously placeholder.
  const stats = [
    {
      label: "Revenue",
      value: company.id === "pinecrest" ? "$59,212.52" : "$250.00",
      delta: company.id === "pinecrest" ? "+12%" : "—",
      period: "Apr 2026 vs prior month",
    },
    {
      label: "Net income",
      value: company.id === "pinecrest" ? "$17,560.45" : "−$78,150.00",
      delta: company.id === "pinecrest" ? "+10%" : "—",
      period: "Apr 2026 vs prior month",
    },
    {
      label: "Cash balance",
      value: company.id === "pinecrest" ? "$2,142,135.75" : "$721,500.00",
      delta: company.id === "pinecrest" ? "+8%" : "−10%",
      period: "Today vs 30 days ago",
    },
    {
      label: "Card balance",
      value: "$5,340.25",
      delta: "−4%",
      period: "Today vs 30 days ago",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900">
          Welcome to {company.profile.name}
        </h1>
      </div>

      {/* Books-arrived banner — purely decorative, mimics Pilot's real
          dashboard hero. */}
      <div className="rounded-lg border border-violet-200 bg-violet-50 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-violet-900">
                April books are now available
              </span>
              <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-800">
                Draft
              </span>
            </div>
            <p className="mt-0.5 text-xs text-violet-800">
              Next draft by May 14, 2026 (10th business day)
            </p>
          </div>
          <div className="hidden text-xs text-violet-700 hover:underline sm:block">
            Download · View books
          </div>
        </div>
      </div>

      {/* Tasks callout — the only "real" link on this page. Pulls from
          live state so it reflects what's actually pending. */}
      <Link
        href="/tasks"
        className="block rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition-colors hover:bg-zinc-50"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-zinc-900">
                {pendingTasks > 0
                  ? `${pendingTasks} transaction${pendingTasks === 1 ? "" : "s"} need${pendingTasks === 1 ? "s" : ""} your review`
                  : "No tasks pending review"}
              </span>
              <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
                AI
              </span>
            </div>
            <p className="mt-0.5 text-xs text-zinc-600">
              {pendingTasks > 0
                ? "Pilot's agent has flagged ambiguous transactions for your input."
                : "The agent has handled this batch on its own."}
            </p>
          </div>
          <span className="text-sm text-violet-700">Open Tasks →</span>
        </div>
      </Link>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-zinc-500">{s.label}</div>
              <span className="text-zinc-300">›</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <div className="font-mono text-xl font-semibold text-zinc-900">
                {s.value}
              </div>
              <div
                className={cn(
                  "text-xs font-medium",
                  s.delta.startsWith("+")
                    ? "text-emerald-600"
                    : s.delta.startsWith("−")
                      ? "text-rose-600"
                      : "text-zinc-500",
                )}
              >
                {s.delta}
              </div>
            </div>
            <div className="mt-1 text-[11px] text-zinc-500">{s.period}</div>
          </div>
        ))}
      </div>

      {/* Stub for the chart area Pilot shows — kept simple to avoid
          building a real charts dependency. */}
      <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Cash flow</h2>
            <p className="text-xs text-zinc-500">Last 12 months</p>
          </div>
          <span className="text-zinc-300">›</span>
        </div>
        <div className="mt-4 h-40 rounded-md bg-gradient-to-b from-zinc-50 to-white">
          <div className="flex h-full items-end gap-1.5 px-4 pb-4 pt-2">
            {[16, 20, 9, 8, 11, 10, 17, 14, 19, 14, 12, 19].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm bg-violet-200"
                style={{ height: `${h * 4}%` }}
              />
            ))}
          </div>
        </div>
      </div>

      <p className="text-[11px] text-zinc-400">
        Numbers on this dashboard are placeholders. The agentic Tasks
        enhancement is the focus of this prototype — open Tasks to see it.
      </p>
    </div>
  );
}
