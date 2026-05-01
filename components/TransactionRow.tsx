"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { accountById, chartOfAccounts } from "@/lib/fixtures";
import { useAgentResolution } from "@/lib/store";
import type {
  AccountId,
  AgentHypothesis,
  ConfidenceLevel,
  Rule,
  Transaction,
} from "@/lib/types";
import { cn, formatCurrency, formatDateShort } from "@/lib/utils";

type RuleScope = "none" | "this_merchant" | "merchant_amount_band";
const AMOUNT_BAND_PCT = 0.2;
import { StatusBadge } from "./StatusBadge";
import { Tooltip } from "./Tooltip";

interface Props {
  txn: Transaction;
  prediction?: AgentHypothesis;
  predictionPending?: boolean;
  companyId?: string;
}

// Top-level dispatcher: actionable rows get the full state-owning
// ActionableRow; non-actionable rows get a simpler read-only display.
// Both rows: click anywhere on the merchant area navigates to the
// detail page. Reasoning is surfaced inline via a hover-tooltip on a
// small purple help icon — no inline expansion any more.

export function TransactionRow(props: Props) {
  const { txn, prediction, companyId } = props;
  const isActionable =
    !!prediction &&
    !!companyId &&
    (txn.status === "needs_review" || txn.status === "auto_categorized");

  if (isActionable && prediction && companyId) {
    return (
      <ActionableRow
        txn={txn}
        prediction={prediction}
        companyId={companyId}
      />
    );
  }
  return <NonActionableRow {...props} />;
}

// ---- Non-actionable row (resolved / flagged / pending / no prediction) ----

function NonActionableRow({ txn, prediction, predictionPending }: Props) {
  const sign = txn.direction === "inflow" ? "+" : "−";
  const finalCategory = txn.categoryId
    ? accountById(txn.categoryId)
    : undefined;

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-zinc-50">
        <Link
          href={`/transactions/${txn.id}`}
          className="flex min-w-0 flex-1 items-center gap-4"
        >
          <div className="w-16 shrink-0 text-xs text-zinc-500">
            {formatDateShort(txn.date)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-zinc-900">
              {txn.merchant}
            </div>
            <div className="truncate font-mono text-xs text-zinc-500">
              {txn.memo}
              {finalCategory ? (
                <>
                  <span className="mx-1.5 text-zinc-300">·</span>
                  <span className="text-zinc-600">{finalCategory.name}</span>
                </>
              ) : null}
            </div>
          </div>
        </Link>

        {prediction ? (
          <ReasoningHelpIcon reasoning={prediction.reasoning[0] ?? ""} />
        ) : null}

        {predictionPending ? (
          <PendingChip />
        ) : (
          <StatusBadge status={txn.status} />
        )}

        <div className="w-28 shrink-0 text-right font-mono text-sm tabular-nums">
          <span
            className={cn(
              "font-medium",
              txn.direction === "inflow"
                ? "text-emerald-700"
                : "text-zinc-900",
            )}
          >
            {sign}
            {formatCurrency(txn.amount)}
          </span>
        </div>

        <Link
          href={`/transactions/${txn.id}`}
          className="text-zinc-400 hover:text-zinc-700"
          title="Open full view"
        >
          →
        </Link>
      </div>
    </div>
  );
}

// ---- Actionable row (needs_review or auto_categorized) ----

function ActionableRow({
  txn,
  prediction,
  companyId,
}: {
  txn: Transaction;
  prediction: AgentHypothesis;
  companyId: string;
}) {
  const [draft, setDraft] = useState<AccountId>(prediction.accountId);
  const [ruleScope, setRuleScope] = useState<RuleScope>("none");
  const [openSignal, setOpenSignal] = useState(0);
  // Mirrors the combobox's internal open state — used to give 👎 a
  // visual "selected" state while the user is picking a replacement.
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [flagging, setFlagging] = useState(false);
  const [flagNote, setFlagNote] = useState("");

  const { resolve } = useAgentResolution(companyId, txn, prediction);

  useEffect(() => {
    setDraft(prediction.accountId);
  }, [prediction.accountId]);

  const sign = txn.direction === "inflow" ? "+" : "−";
  const isModified = draft !== prediction.accountId;
  const draftAccountName = accountById(draft)?.name ?? draft;

  const buildRuleFor = (accountId: AccountId, scope: RuleScope): Rule | null => {
    if (scope === "none") return null;
    const now = new Date().toISOString();
    const bandLow = txn.amount * (1 - AMOUNT_BAND_PCT);
    const bandHigh = txn.amount * (1 + AMOUNT_BAND_PCT);
    return {
      id: `rule.${txn.merchant.toLowerCase()}.${Date.now()}`,
      createdAt: now,
      scope,
      merchant: txn.merchant,
      amountMin: scope === "merchant_amount_band" ? bandLow : undefined,
      amountMax: scope === "merchant_amount_band" ? bandHigh : undefined,
      accountId,
      createdBy: "owner",
      lastConfirmedAt: now,
      applicationsCount: 0,
    };
  };

  const resetLocalState = () => {
    setDraft(prediction.accountId);
    setRuleScope("none");
    setFlagging(false);
    setFlagNote("");
  };

  // 👍 always means "Confirm the agent's pick" — uses the original
  // hypothesis, not whatever the user has typed into the dropdown.
  const handleConfirmAgentPick = () => {
    const accountId = prediction.accountId;
    resolve({
      accountId,
      status: "resolved_by_user",
      rule: buildRuleFor(accountId, ruleScope),
      redirect: null,
    });
    resetLocalState();
  };

  // Save change — explicitly saves the user's modified dropdown selection.
  const handleSaveChange = () => {
    resolve({
      accountId: draft,
      status: "resolved_by_user",
      rule: buildRuleFor(draft, ruleScope),
      redirect: null,
    });
    resetLocalState();
  };

  const handleDisagree = () => {
    setOpenSignal((s) => s + 1);
  };

  const handleFlagToggle = () => {
    setFlagging(true);
    setRuleScope("none");
  };

  const handleSendFlag = () => {
    resolve({
      accountId: draft,
      status: "flagged_for_cpa",
      note: flagNote,
      redirect: null,
    });
    resetLocalState();
  };

  const handleCancelFlag = () => {
    setFlagging(false);
    setFlagNote("");
  };

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* Top row — vendor, help icon, category, amount, nav arrow.
          Clicking the merchant area navigates to the detail page. */}
      <div className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-zinc-50">
        <Link
          href={`/transactions/${txn.id}`}
          className="flex min-w-0 flex-1 items-center gap-4"
        >
          <div className="w-16 shrink-0 text-xs text-zinc-500">
            {formatDateShort(txn.date)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-zinc-900">
              {txn.merchant}
            </div>
            <div className="truncate font-mono text-xs text-zinc-500">
              {txn.memo}
            </div>
          </div>
        </Link>

        <CategoryCombobox
          value={draft}
          modified={isModified}
          onChange={setDraft}
          openSignal={openSignal}
          onOpenChange={setDropdownOpen}
        />

        <ConfidenceBadge
          level={prediction.confidence}
          score={prediction.confidenceScore}
        />

        <ReasoningHelpIcon reasoning={prediction.reasoning[0] ?? ""} />

        <div className="w-28 shrink-0 text-right font-mono text-sm tabular-nums">
          <span
            className={cn(
              "font-medium",
              txn.direction === "inflow"
                ? "text-emerald-700"
                : "text-zinc-900",
            )}
          >
            {sign}
            {formatCurrency(txn.amount)}
          </span>
        </div>

        <Tooltip content="Open full view">
          <Link
            href={`/transactions/${txn.id}`}
            className="text-zinc-400 hover:text-zinc-700"
            onClick={(e) => e.stopPropagation()}
          >
            →
          </Link>
        </Tooltip>
      </div>

      {/* Bottom row — rule scope chips + action buttons. */}
      <div
        className={cn(
          "flex items-center gap-3 border-t border-zinc-100 px-5 py-2 text-xs transition-colors",
          ruleScope !== "none" ? "bg-violet-50" : "bg-white",
        )}
      >
        <RuleScopeChips
          txn={txn}
          accountName={draftAccountName}
          scope={ruleScope}
          onChange={setRuleScope}
        />

        <div className="flex shrink-0 items-center gap-1.5">
          <Tooltip
            content={
              isModified
                ? `Confirm agent's pick (${accountById(prediction.accountId)?.name ?? prediction.accountId}) — discards your dropdown change`
                : `Confirm ${draftAccountName}${ruleScope !== "none" ? ` and save rule` : ""}`
            }
          >
            <IconButton
              onClick={handleConfirmAgentPick}
              accent="positive"
              ariaLabel="Confirm agent's pick"
            >
              <ThumbsUpIcon />
            </IconButton>
          </Tooltip>
          <Tooltip content="Disagree — pick a different category">
            <IconButton
              onClick={handleDisagree}
              accent="negative"
              selected={dropdownOpen || isModified}
              ariaLabel="Disagree with agent"
            >
              <ThumbsDownIcon />
            </IconButton>
          </Tooltip>
          <Tooltip content="Send to CPA review">
            <IconButton
              onClick={handleFlagToggle}
              accent="warn"
              selected={flagging}
              ariaLabel="Send to CPA"
            >
              <FlagIcon />
            </IconButton>
          </Tooltip>
          {isModified ? (
            <>
              <span aria-hidden className="mx-1 h-5 w-px bg-zinc-200" />
              <Tooltip
                content={`Save: ${draftAccountName}${ruleScope !== "none" ? ` (and save rule)` : ""}`}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSaveChange();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md border border-violet-300 bg-white px-2.5 py-1 text-xs font-medium text-violet-700 shadow-sm transition-colors hover:border-violet-500 hover:bg-violet-50"
                >
                  <CheckIcon /> Save change
                </button>
              </Tooltip>
              <Tooltip content="Discard your change, keep agent's pick in the dropdown">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDraft(prediction.accountId);
                    setRuleScope("none");
                  }}
                  className="rounded-md px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100"
                >
                  Cancel
                </button>
              </Tooltip>
            </>
          ) : null}
        </div>
      </div>

      {flagging ? (
        <FlagNoteRow
          note={flagNote}
          onChange={setFlagNote}
          onSend={handleSendFlag}
          onCancel={handleCancelFlag}
        />
      ) : null}
    </div>
  );
}

// ---- Inline rule scope picker (3 compact chips) ----

function RuleScopeChips({
  txn,
  accountName,
  scope,
  onChange,
}: {
  txn: Transaction;
  accountName: string;
  scope: RuleScope;
  onChange: (s: RuleScope) => void;
}) {
  const bandLow = txn.amount * (1 - AMOUNT_BAND_PCT);
  const bandHigh = txn.amount * (1 + AMOUNT_BAND_PCT);
  const hasRule = scope !== "none";

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5">
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
        Rule:
      </span>
      <select
        value={scope}
        onChange={(e) => onChange(e.target.value as RuleScope)}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "min-w-0 max-w-xs truncate rounded-md border py-0.5 pl-2 pr-6 text-[11px] font-medium shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-violet-400",
          hasRule
            ? "border-violet-400 bg-violet-50 text-violet-800"
            : "border-zinc-200 bg-white text-zinc-500",
        )}
      >
        <option value="none">Just this once</option>
        <option value="this_merchant">
          All {txn.merchant} → {accountName}
        </option>
        <option value="merchant_amount_band">
          {txn.merchant} {formatCurrency(bandLow)}–{formatCurrency(bandHigh)} (±20%)
        </option>
      </select>
    </div>
  );
}

// ---- Reasoning help icon (purple ?, browser tooltip on hover) ----

function ReasoningHelpIcon({ reasoning }: { reasoning: string }) {
  if (!reasoning) return null;
  return (
    <Tooltip
      content={
        <span>
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-violet-300">
            Agent reasoning
          </span>
          <span className="mt-0.5 block">{reasoning}</span>
        </span>
      }
    >
      <button
        type="button"
        aria-label="Agent reasoning"
        onClick={(e) => e.stopPropagation()}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-violet-600 transition-colors hover:bg-violet-50 hover:text-violet-700"
      >
        <HelpIcon />
      </button>
    </Tooltip>
  );
}

// ---- Flag note row (replaces the rule-checkbox row when flagging) ----

function FlagNoteRow({
  note,
  onChange,
  onSend,
  onCancel,
}: {
  note: string;
  onChange: (next: string) => void;
  onSend: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-2 border-t border-amber-200 bg-amber-50 px-5 py-2">
      <span
        aria-hidden
        className="shrink-0 text-amber-700"
        title="Flagging for CPA review"
      >
        <FlagIcon />
      </span>
      <input
        type="text"
        value={note}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSend();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        autoFocus
        placeholder="Note for the CPA — what should they look at?"
        className="min-w-0 flex-1 rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
      />
      <button
        onClick={onSend}
        className="shrink-0 rounded-md bg-violet-700 px-3 py-1 text-xs font-medium text-white shadow-sm hover:bg-violet-800"
      >
        Send to CPA
      </button>
      <button
        onClick={onCancel}
        className="shrink-0 rounded-md px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100"
      >
        Cancel
      </button>
    </div>
  );
}

// ---- Custom combobox so 👎 can programmatically open the picker ----

const CONFIDENCE_BADGE: Record<ConfidenceLevel, string> = {
  high: "bg-emerald-100 text-emerald-800",
  medium: "bg-amber-100 text-amber-900",
  low: "bg-rose-100 text-rose-900",
};

const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  high: "Agent is highly confident",
  medium: "Agent is moderately confident",
  low: "Agent has low confidence",
};

// Standalone confidence pill, used to the right of the category
// dropdown (grouped with the agent-metadata: reasoning help icon).
function ConfidenceBadge({
  level,
  score,
}: {
  level: ConfidenceLevel;
  score: number;
}) {
  return (
    <Tooltip content={CONFIDENCE_LABEL[level]}>
      <span
        className={cn(
          "inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
          CONFIDENCE_BADGE[level],
        )}
        aria-label={`${level} confidence (${Math.round(score * 100)}%)`}
      >
        {Math.round(score * 100)}%
      </span>
    </Tooltip>
  );
}

function CategoryCombobox({
  value,
  modified,
  onChange,
  openSignal,
  onOpenChange,
}: {
  value: AccountId;
  modified: boolean;
  onChange: (id: AccountId) => void;
  openSignal: number;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);

  // Notify parent (ActionableRow) so 👎 can show a "selected" state
  // while the user is picking a replacement.
  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    if (openSignal > 0) setOpen(true);
  }, [openSignal]);

  useEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const POPOVER_WIDTH = 288;
    setPosition({
      top: rect.bottom + window.scrollY + 4,
      left: rect.right + window.scrollX - POPOVER_WIDTH,
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (popoverRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selectedName = accountById(value)?.name ?? value;
  const portalReady =
    typeof document !== "undefined" && open && position !== null;

  return (
    <>
      <button
        ref={triggerRef}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={cn(
          "flex w-56 items-center gap-2 rounded-md border bg-white px-2.5 py-1.5 text-left text-sm shadow-sm transition-colors",
          modified
            ? "border-amber-400 bg-amber-50 ring-1 ring-amber-200"
            : open
              ? "border-violet-500 ring-2 ring-violet-200"
              : "border-zinc-300 hover:border-zinc-400",
        )}
      >
        <span className="min-w-0 flex-1 truncate text-zinc-900">
          {selectedName}
        </span>
        <span aria-hidden className="text-xs text-zinc-400">
          ▾
        </span>
      </button>

      {portalReady
        ? createPortal(
            <ul
              ref={popoverRef}
              role="listbox"
              style={{
                position: "absolute",
                top: position!.top,
                left: position!.left,
              }}
              className="z-50 max-h-72 w-72 overflow-y-auto rounded-md border border-zinc-200 bg-white py-1 shadow-lg"
            >
              {chartOfAccounts.map((a) => {
                const selected = a.id === value;
                return (
                  <li key={a.id}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onChange(a.id);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors",
                        selected
                          ? "bg-violet-50 text-violet-900"
                          : "text-zinc-800 hover:bg-zinc-50",
                      )}
                    >
                      <span className="flex-1">
                        <span className="block font-medium">{a.name}</span>
                        <span className="mt-0.5 block text-xs text-zinc-500">
                          {humanizeCategory(a.category)}
                        </span>
                      </span>
                      {selected ? (
                        <span aria-hidden className="text-violet-700">
                          ✓
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>,
            document.body,
          )
        : null}
    </>
  );
}

function humanizeCategory(category: string): string {
  return category.replace(/_/g, " ");
}

// ---- Action icon button ----

const ICON_BUTTON_ACCENT: Record<
  "positive" | "negative" | "warn",
  { idle: string; hover: string; selected: string }
> = {
  positive: {
    idle: "text-emerald-600",
    hover: "hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700",
    selected: "border-emerald-400 bg-emerald-50 text-emerald-700",
  },
  negative: {
    idle: "text-rose-600",
    hover: "hover:border-rose-400 hover:bg-rose-50 hover:text-rose-700",
    selected: "border-rose-400 bg-rose-50 text-rose-700",
  },
  warn: {
    idle: "text-amber-600",
    hover: "hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700",
    selected: "border-amber-400 bg-amber-50 text-amber-700",
  },
};

function IconButton({
  onClick,
  ariaLabel,
  children,
  accent,
  selected,
}: {
  onClick: () => void;
  ariaLabel?: string;
  children: React.ReactNode;
  accent: "positive" | "negative" | "warn";
  selected?: boolean;
}) {
  const styles = ICON_BUTTON_ACCENT[accent];
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={ariaLabel}
      aria-pressed={selected}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-md border bg-white shadow-sm transition-colors",
        selected
          ? styles.selected
          : cn("border-zinc-300", styles.idle, styles.hover),
      )}
    >
      {children}
    </button>
  );
}

// ---- Pending chip ----

function PendingChip() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-zinc-50 px-2 py-1 text-xs text-zinc-500 ring-1 ring-inset ring-zinc-200">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-400" />
      Agent thinking…
    </span>
  );
}

// ---- Inline icons ----

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function HelpIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
function ThumbsUpIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
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
      className="h-4 w-4"
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
      className="h-4 w-4"
    >
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}
