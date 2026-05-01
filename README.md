# Agentic Bookkeeping Prototype

An interactive prototype of an AI agent that helps small business owners
resolve ambiguous bank-transaction categorizations. Originally built as a
take-home exercise; published here as a portfolio project.

The agent forms a confident hypothesis on every transaction, auto-files
the high-confidence ones, surfaces only the genuinely ambiguous ones to
the owner, and produces a full audit trail for the bookkeeping team to
review at month-end.

> **Note:** Built as a take-home for Pilot. I'm not affiliated with Pilot;
> this code is mine. The product framing references Pilot's existing Tasks
> feature only because the design choice was to propose an *enhancement*
> rather than a standalone app.

---

## The interesting parts are in the docs

The code runs, but if you're skimming this in 30 seconds, the two
documents below are where the actual thinking lives:

### → [docs/DECISIONS.md](./docs/DECISIONS.md) — product thinking

*Why scope this as an enhancement to an existing surface? How do you
design for two audiences with the same data? When does an agent belong
in the auto-categorize lane vs. the "needs your review" lane, and what
goes wrong if you get that line wrong?*

Covers the framing, the dual-audience design, the failure modes the
system explicitly mitigates (overfitting, silent drift, bad teacher),
what I cut and why, and what I'd build next.

### → [docs/AGENT.md](./docs/AGENT.md) — AI craft

*Why one LLM call instead of multi-agent? What goes into the context
object, and what gets deliberately left out? How do you stop a model
from hedging? How do you make confidence calibration mean something
specific?*

Covers the single-call architecture, the six system-prompt rules and
what each one pushes back on, confidence calibration, cold-start mode,
forced tool use, prompt caching, and the anti-patterns this agent
deliberately avoids.

---

## Run it

```bash
npm install
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local
npm run dev
```

Open <http://localhost:3000>. The agent calls Claude live via
`claude-sonnet-4-6` with [prompt caching](./docs/AGENT.md#caching--cost)
on the system message.

> If you see *"Agent unavailable / Could not resolve authentication
> method,"* your shell may export an empty `ANTHROPIC_API_KEY` that
> masks the `.env.local` value. Restart with the variable unset:
> `unset ANTHROPIC_API_KEY && npm run dev`.

---

## Demo flow (~10 minutes)

The app ships with two seeded businesses you can switch between in the
header — **Pinecrest Telemetry** (18 months on the platform, warm state)
and **Crestline Software** (21 days, [cold-start](./docs/AGENT.md#cold-start-mode)).
There are also two profiles: **Owner** and **CPA** (the bookkeeping team).

1. **Tasks (`/tasks`)** — the agentic queue. The agent has run on every
   transaction in parallel. Some land in *Auto-categorized by agent*
   (high-confidence, ready for batch confirmation). Some land in *Needs
   your review* (medium/low confidence, or with a focused clarifying
   question). The split between these two lanes is
   [a deliberate product choice](./docs/DECISIONS.md#confirm-all-instead-of-fully-silent-auto-categorization).
2. **Click any card** → two-pane transaction detail page. Left pane shows
   the agent's hypothesis with reasoning, alternatives considered, and
   the historical context the agent referenced. Right pane is the action
   surface — confirm, override, flag for the bookkeeping team, or
   resolve the clarifying question. Notice that medium-confidence cards
   lead with [a different reasoning shape](./docs/DECISIONS.md#lead-reasoning-bullet-shape-changes-with-confidence)
   than high-confidence ones.
3. **Switch to CPA profile** (top right). The audit lens. Period header,
   decision metrics, audit trail per transaction, and the Inspect surface
   showing the [exact system prompt and context object](./docs/AGENT.md#what-goes-into-the-context)
   for every call.
4. **Switch to Crestline Software** in the header. Same agent, no prior
   history. Watch confidence drop, watch the agent ask more questions,
   watch reasoning shift from pattern-matching to business-profile
   inference. Same prompt, conditioned on a single `isColdStart` flag.

---

## Stack

Next.js (App Router) · TypeScript · Tailwind · `@anthropic-ai/sdk` ·
forced tool use · `localStorage` for prototype-grade persistence.

---

## Status

Prototype, not production. The state store is `localStorage`; production
would replace it with a real books service. The agent design itself is
production-shaped — see [docs/AGENT.md](./docs/AGENT.md) for what carries
over and what changes at scale.
