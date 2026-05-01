# Design Decisions

A log of the product and design choices that shaped this prototype, written
for someone reading the repo cold. The brief asked for an agentic
bookkeeping assistant that helps small business owners resolve ambiguous
transaction categorizations. This document explains how I scoped that, what
I chose to build, what I cut, and where I'd take it next.

---

## Framing

### An enhancement to an existing surface, not a standalone app

The brief left it open whether to build a new product or extend an existing
one. I looked at Pilot's actual product and noticed they already ship a
"Tasks" feature — a queue of transaction requests and questions from the
bookkeeping team. I designed this as an agentic enhancement to that feature
rather than as a standalone tool.

Why:

- **Trust is easier to earn when you extend something customers already
  use.** "Here's the agent doing work you used to do manually" is a cleaner
  product story than "here's a new AI thing to learn."
- **Adoption surface already exists.** A new app needs a reason to open it.
  An enhanced Tasks queue is already part of the daily workflow — the agent
  just makes that queue shorter and smarter.
- **The dual-audience problem maps naturally.** Owners use Tasks today; the
  internal bookkeeping team triages it on the back end. Both audiences
  already share that surface, so the agent fits cleanly into both.

### Two audiences, one data model, different views

The brief named the dual-audience constraint: owners are not accountants,
but a CPA reviews the output at tax time. Two views, one underlying state:

- **Owner view (`/tasks`)** — plain-language, action-first. Pre-filled
  category, color-coded confidence badge, one help icon for the lead
  reasoning bullet, three action buttons (👍 / 👎 / 🚩), an inline rule
  selector. Designed so the common case is one click.
- **CPA view (`/cpa`)** — same data, audit lens. Period header, decision
  metrics, filters by source (agent / rule / owner), expandable audit
  trail per row, ability to roll back any decision. The Inspect surface
  (system prompt, full context object, raw model output) is exposed here,
  not to the owner — owners don't need engineering detail to do
  bookkeeping, but the bookkeeping team needs it for QA and debugging.

The owner sees plain language; the CPA can audit the full reasoning chain
that produced it.

---

## Key product choices

### Auto-categorize high confidence; surface only the ambiguous ones

The brief's central design constraint: *"the agent's job isn't to ask the
owner vague questions — it's to form a confident hypothesis and surface a
focused question only when the ambiguity is genuinely unresolvable."*

That ruled out a chatbot. It ruled out hedging. The agent has to commit.

So the inbox sorts by behavior, not by category:

- **Needs your review** — medium/low confidence or has a clarifying
  question
- **Auto-categorized by agent** — high confidence, no question, the agent
  decided on its own
- **Already actioned** — explicitly resolved, rule-applied, or flagged

Most transactions in a steady-state business are recurring (payroll, cloud
infra, payment processor payouts). The agent should handle those silently.
The owner's attention should land only where the agent is uncertain.

### Confirm-all instead of fully-silent auto-categorization

Auto-categorized transactions still require a one-click "Confirm all"
batch confirmation before they fully resolve. That's deliberate.

The agent's call is probabilistic. If high-confidence decisions landed
silently with no human acknowledgment, a wrong pattern could propagate for
months before anyone caught it — silent drift is one of the failure modes
the brief specifically asked about. *Confirm all* is one click, not a
per-transaction review, but it's a deliberate act, and it puts a human
signature on the audit trail.

The real reduction in work isn't "the owner never touches these." It's
"most transactions go from individual review to a one-click batch sanity
check." That's a meaningful reduction without giving up the human-in-loop
guarantee.

If trust in the agent grows over time and confirmation becomes ceremonial,
removing this step is a deliberate later decision — not a default we ship
with from day one.

### Lead reasoning bullet shape changes with confidence

The reasoning tooltip shown on each card displays the lead bullet only.
That single sentence has to do different work depending on confidence:

- **High confidence**: justify the pick. "Memo matches three prior payroll
  runs exactly."
- **Medium / low**: surface what's *preventing higher confidence*. "Strong
  merchant pattern, but no prior history for this specific payee — first
  transaction with this person." Or: "Consistent prior pattern, but the
  amount is 3x the January charge — rapid upward trend that could shift
  this toward COGS."

The reason: when the owner sees a yellow 72% next to a confident-sounding
sentence, it's confusing. The card *looks* like it needs attention but the
reasoning *reads* like a sure thing. Surfacing the gap in the lead bullet
makes "why is this in my queue?" answerable at a glance.

This is enforced in the system prompt with explicit guardrails to keep it
from leaking into how the agent calibrates confidence itself — see
[AGENT.md](./AGENT.md) for the exact wording and why.

### Narrowest-default rule scope

When the owner resolves a transaction, the rule selector defaults to *Just
this once* (no rule). To create a rule, they have to actively pick a
broader scope: *all transactions from this merchant* or *this merchant
within ±20% of the current amount*.

This is the overfitting mitigation. A common failure mode in systems like
this is: the owner resolves one $15k founder transfer as a loan, and the
system locks in "all founder transfers are loans automatically" — including
the $480 reimbursement next month. Defaulting narrow makes the broader
automation a deliberate choice, not an accident.

### "I'm not sure" as an escape hatch on every clarifying question

When the agent asks a clarifying question, the system prompt requires it to
include a final option: *"I'm not sure — flag for the bookkeeping team."*
This routes to the same flag-for-CPA flow as the orange flag button, but
it's discoverable inline, in the moment of friction.

The reason: forcing the owner to commit when they genuinely don't have the
information is how bad data ends up in the books. The "Send to CPA" flag
already existed as a side action, but pairing it inline with the question
makes the escape hatch obvious.

---

## Failure modes I designed for

The brief asked to be specific about what could go wrong with feedback
learning. Three modes, each with a mitigation visible in the UI:

### Overfitting

One unusual transaction shouldn't lock in a rule for every future
transaction with that merchant.

*Mitigation:* narrowest-default rule scope. Broader scopes require an
explicit click. The Rules tab also shows when each rule was last confirmed
and how many times it has fired, so a rule that quietly applied to a
mistaken match is visible at a glance.

### Silent drift

A rule created when the business had two employees may not apply when it
has twelve. Or a vendor that used to be a contractor may now be on payroll.
Rules that quietly stop being correct are the dangerous kind.

*Mitigation:* the Rules tab shows the last-confirmed date for each rule.
The CPA view's metrics surface "active rules" as a number to keep an eye
on. The longer-term move is a stale-rule alert (>90 days unconfirmed),
flagged in *what I'd build next*.

### Bad teacher

Owner mis-categorizes once and the system learns the wrong thing.

*Mitigation:* the Suspend button on each rule. Suspending pulls the rule
off the firing queue without deleting it — the audit trail still resolves,
the CPA can see what fired and roll it back, but the wrong rule stops
applying immediately. The CPA view also lets the bookkeeping team
explicitly roll back any decision (agent or human), which propagates back
into the audit log.

---

## What I cut and why

### Global persistent chat

I had it planned originally — a sidebar assistant the owner could open to
ask general questions. I cut it because the brief argued against it: a
bookkeeping agent that responds to vague questions doesn't reduce
cognitive load, it adds another surface to think about. The
per-transaction chat I kept (on the detail page) is scoped to a single
hypothesis — it has context, it has continuity, it can't go off-topic.

### Multi-agent orchestration

The single-LLM-call architecture is in [AGENT.md](./AGENT.md). The short
version: for the scope of this prototype, multi-agent adds latency,
debugging surface, and cost without adding clarity. Tool-using retrieval
is the natural v2 — when transaction volume grows enough that the
pre-built context object becomes lossy, a tool-using agent can pull
dynamically. For five-to-nine demo transactions, deterministic context
wins.

### Cold-start onboarding wizard

A brand-new business with no prior categorizations probably benefits more
from a guided "teach the agent your books" flow than from the same review
interface a mature business uses. The current cold-start mode (a flag in
the context object that caps confidence at MEDIUM and leans on
business-profile signals) is enough to make the agent behave reasonably,
but the onboarding flow itself is a v2 build.

### Real-time agent-pushed corrections

The agent could surface "I now think these prior categorizations were
wrong, given new context" — when a new rule contradicts past decisions,
or when business state shifts. I scoped this out as v2, partly because the
batched re-categorization sweep is more architecture than UI work and
partly because it's a separate trust conversation with the user.

---

## What I'd build next

In rough priority order:

1. **Eval harness on the system prompt.** The prompt is the single most
   important file in this codebase. Without a labeled set of historical
   transactions and a regression suite, prompt changes are scary. Even a
   small fixed set of 30–50 transactions with ground-truth accounts run
   on every prompt edit would catch most regressions.
2. **Tool-using retrieval.** Replace the pre-built context window with
   tools the agent calls dynamically: `searchPriorTransactions`,
   `lookupMerchantCategory`, `getBusinessProfile`. This handles the long
   tail (rare merchants, large history) and lets cost scale with what the
   agent actually needs to look at.
3. **Batch re-categorization sweep.** When a new rule contradicts prior
   decisions, surface them. "You just said all Stripe is Revenue, but
   these three older Stripe transactions were filed differently — review?"
4. **Stale rule alerts.** Rules unconfirmed for >90 days flagged in the
   CPA view. Drift mitigation made explicit.
5. **Cold-start onboarding wizard.** First-five categorizations as a
   guided flow rather than the same review surface.
6. **Inbox priority sort by `dollar_impact × (1 − confidence)`.** Right
   now the inbox is just sorted. A weighted priority would surface the
   biggest "could be wrong" items at the top.

---

## What's deliberately out of scope

- Visual polish and design system work. The brief explicitly said this
  isn't being evaluated; I matched Pilot's existing layout and brand
  accent enough for the demo and moved on.
- Production data architecture. The localStorage-backed state store is
  obviously a prototype choice — production would replace it with
  Pilot's books service. None of the agent design changes.
- Authentication, multi-user, real bank integration. Out-of-scope for an
  ambiguity-resolution demo.
