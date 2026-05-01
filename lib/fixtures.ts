// Seed data for the prototype. Two companies, deliberately picked to
// match Pilot's ICP (VC-backed SaaS) and to showcase the agent's
// behavior in two very different states:
//
//   1. PINECREST TELEMETRY  — Series A observability/APM SaaS, 18
//      months in Pilot, ~12 prior categorizations, a few active rules.
//      This is the "warm" state where the agent has real signal to
//      pattern-match against.
//
//   2. CRESTLINE SOFTWARE   — pre-seed C-corp, 21 days in Pilot, just
//      2 prior categorizations total, no rules, no production launched.
//      This is the "cold-start" state where the agent has to lean on
//      business profile signal and ask more focused questions.
//
// Both companies share the same chart of accounts (Pilot's COA is a
// template that adapts per business). The agent picks the right
// accounts for the context.
//
// Why these specific 5/4 ambiguous transactions:
//   - Pinecrest's AWS bill → COGS (production hosting) vs Software &
//     Tech (dev/staging). Hits gross margin → real fintech stakes.
//     Used as the streaming-chat deep-dive.
//   - Pinecrest's ADP run → Payroll vs Contract Labor through ADP.
//   - Pinecrest's $15k owner transfer → Reimbursement vs Officer Loan
//     vs off-cycle bonus. Three plausible answers, different tax.
//   - Pinecrest's Stripe payout → Revenue with possible refund offset.
//   - Pinecrest's Costco $600 → unambiguously Office Supplies given
//     no inventory exists; agent should NOT ask. Demonstrates that
//     business context resolves the appendix's "ambiguity".
//   - Crestline's same-shape transactions but the agent has nothing
//     to pattern-match against — confidence drops, questions multiply.

import type {
  Account,
  BusinessProfile,
  Company,
  Transaction,
} from "./types";

// ---------- Shared chart of accounts ----------

export const chartOfAccounts: Account[] = [
  {
    id: "acc.revenue",
    name: "Revenue",
    category: "revenue",
    description:
      "Recognized SaaS subscription revenue (monthly and annual plans).",
  },
  {
    id: "acc.refunds",
    name: "Refunds & Credits",
    category: "contra_revenue",
    description:
      "Customer refunds, credits, and pro-rated cancellations; reduces " +
      "gross revenue.",
  },
  {
    id: "acc.ar",
    name: "Accounts Receivable",
    category: "asset",
    description:
      "Outstanding invoices to enterprise customers awaiting payment via " +
      "ACH/wire.",
  },
  {
    id: "acc.cogs_hosting",
    name: "Cost of Goods Sold — Hosting",
    category: "cogs",
    description:
      "Direct cost of delivering the product to customers: production " +
      "hosting (compute, storage, egress, managed services), Stripe " +
      "processing fees, and any third-party data services baked into the " +
      "product. Drives reported gross margin.",
  },
  {
    id: "acc.software",
    name: "Software & Technology",
    category: "expense",
    description:
      "Internal-use software and dev infrastructure NOT directly serving " +
      "customers: dev/staging/CI environments, GitHub, Linear, Slack, " +
      "Notion, accounting software.",
  },
  {
    id: "acc.payroll",
    name: "Payroll Expense (W-2)",
    category: "expense",
    description:
      "Wages and employer payroll taxes for W-2 employees, run through " +
      "ADP.",
  },
  {
    id: "acc.contract_labor",
    name: "Contract Labor (1099)",
    category: "expense",
    description:
      "Payments to 1099 contractors. Reportable on 1099-NEC at year " +
      "end. Sometimes routed through ADP's contractor-pay product " +
      "rather than direct ACH.",
  },
  {
    id: "acc.office",
    name: "Office Supplies",
    category: "expense",
    description:
      "Consumables for the office: snacks, paper, coffee, cleaning " +
      "supplies, small tools. SaaS businesses don't resell physical " +
      "goods, so Costco / Amazon office runs always land here.",
  },
  {
    id: "acc.owner_comp",
    name: "Officer Compensation",
    category: "expense",
    description:
      "W-2 salary paid to the founder/officer via ADP. Off-cycle bonuses " +
      "are rare and would also book here.",
  },
  {
    id: "acc.officer_loan",
    name: "Loan to Officer",
    category: "asset",
    description:
      "Short-term loan from the company to an officer (typically the " +
      "founder). Subject to IRS rules — must accrue at least the " +
      "applicable federal rate (AFR) and have a written note. Recorded " +
      "on the balance sheet as a receivable, not an expense.",
  },
  {
    id: "acc.reimbursement",
    name: "Founder Reimbursements",
    category: "expense",
    description:
      "Reimbursements to the founder for company expenses paid on a " +
      "personal card. Reduces the underlying expense category at " +
      "month-end via accountable plan; tracked here in raw form.",
  },
  {
    id: "acc.legal",
    name: "Legal & Professional Fees",
    category: "expense",
    description:
      "Outside legal, accounting, and incorporation fees (formation, " +
      "fundraising docs, ongoing counsel).",
  },
  {
    id: "acc.bank_fees",
    name: "Bank & Processor Fees",
    category: "expense",
    description: "Bank charges and standalone processor fees not in COGS.",
  },
];

export function accountById(id: string): Account | undefined {
  return chartOfAccounts.find((a) => a.id === id);
}

// ---------- Company 1: Pinecrest Telemetry (warm state) ----------

const PINECREST_PROFILE: BusinessProfile = {
  name: "Pinecrest Telemetry, Inc.",
  industry: "B2B SaaS — observability & APM tooling for backend services",
  entityType: "c_corp",
  employeesW2: 8,
  contractors1099: 3,
  hasInventory: false,
  ownerCompensationModel: "salary_w2",
  fiscalYearStart: "01-01",
  narrative:
    "Pinecrest Telemetry is a Series A observability SaaS (APM / log " +
    "analytics) incorporated as a Delaware C-corp. ~$3M raised, 8 W-2 " +
    "employees including the single founder/CEO who takes a $180k annual " +
    "salary via ADP, and 3 active 1099 contractors. The product runs on " +
    "AWS (production multi-AZ in us-east-1, separate dev/staging " +
    "accounts). Customers pay monthly subscriptions through Stripe. No " +
    "physical product or inventory. Office is a small leased space in " +
    "SF; supplies bought at Costco are snacks, paper, and cleaning. " +
    "Founder occasionally pays for company expenses on a personal card " +
    "and is reimbursed.",
};

const PINECREST_HISTORY: Transaction[] = [
  // ADP — recurring monthly W-2 payroll for ~8 employees + founder.
  {
    id: "h.adp.1",
    date: "2026-02-28",
    merchant: "ADP",
    memo: "ADP TX*PAY 020983",
    amount: 41200,
    direction: "outflow",
    status: "resolved_by_user",
    categoryId: "acc.payroll",
    source: "user_confirmed",
  },
  {
    id: "h.adp.2",
    date: "2026-03-31",
    merchant: "ADP",
    memo: "ADP TX*PAY 031211",
    amount: 41450,
    direction: "outflow",
    status: "rule_applied",
    categoryId: "acc.payroll",
    source: "rule_applied",
  },
  // The seed of ADP ambiguity: one contractor was paid through ADP.
  {
    id: "h.adp.3",
    date: "2026-03-15",
    merchant: "ADP",
    memo: "ADP TX*1099 031544",
    amount: 4200,
    direction: "outflow",
    status: "resolved_by_user",
    categoryId: "acc.contract_labor",
    source: "user_confirmed",
  },
  // ADP processing fee — small monthly subscription separate from
  // payroll funding. Realistic SaaS-style line item.
  {
    id: "h.adp.fee.1",
    date: "2026-03-03",
    merchant: "ADP",
    memo: "ADP FEE 030387",
    amount: 89,
    direction: "outflow",
    status: "resolved_by_user",
    categoryId: "acc.software",
    source: "user_confirmed",
  },

  // AWS — historically Software & Tech (dev/staging only). Production
  // launched in Feb 2026; bills have been climbing but no one has
  // re-categorized yet. Sets up the AWS deep-dive.
  {
    id: "h.aws.1",
    date: "2025-12-15",
    merchant: "AWS",
    memo: "AMAZON WEB SERVICES 5532",
    amount: 220,
    direction: "outflow",
    status: "resolved_by_user",
    categoryId: "acc.software",
    source: "user_confirmed",
  },
  {
    id: "h.aws.2",
    date: "2026-01-15",
    merchant: "AWS",
    memo: "AMAZON WEB SERVICES 5532",
    amount: 280,
    direction: "outflow",
    status: "resolved_by_user",
    categoryId: "acc.software",
    source: "user_confirmed",
  },
  {
    id: "h.aws.3",
    date: "2026-02-15",
    merchant: "AWS",
    memo: "AMAZON WEB SERVICES 5532",
    amount: 540,
    direction: "outflow",
    status: "rule_applied",
    categoryId: "acc.software",
    source: "rule_applied",
  },
  {
    id: "h.aws.4",
    date: "2026-03-15",
    merchant: "AWS",
    memo: "AMAZON WEB SERVICES 5532",
    amount: 770,
    direction: "outflow",
    status: "rule_applied",
    categoryId: "acc.software",
    source: "rule_applied",
  },

  // Stripe — subscription revenue.
  {
    id: "h.stripe.1",
    date: "2026-03-10",
    merchant: "Stripe",
    memo: "STRIPE PAYOUT",
    amount: 28400,
    direction: "inflow",
    status: "resolved_by_user",
    categoryId: "acc.revenue",
    source: "user_confirmed",
  },
  {
    id: "h.stripe.2",
    date: "2026-03-24",
    merchant: "Stripe",
    memo: "STRIPE PAYOUT",
    amount: 31200,
    direction: "inflow",
    status: "rule_applied",
    categoryId: "acc.revenue",
    source: "rule_applied",
  },
  {
    id: "h.stripe.refund.1",
    date: "2026-04-08",
    merchant: "Stripe",
    memo: "STRIPE REFUND BATCH",
    amount: 1450,
    direction: "outflow",
    status: "resolved_by_user",
    categoryId: "acc.refunds",
    source: "user_confirmed",
  },

  // Costco — always office supplies (no inventory).
  {
    id: "h.costco.1",
    date: "2026-02-22",
    merchant: "Costco",
    memo: "COSTCO WHSE #0489",
    amount: 410,
    direction: "outflow",
    status: "resolved_by_user",
    categoryId: "acc.office",
    source: "user_confirmed",
  },
  {
    id: "h.costco.2",
    date: "2026-03-18",
    merchant: "Costco",
    memo: "COSTCO WHSE #0489",
    amount: 520,
    direction: "outflow",
    status: "rule_applied",
    categoryId: "acc.office",
    source: "rule_applied",
  },

  // Founder reimbursements — pattern: small amounts (< $1k).
  {
    id: "h.owner.1",
    date: "2026-02-08",
    merchant: "J. Carter",
    memo: "ACH OUT MERCURY · J CARTER",
    amount: 480,
    direction: "outflow",
    status: "resolved_by_user",
    categoryId: "acc.reimbursement",
    source: "user_confirmed",
  },
  {
    id: "h.owner.2",
    date: "2026-03-22",
    merchant: "J. Carter",
    memo: "ACH OUT MERCURY · J CARTER",
    amount: 920,
    direction: "outflow",
    status: "resolved_by_user",
    categoryId: "acc.reimbursement",
    source: "user_confirmed",
  },
];

const PINECREST_INBOX: Transaction[] = [
  {
    id: "t.aws.now",
    date: "2026-04-15",
    merchant: "AWS",
    memo: "AMAZON WEB SERVICES 5532",
    amount: 890,
    direction: "outflow",
    status: "needs_review",
  },
  // ADP-routed contractor payment — the *1099 suffix in the memo is
  // ADP's actual signal for contractor runs (vs *PAY for W-2). Lets
  // the agent confidently distinguish from the larger W-2 run below
  // and reason about the right account (Contract Labor, not Payroll).
  {
    id: "t.adp.now",
    date: "2026-04-28",
    merchant: "ADP",
    memo: "ADP TX*1099 042819",
    amount: 4200,
    direction: "outflow",
    status: "needs_review",
  },
  // Clear W-2 payroll run — memo + amount both unambiguous.
  {
    id: "t.adp.payroll.now",
    date: "2026-04-15",
    merchant: "ADP",
    memo: "ADP TX*PAY 041511",
    amount: 41800,
    direction: "outflow",
    status: "needs_review",
  },
  // ADP processing fee — small monthly subscription. Recurring, so
  // a perfect candidate for an amount-band rule (would over-fit if
  // saved as merchant-only).
  {
    id: "t.adp.fee.now",
    date: "2026-04-03",
    merchant: "ADP",
    memo: "ADP FEE 040301",
    amount: 89,
    direction: "outflow",
    status: "needs_review",
  },
  // Direct contractor ACH (mirrors Pilot's actual demo pattern of a
  // named contractor as the parsed vendor). Genuinely ambiguous: no
  // prior history for this name, so the agent must reason from the
  // business profile (3 active 1099 contractors → Contract Labor is
  // plausible) and ask if uncertain.
  {
    id: "t.contractor.now",
    date: "2026-04-22",
    merchant: "Mira Patel",
    memo: "ACH OUT MERCURY · M PATEL",
    amount: 3500,
    direction: "outflow",
    status: "needs_review",
  },
  {
    id: "t.owner.now",
    date: "2026-04-25",
    merchant: "J. Carter",
    memo: "ACH OUT MERCURY · J CARTER",
    amount: 15000,
    direction: "outflow",
    status: "needs_review",
  },
  {
    id: "t.stripe.now",
    date: "2026-04-26",
    merchant: "Stripe",
    memo: "STRIPE PAYOUT",
    amount: 3100,
    direction: "inflow",
    status: "needs_review",
  },
  // A second Stripe payout — gives the demo something for a freshly-
  // created "Stripe → Revenue" rule to fire on. Without a second
  // transaction matching the rule, auto-fire has nothing to apply to.
  {
    id: "t.stripe.next.now",
    date: "2026-04-29",
    merchant: "Stripe",
    memo: "STRIPE PAYOUT",
    amount: 2950,
    direction: "inflow",
    status: "needs_review",
  },
  {
    id: "t.costco.now",
    date: "2026-04-27",
    merchant: "Costco",
    memo: "COSTCO WHSE #0489",
    amount: 600,
    direction: "outflow",
    status: "needs_review",
  },
];

// ---------- Company 2: Crestline Software (cold-start) ----------

const CRESTLINE_PROFILE: BusinessProfile = {
  name: "Crestline Software, Inc.",
  industry: "B2B SaaS — early-stage developer productivity tooling",
  entityType: "c_corp",
  employeesW2: 0, // pre-payroll; founders not yet on W-2
  contractors1099: 1, // a freelance designer doing the marketing site
  hasInventory: false,
  ownerCompensationModel: "none_yet", // pre-payroll
  fiscalYearStart: "01-01",
  narrative:
    "Crestline Software is a 21-day-old Delaware C-corp pre-seed " +
    "startup, two technical cofounders (J. Wei and S. Ortiz). $750k " +
    "pre-seed closed two weeks ago, sitting in the operating account. " +
    "Product is in active dev — no production launched. One design " +
    "partner just started paying $250/mo for early access. No " +
    "employees yet; founders are not on payroll. One 1099 contractor: " +
    "a freelance designer.",
};

const CRESTLINE_HISTORY: Transaction[] = [
  // Just two prior categorizations in their three weeks on Pilot.
  {
    id: "cr.h.aws.1",
    date: "2026-04-15",
    merchant: "AWS",
    memo: "AMAZON WEB SERVICES 7711",
    amount: 80,
    direction: "outflow",
    status: "resolved_by_user",
    categoryId: "acc.software",
    source: "user_confirmed",
  },
  {
    id: "cr.h.costco.1",
    date: "2026-04-18",
    merchant: "Costco",
    memo: "COSTCO WHSE #0312",
    amount: 90,
    direction: "outflow",
    status: "resolved_by_user",
    categoryId: "acc.office",
    source: "user_confirmed",
  },
];

const CRESTLINE_INBOX: Transaction[] = [
  // AWS slightly larger this month — still no production, but agent
  // has only one prior data point to pattern-match against.
  {
    id: "cr.t.aws.now",
    date: "2026-04-26",
    merchant: "AWS",
    memo: "AMAZON WEB SERVICES 7711",
    amount: 135,
    direction: "outflow",
    status: "needs_review",
  },
  // First-ever Stripe inflow — design partner's first monthly payment.
  {
    id: "cr.t.stripe.now",
    date: "2026-04-24",
    merchant: "Stripe",
    memo: "STRIPE PAYOUT",
    amount: 250,
    direction: "inflow",
    status: "needs_review",
  },
  // Costco run for office snacks.
  {
    id: "cr.t.costco.now",
    date: "2026-04-27",
    merchant: "Costco",
    memo: "COSTCO WHSE #0312",
    amount: 180,
    direction: "outflow",
    status: "needs_review",
  },
  // Founder transfer — could be reimbursement (founder fronted legal
  // fees on personal card), an officer loan back to the founder, or
  // an early founder distribution. With zero history of owner
  // transfers, the agent must ask.
  {
    id: "cr.t.owner.now",
    date: "2026-04-25",
    merchant: "J. Wei",
    memo: "ACH OUT MERCURY · J WEI",
    amount: 4500,
    direction: "outflow",
    status: "needs_review",
  },
];

// ---------- Companies map ----------

export const companies: Record<string, Company> = {
  pinecrest: {
    id: "pinecrest",
    profile: PINECREST_PROFILE,
    history: PINECREST_HISTORY,
    inbox: PINECREST_INBOX,
    deepDiveTxnId: "t.aws.now",
    joinedDaysAgo: 540, // ~18 months
    // Seed example: an old AWS bill that was booked as Software & Tech
    // before production launched. With the trend visible now, the agent
    // re-reviews and proposes moving (or splitting) to COGS — Hosting.
    // In production this list would be agent-computed periodically.
    suggestedCorrections: [
      {
        txnId: "h.aws.4",
        proposedAccountId: "acc.cogs_hosting",
        confidence: "medium",
        reasoning:
          "This March AWS bill ($770) was booked as Software & Tech, but Pinecrest launched production in February — and bills have grown 3.5× since (Dec $220 → Mar $770). At least part of this charge is customer-facing infra and should sit in COGS — Hosting, where it'll affect reported gross margin. Suggested for re-review with the CPA at month-end.",
      },
    ],
  },
  crestline: {
    id: "crestline",
    profile: CRESTLINE_PROFILE,
    history: CRESTLINE_HISTORY,
    inbox: CRESTLINE_INBOX,
    deepDiveTxnId: null,
    joinedDaysAgo: 21,
    // Cold-start company — too little history for the agent to flag
    // anything for re-review yet.
    suggestedCorrections: [],
  },
};

export const DEFAULT_COMPANY_ID = "pinecrest";

export function getCompany(id: string | null | undefined): Company {
  if (id && companies[id]) return companies[id];
  return companies[DEFAULT_COMPANY_ID];
}

export function findTransaction(
  companyId: string,
  txnId: string,
): { transaction: Transaction; isHistory: boolean } | null {
  const company = getCompany(companyId);
  const inboxHit = company.inbox.find((t) => t.id === txnId);
  if (inboxHit) return { transaction: inboxHit, isHistory: false };
  const historyHit = company.history.find((t) => t.id === txnId);
  if (historyHit) return { transaction: historyHit, isHistory: true };
  return null;
}

// True when the company has minimal-to-no history for the agent to
// pattern-match against. Threshold is intentionally low (≤ 3) to
// capture "just signed up" without being binary.
export function isColdStart(company: Company): boolean {
  return company.history.length <= 3;
}
