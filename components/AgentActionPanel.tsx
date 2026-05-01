"use client";

import { useState } from "react";
import { accountById } from "@/lib/fixtures";
import { useAgentResolution, useUserProfile } from "@/lib/store";
import type {
  AccountId,
  AgentHypothesis,
  AuditEvent,
  Rule,
  Transaction,
  TransactionStatus,
} from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";
import { AccountPicker } from "./AccountPicker";
import { AuditTrail } from "./AuditTrail";
import { RulePicker } from "./RulePicker";

interface Props {
  companyId: string;
  txn: Transaction;
  hypothesis: AgentHypothesis;
}

// All interactive resolution UI: clarifying question, feedback buttons
// (thumbs up / thumbs down / flag / skip), RulePicker, FlagNote,
// OverrideMode states. Lives in the right pane.
//
// The feedback framing — instead of admin-style "Confirm / Override /
// Flag / Skip" — is deliberate: this is the user training the agent.

export function AgentActionPanel({ companyId, txn, hypothesis }: Props) {
  const { resolve, skip, recordClarifyingAnswer } = useAgentResolution(
    companyId,
    txn,
    hypothesis,
  );
  const { profile } = useUserProfile();

  const [overrideMode, setOverrideMode] = useState(false);
  const [overrideAccount, setOverrideAccount] = useState<AccountId | null>(
    null,
  );
  const [pendingResolution, setPendingResolution] = useState<{
    accountId: AccountId;
    status: TransactionStatus;
  } | null>(null);
  const [flagging, setFlagging] = useState(false);
  const [flagNote, setFlagNote] = useState("");

  const suggestedAccount = accountById(hypothesis.accountId);

  const handleClarifyingOption = (
    suggestedAccountId: AccountId,
    label: string,
    nextAction: "confirm" | "split" | "ask_followup" | "flag",
  ) => {
    recordClarifyingAnswer(suggestedAccountId, label);
    if (nextAction === "flag") {
      setFlagging(true);
      return;
    }
    setPendingResolution({
      accountId: suggestedAccountId,
      status: "resolved_by_user",
    });
  };

  const handleRuleSave = (rule: Rule | null) => {
    if (!pendingResolution) return;
    resolve({
      accountId: pendingResolution.accountId,
      status: pendingResolution.status,
      rule,
    });
  };

  const handleFlag = () => {
    resolve({
      accountId: hypothesis.accountId,
      status: "flagged_for_cpa",
      note: flagNote,
      redirect: "/cpa",
    });
  };

  // Pending resolution (RulePicker open)
  if (pendingResolution) {
    return (
      <RulePicker
        txn={txn}
        accountId={pendingResolution.accountId}
        suggestedScope={mapAgentScope(hypothesis)}
        onSave={handleRuleSave}
        onCancel={() => setPendingResolution(null)}
      />
    );
  }

  // Flag-for-CPA flow
  if (flagging) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Ask the CPA to review
        </div>
        <p className="mt-1 text-xs text-zinc-600">
          Add a one-line note for the CPA. The agent&apos;s current
          hypothesis is preserved on the audit trail either way.
        </p>
        <textarea
          value={flagNote}
          onChange={(e) => setFlagNote(e.target.value)}
          placeholder="e.g. unsure if this should split between COGS and Software & Tech"
          className="mt-3 w-full rounded-md border border-zinc-300 bg-white p-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
          rows={3}
        />
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={handleFlag}
            className="rounded-md bg-violet-700 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-violet-800"
          >
            Send to CPA
          </button>
          <button
            onClick={() => setFlagging(false)}
            className="rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Override-mode flow
  if (overrideMode) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Pick the right account
        </div>
        <p className="mt-1 text-xs text-zinc-600">
          The agent learns from corrections. Picking a different category is
          recorded on the audit trail and used to refine future suggestions
          for similar transactions.
        </p>
        <div className="mt-3">
          <AccountPicker
            value={overrideAccount ?? hypothesis.accountId}
            onChange={(id) => setOverrideAccount(id)}
            label="Category"
          />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() =>
              setPendingResolution({
                accountId: overrideAccount ?? hypothesis.accountId,
                status: "resolved_by_user",
              })
            }
            className="rounded-md bg-violet-700 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-violet-800"
          >
            Save correction
          </button>
          <button
            onClick={() => {
              setOverrideMode(false);
              setOverrideAccount(null);
            }}
            className="rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Default: clarifying question (if any) + feedback buttons
  return (
    <div className="space-y-4">
      {hypothesis.clarifyingQuestion ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <div className="text-xs font-medium uppercase tracking-wide text-amber-900">
            One thing the agent needs from you
          </div>
          <p className="mt-1 text-sm text-amber-950">
            {hypothesis.clarifyingQuestion.text}
          </p>
          <div className="mt-4 flex flex-col gap-2">
            {hypothesis.clarifyingQuestion.options.map((opt) => (
              <button
                key={opt.label}
                onClick={() =>
                  handleClarifyingOption(
                    opt.suggestedAccountId,
                    opt.label,
                    opt.nextAction,
                  )
                }
                className="group flex w-full items-center gap-3 rounded-md border border-amber-300 bg-white p-3 text-left shadow-sm transition-colors hover:border-amber-400 hover:bg-amber-50"
              >
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-amber-400 bg-white transition-colors group-hover:border-amber-600 group-hover:bg-amber-100">
                  <span className="h-1.5 w-1.5 rounded-full bg-transparent group-hover:bg-amber-600" />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-medium text-zinc-900">
                    {opt.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-zinc-600">
                    {opt.nextAction === "flag"
                      ? "Sends to the bookkeeping team for review — agent's hypothesis is preserved on the audit trail"
                      : (
                          <>
                            Books to{" "}
                            {accountById(opt.suggestedAccountId)?.name ??
                              opt.suggestedAccountId}
                            {opt.nextAction === "split"
                              ? " — opens a split entry"
                              : ""}
                            {opt.nextAction === "ask_followup"
                              ? " — agent will ask one more thing"
                              : ""}
                          </>
                        )}
                  </span>
                </span>
                <span className="text-zinc-400 transition-colors group-hover:text-zinc-700">
                  →
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <FeedbackPanel
        profile={profile}
        suggestedAccountName={suggestedAccount?.name ?? hypothesis.accountId}
        hasClarifyingQuestion={!!hypothesis.clarifyingQuestion}
        onConfirm={() =>
          setPendingResolution({
            accountId: hypothesis.accountId,
            status: "resolved_by_user",
          })
        }
        onOverride={() => setOverrideMode(true)}
        onFlag={() => setFlagging(true)}
        onSkip={skip}
      />
    </div>
  );
}

// ---- Feedback panel ----

function FeedbackPanel({
  profile,
  suggestedAccountName,
  hasClarifyingQuestion,
  onConfirm,
  onOverride,
  onFlag,
  onSkip,
}: {
  profile: "owner" | "cpa";
  suggestedAccountName: string;
  hasClarifyingQuestion: boolean;
  onConfirm: () => void;
  onOverride: () => void;
  onFlag: () => void;
  onSkip: () => void;
}) {
  const helperText =
    profile === "cpa"
      ? "Your review is recorded on the audit trail. Each correction here also refines future agent suggestions for similar transactions."
      : "Your feedback trains the agent. Every confirmation, correction, or flag is recorded on the audit trail and shapes how the agent handles similar transactions in the future.";

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {profile === "cpa" ? "Review the agent" : "Help train the agent"}
        </div>
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            profile === "cpa"
              ? "bg-violet-100 text-violet-900"
              : "bg-zinc-100 text-zinc-700",
          )}
        >
          {profile === "cpa" ? "CPA" : "Owner"}
        </span>
      </div>
      <p className="mt-1 text-xs text-zinc-500">{helperText}</p>

      <div className="mt-4 space-y-2">
        <FeedbackButton
          accent="positive"
          icon={<ThumbsUpIcon />}
          title={hasClarifyingQuestion ? "Skip the question — looks right" : "Looks right"}
          subtitle={`Books to ${suggestedAccountName}`}
          onClick={onConfirm}
        />
        <FeedbackButton
          accent="negative"
          icon={<ThumbsDownIcon />}
          title="Wrong account"
          subtitle="Pick the right one"
          onClick={onOverride}
        />
        <FeedbackButton
          accent="warn"
          icon={<FlagIcon />}
          title={profile === "cpa" ? "Flag for follow-up" : "Ask the CPA"}
          subtitle="Send to the CPA review queue with a note"
          onClick={onFlag}
        />
        <FeedbackButton
          accent="neutral"
          icon={<SkipIcon />}
          title="Skip for now"
          subtitle="Keep in the inbox; decide later"
          onClick={onSkip}
        />
      </div>
    </div>
  );
}

// All four feedback buttons share the same visual weight — none is
// pre-selected. The accent only colors the icon, so the action's
// intent is legible (green = positive, red = correction, etc.) without
// implying a default choice.

type FeedbackAccent = "positive" | "negative" | "warn" | "neutral";

const ACCENT_STYLES: Record<FeedbackAccent, string> = {
  positive: "text-emerald-600",
  negative: "text-rose-600",
  warn: "text-amber-600",
  neutral: "text-zinc-500",
};

function FeedbackButton({
  accent,
  icon,
  title,
  subtitle,
  onClick,
}: {
  accent: FeedbackAccent;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-md border border-zinc-200 bg-white p-3 text-left shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50"
    >
      <span className={cn("shrink-0", ACCENT_STYLES[accent])}>{icon}</span>
      <span className="flex-1">
        <span className="block text-sm font-medium text-zinc-900">
          {title}
        </span>
        <span className="mt-0.5 block text-xs text-zinc-500">{subtitle}</span>
      </span>
    </button>
  );
}

// ---- Resolved-state notice (right pane) ----

export function ResolvedActionPanel({
  companyId,
  txn,
  decidedAt,
  hypothesisAtDecision,
  events,
}: {
  companyId: string;
  txn: Transaction;
  decidedAt: string;
  hypothesisAtDecision?: AgentHypothesis;
  events: AuditEvent[];
}) {
  const account = txn.categoryId ? accountById(txn.categoryId) : null;
  // Always-on hook so we can offer "Reopen for review" even after the
  // undo toast has expired. Requires a hypothesis — if there isn't one
  // (rare for resolved items), we hide the button.
  const hookHypothesis = hypothesisAtDecision;
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
        <div className="text-xs font-medium uppercase tracking-wide text-emerald-900">
          {txn.status === "auto_categorized"
            ? "Auto-categorized by agent"
            : txn.status === "rule_applied"
              ? "Auto-applied via rule"
              : txn.status === "flagged_for_cpa"
                ? "Flagged for CPA"
                : "Resolved"}
        </div>
        <div className="mt-1 text-sm text-emerald-950">
          Booked to{" "}
          <span className="font-medium">
            {account?.name ?? txn.categoryId}
          </span>{" "}
          on {formatDateTime(decidedAt)}.
        </div>
        {hypothesisAtDecision ? (
          <div className="mt-2 text-xs text-emerald-800">
            Agent had proposed{" "}
            <span className="font-medium">
              {accountById(hypothesisAtDecision.accountId)?.name ??
                hypothesisAtDecision.accountId}
            </span>{" "}
            at {hypothesisAtDecision.confidence} confidence.
          </div>
        ) : null}
        {hookHypothesis ? (
          <div className="mt-3 border-t border-emerald-200 pt-3">
            <ReopenButton
              companyId={companyId}
              txn={txn}
              hypothesis={hookHypothesis}
            />
          </div>
        ) : null}
      </div>

      {events.length > 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Audit trail
          </div>
          <div className="mt-3">
            <AuditTrail events={events} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function mapAgentScope(
  h: AgentHypothesis,
): "none" | "this_merchant" | "merchant_amount_band" {
  if (!h.proposedRule) return "none";
  if (h.proposedRule.scope === "this_transaction") return "none";
  return h.proposedRule.scope;
}

// "Reopen for review" — undoes the recorded decision so the txn
// returns to the needs-review queue. Audit trail keeps the original
// events plus a new "user_reopened" entry. Useful when the undo toast
// has already expired or the user is revisiting an old decision.
function ReopenButton({
  companyId,
  txn,
  hypothesis,
}: {
  companyId: string;
  txn: Transaction;
  hypothesis: AgentHypothesis;
}) {
  const { reopen } = useAgentResolution(companyId, txn, hypothesis);
  return (
    <button
      onClick={() => {
        reopen();
      }}
      className="text-xs font-medium text-emerald-900 underline-offset-2 hover:underline"
    >
      ↺ Reopen for review
    </button>
  );
}

// ---- Inline icons ----
// Lucide-style stroke icons inlined to avoid an extra dependency.

function ThumbsUpIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M7 10v12" />
      <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
    </svg>
  );
}

function ThumbsDownIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M17 14V2" />
      <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}

function SkipIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <polygon points="5 4 15 12 5 20 5 4" />
      <line x1="19" y1="5" x2="19" y2="19" />
    </svg>
  );
}
