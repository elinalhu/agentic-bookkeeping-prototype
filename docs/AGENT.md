# Agent Architecture

This is the AI-craft-specific companion to [DECISIONS.md](./DECISIONS.md).
That doc explains *what* I built and *why* from a product perspective.
This one explains *how the agent works* — context, prompt, calibration,
and the tradeoffs that shaped each piece.

---

## One LLM call per transaction

Every categorization is a single Claude call (`claude-sonnet-4-6`) with
forced tool use. No multi-agent orchestration, no tool-using retrieval
loop, no chain-of-thought sub-prompts.

The context object is built deterministically in app code
(`lib/agent/buildContext.ts`) before the prompt runs. The model sees
exactly what the Inspect cards in the UI show — there's no hidden
retrieval, no surprise lookups.

### Why single-call

- **Reliability.** For a demo with five-to-nine transactions, a single
  call gives predictable latency and cost. Multi-agent setups multiply
  the failure surface — any sub-agent that misbehaves cascades.
- **Auditability.** The CPA view's Inspect surface (system prompt + full
  context object + raw model output) reconstructs the exact decision.
  Multi-agent makes that audit trail much harder to follow.
- **Determinism for fixtures.** What gets retrieved is decided in code,
  not by the model. Fixtures shape the agent's behavior in a knowable
  way; demos don't depend on the model deciding to look at the right
  thing.

Tool-using retrieval is the right v2. As transaction volume grows the
pre-built context window becomes lossy — that's when the agent should
pull dynamically (`searchPriorTransactions`, `lookupMerchantCategory`).
For this prototype scope, that's premature.

---

## What goes into the context

The context object has six pieces. Each is included for a specific
reason:

| Field | Why it's in the prompt |
|---|---|
| `business` | Entity type, industry, headcount, has-inventory, owner-comp model, narrative. The agent reasons about *this specific business*, not a generic one. An LLC taxed as S-corp with mixed W-2 + draws categorizes the same merchant differently than a sole prop. |
| `chartOfAccounts` | Every account this business uses, with a short description. Critical: descriptions, not just names. Without descriptions, the model is guessing what *Software & Technology* vs *COGS — Hosting* means. |
| `transaction` | The transaction to categorize (merchant, amount, date, memo, direction). |
| `similarMerchantHistory` | Up to N most-recent confirmed categorizations of the same merchant. Strongest pattern signal — the model leans heavily on this. |
| `recentOtherTransactions` | A handful of other recent confirmed categorizations. Gives the model a sense of business shape (revenue rhythm, payroll cadence) beyond just merchant matches. |
| `activeRules` | Any rules the user has saved that touch this merchant. So the model can reference them in reasoning even though rule firing is deterministic upstream. |
| `isColdStart` | Boolean. True when prior history is too thin to pattern-match. Toggles a different prompt behavior — see below. |

The whole object is JSON-serialized into the user message. The system
prompt is the same on every call (which lets prompt caching kick in —
more on that below).

---

## The system prompt

The prompt lives in `lib/agent/systemPrompt.ts` and it's the centerpiece
of the project. Six explicit rules, each chosen to push back on a
specific LLM failure mode:

### 1. Form a confident hypothesis. Pick exactly one account.

Counters the LLM tendency to hedge ("this could be either X or Y…").
Forces commitment. The schema requires exactly one `accountId` from the
chart of accounts.

### 2. Cite specific, concrete evidence in reasoning.

*"Stripe payouts in March were both categorized as Revenue"* beats
*"This is probably revenue."* Evidence bullets must reference real
signals from the context — a particular prior transaction, a specific
business-profile field, an explicit merchant heuristic. This is what
makes the agent auditable.

### 3. Ask only when ambiguity is genuinely unresolvable.

If the agent can form a medium-or-better hypothesis, it explains rather
than asks. When it does ask, the question must have 2–4 specific answer
options that map to specific accounts, **plus** a final escape-hatch
option labeled *"I'm not sure — flag for the bookkeeping team"* with
`nextAction: "flag"`. The escape hatch is mandatory.

The reason for the escape hatch: forcing the owner to guess when they
genuinely don't have the information is how bad data ends up in the
books. See [DECISIONS.md](./DECISIONS.md) for the product reasoning.

### 4. Always include 1–2 plausible alternatives.

Even at high confidence. The CPA reviewing the decision later should be
able to see what was considered and rejected. Cheap insurance for
auditability.

### 5. At medium/low confidence, the lead reasoning bullet must surface what's preventing higher confidence.

This is the rule that took the most iteration. The naive version —
*"explain the ambiguity"* — caused the agent to recalibrate downward,
dropping high-confidence transactions into medium and medium into low.
The tightened wording explicitly separates explanation from calibration:

> *"This is about explanation, not calibration: do not lower your
> confidence just to write a more uncertain bullet — apply the
> confidence rubric below as written, and use this rule to surface the
> gap to the owner."*

The result: medium-confidence cards lead with a sentence like *"Strong
merchant pattern, but no prior history for this specific payee — first
transaction with this person, so the pattern-matching signal is
absent"* rather than just *"Individual person's name via direct ACH —
classic 1099 contractor pattern."* The owner sees at a glance why the
card is in their queue.

### 6. Optionally propose a rule, with narrowest-useful scope.

Rules only at high confidence (or after explicit user confirmation).
Default to the narrowest scope that's actually useful. Broader scopes
("apply to all merchant X regardless of amount") risk overfitting on a
single decision.

---

## Confidence calibration

The prompt includes an explicit rubric:

- **HIGH (score > 0.8)**: at least 2 prior similar categorizations agree,
  AND the merchant/amount is unambiguous given the business profile.
- **MEDIUM (0.5–0.8)**: one supporting signal, OR a meaningful deviation
  from an otherwise consistent pattern.
- **LOW (< 0.5)**: no relevant prior history, OR multiple accounts
  plausibly fit, OR the business profile is too thin to disambiguate.

Without this rubric, the model defaults to medium on almost everything
— it hedges. Tying confidence to specific evidence thresholds forces it
to pick a band based on what's actually in the context.

The confidence label drives auto-categorization: only `confidence ===
"high"` (with no clarifying question) is eligible for the
auto-categorized section. This threshold is intentional — see *Confirm
all instead of fully-silent auto-categorization* in
[DECISIONS.md](./DECISIONS.md).

---

## Cold-start mode

When `isColdStart=true` (very young business, almost no history), the
prompt branches inline:

> *"Cap confidence at MEDIUM. Lean harder on the business-profile signal
> — entity type, industry, has-inventory flag, payroll model — when
> reasoning. You should be more willing to ask a clarifying question
> than in the warm state, but still: at most ONE focused question with
> options."*

This lets the same prompt handle warm and cold businesses without
branching the API route. The two seeded businesses in the demo
(Pinecrest Telemetry, 18 months in; Crestline Software, 21 days in)
both go through the same prompt — `isColdStart` toggles the behavior.

---

## Forced tool use & structured output

The schema is defined in `lib/agent/schema.ts`. The agent doesn't return
free-form prose — it's required to call the `propose_categorization`
tool with a structured object:

```ts
{
  accountId: string,                  // must exist in the chart of accounts
  confidence: "high" | "medium" | "low",
  confidenceScore: number,            // 0..1
  reasoning: string[],                // 3-5 bullets
  alternatives: { accountId, why }[], // 1-2
  clarifyingQuestion?: {              // only when ambiguity is unresolvable
    text: string,
    options: { label, suggestedAccountId, nextAction }[],
  },
  proposedRule?: { scope, criteria, accountId },
}
```

`accountId` and `alternatives[].accountId` are constrained by an enum
list of account IDs from the active business's chart of accounts. The
model literally cannot return an account that doesn't exist.

Why forced tool use:

- **No prose output to parse.** Reliable structured fields, no
  regex-the-LLM-output anti-pattern.
- **Schema constrains the failure mode.** Missing or invalid fields
  throw before the UI ever sees them.
- **Audit-friendly.** The Inspect surface displays the exact tool-call
  payload, not a re-parsed approximation.

---

## Caching & cost

The system prompt is identical across every call in a batch. Anthropic's
prompt caching kicks in after the first call — every subsequent
transaction in the same session reads the system message from cache,
paying input-token prices only on the per-transaction context. The
Inspect cards expose this in the stats line:

> `claude-sonnet-4-6 · 12.4s · 2,351 in / 595 out tokens · 98% cached`

For a nine-transaction batch firing in parallel on page load, this is
real money. First call pays the full system prompt; the next eight read
from cache.

Local caching is layered on top: hypothesis results are stored in
`localStorage` keyed by transaction ID + business ID. Reload the page
and you don't re-fire the agent — the cache hydrates instantly and only
new transactions trigger calls.

---

## Anti-patterns I avoided

A few things this agent deliberately doesn't do:

- **Vague open-ended questions.** *"What is this transaction?"* is
  banned. Every clarifying question has 2–4 specific answer options
  plus the escape hatch. Never a free-text field.
- **Inflated confidence to seem helpful.** The prompt explicitly says
  *"Do not inflate confidence to seem helpful. If you'd be more useful
  by asking, ask."*
- **Tax tutorials.** When tax treatment varies between options, the
  prompt allows one short clarifying sentence — not a paragraph. The
  owner doesn't need a lecture; they need to act.
- **Hidden context.** Everything the agent sees is visible in the
  Inspect surface in the CPA view. No magic retrieval.
- **Free-form output.** Tool use is forced. The model can't write a
  paragraph instead of a categorization.

---

## Where the agent could go wrong, and where I look first

| Symptom | Most likely cause | Where to look |
|---|---|---|
| Auto-categorize threshold not behaving | Confidence label drift in the rubric | `systemPrompt.ts` CONFIDENCE CALIBRATION block |
| Asking too many questions | Step 3 wording loose, agent treating gaps as "unresolvable" | `systemPrompt.ts` rule 3 |
| Reasoning sounds confident on yellow cards | Step 5 not landing — agent justifying instead of surfacing the gap | `systemPrompt.ts` rule 5 |
| Same merchant categorized inconsistently | Pattern signal not strong enough in context | `buildContext.ts` — increase merchant-history depth |
| Hallucinated account name | Missing constraint in schema enum | `schema.ts` — verify `accountIds` enum is generated from active company |
| Rule firing on the wrong amount | Rule scope or amount-band mismatch | `lib/store.ts` rule-matching logic |

The system prompt is the file to be most careful with. It's where the
behavior lives. Treat it like production code: review every change,
ideally regression-test against a labeled set (which I haven't built
yet — that's the top of the v2 list).
