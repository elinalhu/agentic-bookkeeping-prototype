"use client";

import { useState } from "react";
import { accountById } from "@/lib/fixtures";
import type { AccountId, Rule, Transaction } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";

type Scope = "none" | "this_merchant" | "merchant_amount_band";

const AMOUNT_BAND_PCT = 0.2;

interface Props {
  txn: Transaction;
  accountId: AccountId;
  // Default scope suggested by the agent (mapped to our local Scope union).
  suggestedScope?: Scope;
  onSave: (rule: Rule | null) => void;
  onCancel: () => void;
}

export function RulePicker({
  txn,
  accountId,
  suggestedScope,
  onSave,
  onCancel,
}: Props) {
  // Default to the narrowest useful scope. Broader scopes require an
  // explicit click — this is the overfitting mitigation.
  const [scope, setScope] = useState<Scope>(suggestedScope ?? "none");
  const account = accountById(accountId);

  const bandLow = txn.amount * (1 - AMOUNT_BAND_PCT);
  const bandHigh = txn.amount * (1 + AMOUNT_BAND_PCT);

  const handleSave = () => {
    if (scope === "none") {
      onSave(null);
      return;
    }
    const now = new Date().toISOString();
    const rule: Rule = {
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
    onSave(rule);
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-zinc-900">
        Save this as a rule?
      </h3>
      <p className="mt-1 text-sm text-zinc-600">
        Rules let the agent auto-categorize matching future transactions
        without asking. Pick the narrowest scope that&apos;s actually useful —
        broader scopes risk over-applying based on a single decision.
      </p>

      <div className="mt-4 space-y-2">
        <ScopeOption
          selected={scope === "none"}
          onSelect={() => setScope("none")}
          title="Just this transaction"
          subtitle="No rule. Future transactions still get reviewed."
        />
        <ScopeOption
          selected={scope === "this_merchant"}
          onSelect={() => setScope("this_merchant")}
          title={`All ${txn.merchant} transactions → ${account?.name ?? accountId}`}
          subtitle="Auto-applies to every future transaction with this merchant, any amount."
        />
        <ScopeOption
          selected={scope === "merchant_amount_band"}
          onSelect={() => setScope("merchant_amount_band")}
          title={`${txn.merchant} between ${formatCurrency(bandLow)}–${formatCurrency(bandHigh)} → ${account?.name ?? accountId}`}
          subtitle={`Narrower: only fires when the amount is within ±20% of $${txn.amount}.`}
        />
      </div>

      <div className="mt-5 flex items-center gap-2">
        <button
          onClick={handleSave}
          className="rounded-md bg-violet-700 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-violet-800"
        >
          {scope === "none" ? "Done" : "Save rule"}
        </button>
        <button
          onClick={onCancel}
          className="rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function ScopeOption({
  selected,
  onSelect,
  title,
  subtitle,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-3 rounded-md border px-3 py-2.5 text-left transition-colors",
        selected
          ? "border-zinc-900 bg-zinc-50"
          : "border-zinc-200 hover:bg-zinc-50",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
          selected ? "border-zinc-900 bg-zinc-900" : "border-zinc-300",
        )}
      >
        {selected ? (
          <span className="h-1.5 w-1.5 rounded-full bg-white" />
        ) : null}
      </span>
      <span className="flex-1">
        <span className="block text-sm font-medium text-zinc-900">
          {title}
        </span>
        <span className="mt-0.5 block text-xs text-zinc-500">{subtitle}</span>
      </span>
    </button>
  );
}
