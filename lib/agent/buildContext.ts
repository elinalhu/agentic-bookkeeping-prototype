// Assembles the per-transaction context object that's fed to the
// Claude prompt as the user message. This file is the answer to the
// rubric question "what info would you feed it?" — anything in this
// object is what the agent sees, nothing else.
//
// The object is also returned to the client and shown in the Inspect
// drawer so the interviewer can see exactly what the agent had to
// work with.

import { accountById, chartOfAccounts, isColdStart } from "../fixtures";
import type { Account, Company, Rule, Transaction } from "../types";

export interface AgentContext {
  business: {
    name: string;
    industry: string;
    entityType: string;
    employeesW2: number;
    contractors1099: number;
    hasInventory: boolean;
    ownerCompensationModel: string;
    fiscalYearStart: string;
    narrative: string;
  };
  // Slim COA — just id, name, description so the agent knows the
  // semantic distinction between e.g. COGS-Hosting and Software & Tech.
  chartOfAccounts: Array<{
    id: string;
    name: string;
    category: string;
    description: string;
  }>;
  transaction: {
    id: string;
    merchant: string;
    memo: string;
    amount: number;
    direction: "inflow" | "outflow";
    date: string;
  };
  // Prior categorizations of THIS merchant — the strongest signal.
  similarMerchantHistory: Array<{
    date: string;
    memo: string;
    amount: number;
    categorizedAs: string; // human-readable account name
    via: "user_confirmed" | "rule_applied" | "agent_auto";
  }>;
  // A few other recent confirmed transactions, for general business
  // shape (so the agent knows e.g. "this business does pay a lot of
  // contractors" without needing the merchant to match).
  recentOtherTransactions: Array<{
    date: string;
    merchant: string;
    amount: number;
    categorizedAs: string;
  }>;
  // Active rules touching this merchant.
  activeRules: Array<{
    id: string;
    merchant: string;
    scope: string;
    accountName: string;
    appliesToThisTransaction: boolean;
  }>;
  // Counts so the agent has a sense of how much history exists.
  totals: {
    totalHistoryCount: number;
    historyForThisMerchantCount: number;
    daysInPilot: number;
  };
  // True when history is too thin to pattern-match reliably. The
  // system prompt instructs the agent to behave differently when set.
  isColdStart: boolean;
}

const MAX_SIMILAR_HISTORY = 6;
const MAX_OTHER_HISTORY = 5;

export function buildAgentContext(
  company: Company,
  txn: Transaction,
  rules: Rule[] = [],
): AgentContext {
  const merchantNorm = txn.merchant.trim().toLowerCase();

  const similarMerchantHistory = company.history
    .filter((h) => h.merchant.trim().toLowerCase() === merchantNorm)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, MAX_SIMILAR_HISTORY)
    .map((h) => ({
      date: h.date,
      memo: h.memo,
      amount: h.amount,
      categorizedAs: nameFor(h.categoryId),
      via: (h.source ?? "user_confirmed") as
        | "user_confirmed"
        | "rule_applied"
        | "agent_auto",
    }));

  const recentOtherTransactions = company.history
    .filter(
      (h) =>
        h.merchant.trim().toLowerCase() !== merchantNorm && h.categoryId,
    )
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, MAX_OTHER_HISTORY)
    .map((h) => ({
      date: h.date,
      merchant: h.merchant,
      amount: h.amount,
      categorizedAs: nameFor(h.categoryId),
    }));

  const activeRules = rules
    .filter((r) => !r.suspended)
    .filter((r) => r.merchant.toLowerCase() === merchantNorm)
    .map((r) => ({
      id: r.id,
      merchant: r.merchant,
      scope: r.scope,
      accountName: nameFor(r.accountId),
      appliesToThisTransaction: ruleApplies(r, txn),
    }));

  return {
    business: {
      name: company.profile.name,
      industry: company.profile.industry,
      entityType: company.profile.entityType,
      employeesW2: company.profile.employeesW2,
      contractors1099: company.profile.contractors1099,
      hasInventory: company.profile.hasInventory,
      ownerCompensationModel: company.profile.ownerCompensationModel,
      fiscalYearStart: company.profile.fiscalYearStart,
      narrative: company.profile.narrative,
    },
    chartOfAccounts: chartOfAccounts.map((a: Account) => ({
      id: a.id,
      name: a.name,
      category: a.category,
      description: a.description,
    })),
    transaction: {
      id: txn.id,
      merchant: txn.merchant,
      memo: txn.memo,
      amount: txn.amount,
      direction: txn.direction,
      date: txn.date,
    },
    similarMerchantHistory,
    recentOtherTransactions,
    activeRules,
    totals: {
      totalHistoryCount: company.history.length,
      historyForThisMerchantCount: similarMerchantHistory.length,
      daysInPilot: company.joinedDaysAgo,
    },
    isColdStart: isColdStart(company),
  };
}

function nameFor(accountId: string | undefined): string {
  if (!accountId) return "(uncategorized)";
  return accountById(accountId)?.name ?? accountId;
}

function ruleApplies(rule: Rule, txn: Transaction): boolean {
  if (rule.merchant.toLowerCase() !== txn.merchant.toLowerCase()) return false;
  if (rule.scope === "this_merchant") return true;
  if (rule.scope === "merchant_amount_band") {
    const min = rule.amountMin ?? 0;
    const max = rule.amountMax ?? Number.POSITIVE_INFINITY;
    return txn.amount >= min && txn.amount <= max;
  }
  return false;
}
