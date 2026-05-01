// Domain types for the bookkeeping prototype.
// Kept narrow on purpose — every field exists either to be shown to the
// owner, shown to the CPA, or fed to the agent.

export type AccountId = string;

export type AccountCategory =
  | "asset"
  | "liability"
  | "equity"
  | "revenue"
  | "contra_revenue"
  | "expense"
  | "cogs";

export interface Account {
  id: AccountId;
  name: string;
  category: AccountCategory;
  // Short description used both in UI tooltips and inside the agent prompt.
  description: string;
}

export interface BusinessProfile {
  name: string;
  industry: string;
  entityType: "sole_prop" | "llc_disregarded" | "llc_s_corp" | "c_corp";
  employeesW2: number;
  contractors1099: number;
  hasInventory: boolean;
  ownerCompensationModel:
    | "none_yet" // pre-payroll, founders not taking comp
    | "salary_w2"
    | "draws_only"
    | "mixed_w2_and_draws";
  fiscalYearStart: string; // MM-DD
  // One-paragraph description fed to the agent so it has business context.
  narrative: string;
}

export type ConfidenceLevel = "high" | "medium" | "low";

export type TransactionStatus =
  | "needs_review"
  | "auto_categorized"
  | "rule_applied"
  | "resolved_by_user"
  | "flagged_for_cpa";

export interface Transaction {
  id: string;
  date: string; // ISO YYYY-MM-DD
  merchant: string;
  memo: string; // Raw bank memo
  amount: number; // Positive number — direction tells you the sign
  direction: "inflow" | "outflow";
  status: TransactionStatus;
  // Final assigned account once the txn is no longer "needs_review".
  categoryId?: AccountId;
  // Cached agent hypothesis (only present once the agent has run on this txn).
  agentHypothesis?: AgentHypothesis;
  // For history items: how was this categorized originally.
  source?: "user_confirmed" | "rule_applied" | "agent_auto";
}

export interface ClarifyingOption {
  label: string;
  suggestedAccountId: AccountId;
  // If the user picks this option, what's the agent's recommended next move.
  nextAction: "confirm" | "split" | "ask_followup" | "flag";
}

export interface AgentHypothesis {
  accountId: AccountId;
  confidence: ConfidenceLevel;
  confidenceScore: number; // 0..1, used for inbox priority sort
  reasoning: string[]; // 3–5 evidence bullets
  alternatives: Array<{
    accountId: AccountId;
    why: string;
  }>;
  // Present only when the ambiguity is genuinely unresolvable from context.
  clarifyingQuestion?: {
    text: string;
    options: ClarifyingOption[];
  };
  // What the agent thinks the user might want to "save as a rule".
  proposedRule?: {
    scope: "this_transaction" | "this_merchant" | "merchant_amount_band";
    criteria: string;
    accountId: AccountId;
  };
}

export type AuditActor = "agent" | "owner" | "cpa" | "system";

export type AuditEventType =
  | "agent_proposed"
  | "user_confirmed"
  | "user_overrode"
  | "user_skipped"
  | "user_reopened"
  | "rule_created"
  | "rule_applied"
  | "cpa_flagged"
  | "cpa_unflagged"
  | "cpa_approved";

export interface AuditEvent {
  id: string;
  txnId: string;
  timestamp: string; // ISO datetime
  type: AuditEventType;
  actor: AuditActor;
  summary: string;
  // Optional extra payload: rule id, account ids, before/after.
  detail?: Record<string, unknown>;
}

export interface Rule {
  id: string;
  createdAt: string;
  scope: "this_merchant" | "merchant_amount_band";
  merchant: string;
  amountMin?: number;
  amountMax?: number;
  accountId: AccountId;
  createdBy: "owner" | "agent_suggested_owner_accepted";
  lastConfirmedAt: string;
  applicationsCount: number;
  // If true, the rule is suspended (e.g. CPA rolled it back).
  suspended?: boolean;
  suspendedReason?: string;
}

// What the agent route returns. Mirrors AgentHypothesis but is the wire shape.
export interface AgentResponse {
  hypothesis: AgentHypothesis;
  // Echo of context the agent saw, for the Inspect drawer.
  inspect: {
    systemPrompt: string;
    contextSentToAgent: unknown;
    rawModelOutput: unknown;
    model: string;
    latencyMs: number;
    tokenUsage: {
      input: number;
      output: number;
      cacheCreationInput: number;
      cacheReadInput: number;
    };
  };
}

// A "company" is the top-level tenant — one Pilot customer's books.
// We seed two of them: an established 18-month-in business and a
// 3-week-old pre-seed startup, so the demo can show the agent
// behaving differently in cold-start vs warm states.
export interface Company {
  id: string;
  profile: BusinessProfile;
  history: Transaction[];
  inbox: Transaction[];
  // Which inbox txn drives the streaming-chat deep-dive flow, if any.
  deepDiveTxnId: string | null;
  // How long the company has been in Pilot. Drives copy + cold-start behavior.
  joinedDaysAgo: number;
  // Previously-categorized transactions the agent has re-reviewed and
  // thinks should be re-categorized given new context (e.g. business
  // changes, new patterns in recent transactions). Surfaces on the
  // Tasks page as "Suggested corrections" — the literal "agent
  // proposes corrections" capability from the take-home prompt.
  suggestedCorrections?: SuggestedCorrection[];
}

export interface SuggestedCorrection {
  /** ID of the historical transaction this correction targets. */
  txnId: string;
  /** Account the agent now thinks this transaction should be in. */
  proposedAccountId: AccountId;
  /** Confidence in the proposed correction. */
  confidence: ConfidenceLevel;
  /** Why the agent now thinks the original categorization is wrong. */
  reasoning: string;
}
