"use client";

import { useState } from "react";
import { accountById } from "@/lib/fixtures";
import type { AgentHypothesis } from "@/lib/types";
import { ConfidenceChip } from "./ConfidenceChip";

interface Props {
  hypothesis: AgentHypothesis;
}

const VISIBLE_REASONS_DEFAULT = 3;

// Pure display: the agent's hypothesis card. Hypothesis, confidence,
// reasoning bullets, alternatives. No interactive resolution UI here —
// that lives in AgentActionPanel.

export function AgentHypothesisView({ hypothesis }: Props) {
  const [showAllReasons, setShowAllReasons] = useState(false);
  const account = accountById(hypothesis.accountId);
  const visibleReasons = showAllReasons
    ? hypothesis.reasoning
    : hypothesis.reasoning.slice(0, VISIBLE_REASONS_DEFAULT);
  const hiddenCount = Math.max(
    0,
    hypothesis.reasoning.length - VISIBLE_REASONS_DEFAULT,
  );

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Agent proposal
        </div>
        <ConfidenceChip
          level={hypothesis.confidence}
          score={hypothesis.confidenceScore}
        />
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <h2 className="text-xl font-semibold text-zinc-900">
          {account?.name ?? hypothesis.accountId}
        </h2>
        {account ? (
          <span className="text-xs text-zinc-500">
            {humanizeCategory(account.category)}
          </span>
        ) : null}
      </div>

      {account?.description ? (
        <p className="mt-1 text-xs text-zinc-500">{account.description}</p>
      ) : null}

      <ul className="mt-4 space-y-2">
        {visibleReasons.map((bullet, i) => (
          <li key={i} className="flex gap-2 text-sm text-zinc-700">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-400" />
            <span className="flex-1">{bullet}</span>
          </li>
        ))}
      </ul>
      {hiddenCount > 0 ? (
        <button
          onClick={() => setShowAllReasons((v) => !v)}
          className="mt-2 text-xs font-medium text-violet-700 hover:underline"
        >
          {showAllReasons
            ? "Show less"
            : `+${hiddenCount} more reason${hiddenCount === 1 ? "" : "s"}`}
        </button>
      ) : null}

      {hypothesis.alternatives?.length ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-medium text-zinc-600 hover:text-zinc-900">
            Alternatives considered ({hypothesis.alternatives.length})
          </summary>
          <ul className="mt-2 space-y-2 border-l-2 border-zinc-200 pl-3">
            {hypothesis.alternatives.map((alt, i) => (
              <li key={i} className="text-xs text-zinc-600">
                <span className="font-medium text-zinc-800">
                  {accountById(alt.accountId)?.name ?? alt.accountId}
                </span>
                {" — "}
                {alt.why}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function humanizeCategory(category: string): string {
  return category.replace("_", " ");
}
