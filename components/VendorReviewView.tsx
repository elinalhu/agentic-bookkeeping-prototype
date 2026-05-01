"use client";

import { accountById } from "@/lib/fixtures";
import { useActiveCompany, useAuditLog, useDecisions, useRules } from "@/lib/store";
import type { Rule } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";

// The agentic Vendor Review view — manages every rule the system has
// learned for the active company. Lives inside the Tasks page's
// Vendor Review tab; consolidates with Pilot's existing Vendor Review
// concept (manual vendor → category mapping) and extends it with
// scoped rules + audit trail.

export function VendorReviewView() {
  const { company, hydrated } = useActiveCompany();
  const { rules, suspendRule } = useRules(company.id);
  const { decisions } = useDecisions(company.id);
  const { append } = useAuditLog(company.id);

  // Count rule_applied decisions per merchant so the count is always
  // accurate, even for rules created before the bumpRuleCount fix.
  const ruleAppliedCounts: Record<string, number> = {};
  for (const d of Object.values(decisions)) {
    if (d.status === "rule_applied") {
      const merchant = company.inbox.find((t) => t.id === d.txnId)?.merchant ?? "";
      if (merchant) ruleAppliedCounts[merchant.toLowerCase()] = (ruleAppliedCounts[merchant.toLowerCase()] ?? 0) + 1;
    }
  }

  if (!hydrated) {
    return <div className="h-64 animate-pulse rounded-lg bg-zinc-100" />;
  }

  const active = rules.filter((r) => !r.suspended);
  const suspended = rules.filter((r) => r.suspended);

  const handleSuspend = (rule: Rule) => {
    const reason = prompt(
      "Why are you suspending this rule? (visible on audit trail)",
      "",
    );
    if (reason === null) return;
    suspendRule(rule.id, reason || "Suspended by user");
    append({
      id: `evt.rule.${rule.id}.${new Date().toISOString()}.suspend`,
      txnId: rule.id,
      timestamp: new Date().toISOString(),
      type: "rule_created",
      actor: "owner",
      summary: `Rule suspended: ${describeRule(rule)}${reason ? ` (${reason})` : ""}`,
      detail: { ruleId: rule.id, action: "suspend", reason },
    });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-violet-200 bg-violet-50 p-4 text-sm text-violet-900">
        <span className="font-medium">Proposed enhancement.</span>{" "}
        Pilot&apos;s existing Vendor Review maps a vendor to a single category.
        The agentic version extends that into <em>scoped rules</em>: a vendor
        can map differently based on transaction amount, every rule records
        who created it and how often it has fired, and rules can be
        suspended without losing the audit trail.
      </div>

      <HowItLearns />

      {rules.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <Section
            title="Active"
            count={active.length}
            description="Will auto-categorize matching future transactions."
          >
            {active.length === 0 ? (
              <EmptyRow text="No active rules." />
            ) : (
              active.map((r) => (
                <RuleRow key={r.id} rule={r} onSuspend={handleSuspend} appliedCount={ruleAppliedCounts[r.merchant.toLowerCase()]} />
              ))
            )}
          </Section>

          {suspended.length > 0 ? (
            <Section
              title="Suspended"
              count={suspended.length}
              description="No longer firing. Kept around so the audit trail still resolves."
            >
              {suspended.map((r) => (
                <RuleRow key={r.id} rule={r} onSuspend={handleSuspend} appliedCount={ruleAppliedCounts[r.merchant.toLowerCase()]} />
              ))}
            </Section>
          ) : null}
        </>
      )}
    </div>
  );
}

function HowItLearns() {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        How rules get created
      </div>
      <ul className="mt-2 space-y-1.5 text-sm text-zinc-700">
        <li className="flex gap-2">
          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-400" />
          <span className="flex-1">
            When you <span className="font-medium">confirm</span> or{" "}
            <span className="font-medium">override</span> a transaction in
            Transaction Requests, you can choose a rule scope: just this
            transaction, all future from this merchant, or this merchant
            within ±20% of the amount.
          </span>
        </li>
        <li className="flex gap-2">
          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-400" />
          <span className="flex-1">
            The rule picker defaults to the{" "}
            <span className="font-medium">narrowest</span> useful scope.
            Broader scopes require an explicit click — this is the
            overfitting mitigation.
          </span>
        </li>
        <li className="flex gap-2">
          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-400" />
          <span className="flex-1">
            Suspended rules stop firing but stay on the audit trail so past
            decisions still resolve to a known cause.
          </span>
        </li>
      </ul>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
      <h2 className="text-sm font-semibold text-zinc-900">No rules yet</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Resolve a transaction in <span className="font-medium">Transaction Requests</span>{" "}
        with a rule scope and it will appear here in <span className="font-medium">Rules</span>.
      </p>
    </div>
  );
}

function Section({
  title,
  count,
  description,
  children,
}: {
  title: string;
  count: number;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {title}
        </h2>
        <span className="font-mono text-xs text-zinc-400">{count}</span>
        <span className="ml-2 text-xs text-zinc-500">{description}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
      {text}
    </div>
  );
}

function RuleRow({
  rule,
  onSuspend,
  appliedCount,
}: {
  rule: Rule;
  onSuspend: (rule: Rule) => void;
  appliedCount?: number;
}) {
  const account = accountById(rule.accountId);
  return (
    <div
      className={cn(
        "rounded-md border p-4 shadow-sm",
        rule.suspended
          ? "border-rose-200 bg-rose-50"
          : "border-zinc-200 bg-white",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <div className="text-sm font-semibold text-zinc-900">
              {rule.merchant}
            </div>
            <span className="text-xs text-zinc-500">→</span>
            <div className="text-sm text-zinc-700">
              {account?.name ?? rule.accountId}
            </div>
            {rule.suspended ? (
              <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-900">
                Suspended
              </span>
            ) : null}
          </div>

          <div className="mt-1 font-mono text-xs text-zinc-500">
            {rule.scope === "merchant_amount_band"
              ? `Fires when amount is between ${formatCurrency(rule.amountMin ?? 0)}–${formatCurrency(rule.amountMax ?? 0)}`
              : "Fires for any amount"}
          </div>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600">
            <span>
              <span className="font-medium text-zinc-700">Created:</span>{" "}
              {formatRelative(rule.createdAt)}{" "}
              <span className="text-zinc-400">
                by {rule.createdBy === "owner" ? "owner" : "agent (accepted)"}
              </span>
            </span>
            <span>
              <span className="font-medium text-zinc-700">Last confirmed:</span>{" "}
              {formatRelative(rule.lastConfirmedAt)}
            </span>
            <span>
              <span className="font-medium text-zinc-700">Applied:</span>{" "}
              {appliedCount ?? rule.applicationsCount}×
            </span>
          </div>

          {rule.suspendedReason ? (
            <div className="mt-2 text-xs text-rose-800">
              <span className="font-medium">Suspended reason:</span>{" "}
              {rule.suspendedReason}
            </div>
          ) : null}
        </div>

        {!rule.suspended ? (
          <button
            onClick={() => onSuspend(rule)}
            className="shrink-0 rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-100"
          >
            Suspend
          </button>
        ) : null}
      </div>
    </div>
  );
}

function describeRule(rule: Rule): string {
  const account = accountById(rule.accountId);
  if (rule.scope === "this_merchant") {
    return `${rule.merchant} → ${account?.name ?? rule.accountId}`;
  }
  return `${rule.merchant} between $${rule.amountMin?.toFixed(0)}–$${rule.amountMax?.toFixed(0)} → ${account?.name ?? rule.accountId}`;
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
