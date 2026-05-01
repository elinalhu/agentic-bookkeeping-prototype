# Agentic Bookkeeping Prototype

An interactive prototype of an AI agent that helps small business owners
resolve ambiguous bank-transaction categorizations. Originally built as a
take-home exercise; published here as a portfolio project.

The agent forms a confident hypothesis on every transaction, auto-files
the high-confidence ones, surfaces only the genuinely ambiguous ones to
the owner, and produces a full audit trail for the bookkeeping team to
review at month-end.

> **Note:** This was built as a take-home exercise for Pilot. I'm not
> affiliated with Pilot; this code is mine. The product framing references
> Pilot's existing Tasks feature only because the design choice was to
> propose an *enhancement* rather than a standalone app — see
> [docs/DECISIONS.md](./docs/DECISIONS.md) for the framing rationale.

---

## Run it

```bash
npm install
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local
npm run dev
```

Open <http://localhost:3000>. The agent calls Claude live via
`claude-sonnet-4-6` with prompt caching on the system message.

> If you see *"Agent unavailable / Could not resolve authentication
> method,"* your shell may export an empty `ANTHROPIC_API_KEY` that
> masks the `.env.local` value. Restart with the variable unset:
> `unset ANTHROPIC_API_KEY && npm run dev`.

---

## Demo flow (~10 minutes)

The app ships with two seeded businesses you can switch between in the
header — **Pinecrest Telemetry** (18 months on the platform, warm state)
and **Crestline Software** (21 days, cold-start). There are also two
profiles: **Owner** and **CPA** (the bookkeeping team).

1. **Tasks (`/tasks`)** — the agentic queue. The agent has run on every
   transaction in parallel. Some land in *Auto-categorized by agent*
   (high-confidence, ready for batch confirmation). Some land in *Needs
   your review* (medium/low confidence, or with a focused clarifying
   question).
2. **Click any card** → two-pane transaction detail page. Left pane shows
   the agent's hypothesis with reasoning, alternatives considered, and
   the historical context the agent referenced. Right pane is the action
   surface — confirm, override, flag for the bookkeeping team, or
   resolve the clarifying question.
3. **Switch to CPA profile** (top right). The audit lens. Period header,
   decision metrics, audit trail per transaction, and the Inspect surface
   showing the exact system prompt, context object, and raw model output
   for every call.
4. **Switch to Crestline Software** in the header. The same agent, no
   prior history. Watch confidence drop, watch the agent ask more
   questions, watch reasoning shift from pattern-matching to
   business-profile inference. Same prompt, conditioned on a single
   `isColdStart` flag.

---

## Read more

- **[docs/DECISIONS.md](./docs/DECISIONS.md)** — product thinking. Why
  this was scoped as an enhancement to an existing surface. The
  dual-audience design. Failure modes the system explicitly mitigates.
  What I cut and why. What I'd build next.
- **[docs/AGENT.md](./docs/AGENT.md)** — AI craft. Why one LLM call
  rather than multi-agent orchestration. What goes into the context
  object and why. The system-prompt rules that push back on specific
  LLM failure modes. Confidence calibration, cold-start, forced tool
  use, prompt caching, and the anti-patterns this agent deliberately
  avoids.

---

## Stack

Next.js (App Router) · TypeScript · Tailwind · `@anthropic-ai/sdk` ·
forced tool use (`propose_categorization`) · `localStorage` for
prototype-grade persistence.

---

## Status

Prototype. Not production. The state store is `localStorage`; production
would replace it with a real books service. The agent design itself is
production-shaped — see [docs/AGENT.md](./docs/AGENT.md) for what carries
over and what changes at scale.
