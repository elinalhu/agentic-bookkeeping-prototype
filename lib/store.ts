// Client-side state for the prototype, persisted to localStorage so
// that decisions, rules, and audit events survive page refreshes during
// a demo. Intentionally not a real backend — the goal is for the
// interviewer to be able to walk through the flow end-to-end without
// state mysteriously resetting.

"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { pushToastExternal } from "@/components/ToastProvider";
import {
  DEFAULT_COMPANY_ID,
  accountById,
  companies,
  getCompany,
} from "./fixtures";
import type {
  AccountId,
  AgentHypothesis,
  AgentResponse,
  AuditEvent,
  Rule,
  Transaction,
  TransactionStatus,
} from "./types";

// ---------- Dismissed suggested corrections ----------
//
// Per-company set of correction IDs (= the txnId being corrected) that
// the user has dismissed. Dismissed corrections don't render on the
// Tasks page anymore — but stay in fixtures for posterity.

export function useDismissedCorrections(companyId: string) {
  const [dismissed, setDismissed] = useStored<string[]>(
    storageKey(companyId, "dismissed-corrections"),
    [],
  );

  const dismiss = useCallback(
    (txnId: string) => {
      setDismissed((prev) => (prev.includes(txnId) ? prev : [...prev, txnId]));
    },
    [setDismissed],
  );

  const restore = useCallback(
    (txnId: string) => {
      setDismissed((prev) => prev.filter((id) => id !== txnId));
    },
    [setDismissed],
  );

  return { dismissed, dismiss, restore };
}

// ---------- Sidebar collapsed state ----------
//
// Persisted across pages via the same useStored notify mechanism so
// the collapse state is shared instantly between sidebar and any
// component that wants to react to it.

const SIDEBAR_COLLAPSED_KEY = "pilot.sidebar-collapsed";

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed, hydrated] = useStored<boolean>(
    SIDEBAR_COLLAPSED_KEY,
    false,
  );

  const toggle = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, [setCollapsed]);

  return { collapsed, toggle, hydrated };
}

// ---------- Active user profile ----------
//
// Owner vs CPA — purely a UX role indicator. Affects which actor is
// stamped on audit events, which copy variants render, and which
// affordances show. No real auth — it's a switcher in the header.

const USER_PROFILE_KEY = "pilot.user-profile";

export type UserProfile = "owner" | "cpa";

export function useUserProfile() {
  const [profile, setProfile, hydrated] = useStored<UserProfile>(
    USER_PROFILE_KEY,
    "owner",
  );

  const switchProfile = useCallback(
    (next: UserProfile) => setProfile(next),
    [setProfile],
  );

  return { profile, switchProfile, hydrated };
}

// ---------- Active company ----------
//
// Routed through useStored so all instances of useActiveCompany across
// the page (Header switcher, Inbox, Detail, CPA) share state and react
// to changes without a page reload. Without this, switching companies
// in the dropdown only updated the Header's local copy.

const ACTIVE_COMPANY_KEY = "pilot.active-company";

export function useActiveCompany() {
  const [companyId, setCompanyId, hydrated] = useStored<string>(
    ACTIVE_COMPANY_KEY,
    DEFAULT_COMPANY_ID,
  );

  const switchCompany = useCallback(
    (id: string) => {
      if (!companies[id]) return;
      setCompanyId(id);
    },
    [setCompanyId],
  );

  return {
    company: getCompany(companyId),
    companyId,
    switchCompany,
    hydrated,
  };
}

// ---------- Per-company persisted state ----------
//
// Each company has its own:
//   - decisions: Map<txnId, { categoryId, status, hypothesisAtDecision }>
//   - rules: Rule[]
//   - audit: AuditEvent[]
//   - cachedHypotheses: Map<txnId, AgentHypothesis>
//
// All keyed under `pilot.<companyId>.<sliceName>`. We store them in
// localStorage as JSON so the demo persists across page reloads.

interface UserDecision {
  txnId: string;
  categoryId: string;
  status: TransactionStatus;
  decidedAt: string; // ISO
  // Snapshot of what the agent said at the moment of decision —
  // useful for the audit trail.
  hypothesisAtDecision?: AgentHypothesis;
  notes?: string;
}

function storageKey(companyId: string, slice: string) {
  return `pilot.${companyId}.${slice}`;
}

// All localStorage slices owned per company. Used by resetCompanyState
// to scrub a company's demo data in one shot.
const COMPANY_STATE_SLICES = [
  "decisions",
  "rules",
  "audit",
  "agent-cache",
  "narrative-override",
  "dismissed-corrections",
];

/**
 * Clear all per-company state (decisions, rules, audit log, agent
 * cache, narrative override, dismissed corrections) from localStorage
 * and notify subscribers so live pages re-render with empty state.
 */
export function resetCompanyState(companyId: string) {
  if (typeof window === "undefined") return;
  for (const slice of COMPANY_STATE_SLICES) {
    const key = storageKey(companyId, slice);
    localStorage.removeItem(key);
    notify(key);
  }
}

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

// Notify other hooks within the same tab when a slice changes.
const listeners = new Map<string, Set<() => void>>();
function subscribe(key: string, fn: () => void): () => void {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key)!.add(fn);
  return () => {
    listeners.get(key)?.delete(fn);
  };
}
function notify(key: string) {
  listeners.get(key)?.forEach((fn) => fn());
}

type Updater<T> = T | ((prev: T) => T);

function useStored<T>(
  key: string,
  fallback: T,
): [T, (next: Updater<T>) => void, boolean] {
  const [value, setValue] = useState<T>(fallback);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setValue(readJSON<T>(key, fallback));
    setHydrated(true);
    return subscribe(key, () => setValue(readJSON<T>(key, fallback)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback(
    (next: Updater<T>) => {
      const prev = readJSON<T>(key, fallback);
      const newValue =
        typeof next === "function"
          ? (next as (prev: T) => T)(prev)
          : next;
      writeJSON(key, newValue);
      setValue(newValue);
      notify(key);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  return [hydrated ? value : fallback, update, hydrated];
}

// ---------- Decisions ----------

export function useDecisions(companyId: string) {
  const [decisions, setDecisions] = useStored<Record<string, UserDecision>>(
    storageKey(companyId, "decisions"),
    {},
  );

  const recordDecision = useCallback(
    (decision: UserDecision) => {
      setDecisions((prev) => ({ ...prev, [decision.txnId]: decision }));
    },
    [setDecisions],
  );

  const clearDecision = useCallback(
    (txnId: string) => {
      setDecisions((prev) => {
        const next = { ...prev };
        delete next[txnId];
        return next;
      });
    },
    [setDecisions],
  );

  return { decisions, recordDecision, clearDecision };
}

// ---------- Rules ----------

export function useRules(companyId: string) {
  const [rules, setRules] = useStored<Rule[]>(
    storageKey(companyId, "rules"),
    [],
  );

  const addRule = useCallback(
    (rule: Rule) => {
      setRules((prev) => [...prev, rule]);
    },
    [setRules],
  );

  const suspendRule = useCallback(
    (id: string, reason: string) => {
      setRules((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, suspended: true, suspendedReason: reason } : r,
        ),
      );
    },
    [setRules],
  );

  const bumpRuleCount = useCallback(
    (id: string) => {
      setRules((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, applicationsCount: (r.applicationsCount ?? 0) + 1 }
            : r,
        ),
      );
    },
    [setRules],
  );

  return { rules, addRule, suspendRule, bumpRuleCount };
}

// ---------- Audit log ----------

export function useAuditLog(companyId: string) {
  const [events, setEvents] = useStored<AuditEvent[]>(
    storageKey(companyId, "audit"),
    [],
  );

  const append = useCallback(
    (event: AuditEvent) => {
      setEvents((prev) => [...prev, event]);
    },
    [setEvents],
  );

  const eventsForTxn = useCallback(
    (txnId: string) => events.filter((e) => e.txnId === txnId),
    [events],
  );

  return { events, append, eventsForTxn };
}

// ---------- Cached agent hypotheses ----------
//
// The agent route is the source of truth, but we cache its full
// response (hypothesis + inspect payload) in localStorage so returning
// to a transaction shows the same answer without re-spending tokens.

export function useCachedAgent(companyId: string) {
  const [cache, setCache] = useStored<Record<string, AgentResponse>>(
    storageKey(companyId, "agent-cache"),
    {},
  );

  const get = useCallback((txnId: string) => cache[txnId], [cache]);
  const set = useCallback(
    (txnId: string, response: AgentResponse) => {
      setCache((prev) => ({ ...prev, [txnId]: response }));
    },
    [setCache],
  );
  const clear = useCallback(
    (txnId: string) => {
      setCache((prev) => {
        const next = { ...prev };
        delete next[txnId];
        return next;
      });
    },
    [setCache],
  );

  return { get, set, clear, cache };
}

// ---------- useAgent: orchestrates the agent call + cache ----------

type AgentState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: AgentResponse }
  | { status: "error"; error: string };

async function fetchAgent(
  companyId: string,
  txnId: string,
): Promise<AgentResponse | { error: string }> {
  // Pick up any CPA-edited business narrative override and pass it to
  // the agent route so the prompt reflects the latest business state.
  const narrativeOverride = readJSON<string | null>(
    storageKey(companyId, "narrative-override"),
    null,
  );
  const res = await fetch("/api/agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      companyId,
      transactionId: txnId,
      narrativeOverride,
    }),
  });
  return (await res.json()) as AgentResponse | { error: string };
}

// Per-company override for BusinessProfile.narrative — lets CPAs
// (Pilot internal staff) refine the agent's understanding of the
// business as it evolves. Persisted in localStorage; passed to the
// agent route on every call.
export function useBusinessNarrativeOverride(companyId: string) {
  const [override, setOverride, hydrated] = useStored<string | null>(
    storageKey(companyId, "narrative-override"),
    null,
  );
  const reset = useCallback(() => setOverride(null), [setOverride]);
  return { override, setOverride, reset, hydrated };
}

export function useAgent(companyId: string, txnId: string) {
  const { set } = useCachedAgent(companyId);
  const [state, setState] = useState<AgentState>({ status: "idle" });

  const run = useCallback(
    async (opts?: { force?: boolean }) => {
      if (!opts?.force) {
        // Synchronous localStorage read — bypass useStored's hydration
        // ordering, which otherwise causes useAgent to fire a fresh
        // fetch on mount even when the inbox prefetch already cached
        // the answer.
        const cache = readJSON<Record<string, AgentResponse>>(
          storageKey(companyId, "agent-cache"),
          {},
        );
        const cached = cache[txnId];
        if (cached) {
          setState({ status: "success", data: cached });
          return;
        }
      }
      setState({ status: "loading" });
      try {
        const json = await fetchAgent(companyId, txnId);
        if ("error" in json) {
          setState({ status: "error", error: json.error });
          return;
        }
        set(txnId, json);
        setState({ status: "success", data: json });
      } catch (err) {
        setState({
          status: "error",
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    },
    [companyId, txnId, set],
  );

  // Auto-run on mount.
  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, txnId]);

  return { state, rerun: () => run({ force: true }) };
}

// ---------- usePrefetchAgents: warm the cache for the inbox ----------
//
// Called from the inbox page. Fires `/api/agent` in parallel for every
// needs-review transaction that doesn't already have a cached response.
// Once warm, navigating into a transaction is instant.

interface PrefetchState {
  pending: Set<string>;
  errors: Record<string, string>;
}

export function usePrefetchAgents(
  companyId: string,
  txnIds: string[],
): PrefetchState {
  const { set } = useCachedAgent(companyId);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Stable join key so the effect fires once per company+txn-set, not on
  // every re-render that hands us a new array.
  const idsKey = txnIds.join(",");

  useEffect(() => {
    // Synchronous read for the same hydration-race reason as useAgent.
    const cache = readJSON<Record<string, AgentResponse>>(
      storageKey(companyId, "agent-cache"),
      {},
    );
    const toFetch = txnIds.filter((id) => !cache[id]);
    if (toFetch.length === 0) return;

    setPending(new Set(toFetch));

    let cancelled = false;
    void Promise.all(
      toFetch.map(async (id) => {
        try {
          const json = await fetchAgent(companyId, id);
          if (cancelled) return;
          if ("error" in json) {
            setErrors((prev) => ({ ...prev, [id]: json.error }));
          } else {
            set(id, json);
          }
        } catch (err) {
          if (cancelled) return;
          setErrors((prev) => ({
            ...prev,
            [id]: err instanceof Error ? err.message : "Unknown error",
          }));
        } finally {
          if (cancelled) return;
          setPending((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }
      }),
    );

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, idsKey]);

  return { pending, errors };
}

// ---------- Helpers exposed to UI ----------

/**
 * Reconstruct the *current* status for a transaction by overlaying
 * stored user decisions on top of the seed data. Inbox txns start as
 * "needs_review" but become "resolved_by_user" / "rule_applied" /
 * "flagged_for_cpa" once the user acts.
 */
export function effectiveTransaction(
  base: Transaction,
  decisions: Record<string, UserDecision>,
): Transaction {
  const decision = decisions[base.id];
  if (!decision) return base;
  return {
    ...base,
    status: decision.status,
    categoryId: decision.categoryId,
  };
}

// ---------- useAgentResolution: the resolution flow ----------
//
// Single source of truth for what happens when the owner confirms,
// overrides, skips, or flags a transaction. Records the user decision,
// fires the right audit events (agent_proposed, user_confirmed /
// user_overrode / user_skipped / cpa_flagged, optional rule_created),
// optionally saves a rule, and redirects.

export function useAgentResolution(
  companyId: string,
  txn: Transaction,
  hypothesis: AgentHypothesis,
) {
  const router = useRouter();
  const { recordDecision, clearDecision } = useDecisions(companyId);
  const { addRule } = useRules(companyId);
  const { append } = useAuditLog(companyId);
  const { profile } = useUserProfile();

  const nameOf = (id: string) => accountById(id)?.name ?? id;
  const actor = profile;
  const actorLabel = profile === "cpa" ? "CPA" : "Owner";

  // Reopen — undoes a previously-recorded decision so the txn returns
  // to the needs-review queue. The audit trail keeps the original
  // events plus a new "user_reopened" event so history reads honestly.
  const reopen = useCallback(() => {
    const now = new Date().toISOString();
    clearDecision(txn.id);
    append({
      id: `evt.${txn.id}.${now}.reopen`,
      txnId: txn.id,
      timestamp: now,
      type: "user_reopened",
      actor,
      summary: `${actorLabel} reopened this transaction for review`,
    });
  }, [txn, actor, actorLabel, clearDecision, append]);

  const resolve = useCallback(
    (opts: {
      accountId: AccountId;
      status: TransactionStatus;
      rule?: Rule | null;
      note?: string;
      redirect?: string | null; // null = stay on page
    }) => {
      const {
        accountId,
        status,
        rule,
        note,
        redirect = "/tasks",
      } = opts;
      const decidedAt = new Date().toISOString();

      recordDecision({
        txnId: txn.id,
        categoryId: accountId,
        status,
        decidedAt,
        hypothesisAtDecision: hypothesis,
        notes: note,
      });

      append({
        id: `evt.${txn.id}.${decidedAt}.hypothesis`,
        txnId: txn.id,
        timestamp: decidedAt,
        type: "agent_proposed",
        actor: "agent",
        summary: `Agent proposed ${nameOf(hypothesis.accountId)} (${hypothesis.confidence}, ${hypothesis.confidenceScore.toFixed(2)})`,
        detail: { accountId: hypothesis.accountId, hypothesis },
      });

      if (status === "flagged_for_cpa") {
        append({
          id: `evt.${txn.id}.${decidedAt}.flag`,
          txnId: txn.id,
          timestamp: decidedAt,
          type: "cpa_flagged",
          actor,
          summary: `${actorLabel} flagged for CPA review${note ? `: "${note}"` : ""}`,
          detail: { accountId, note },
        });
      } else if (accountId !== hypothesis.accountId) {
        append({
          id: `evt.${txn.id}.${decidedAt}.override`,
          txnId: txn.id,
          timestamp: decidedAt,
          type: "user_overrode",
          actor,
          summary: `${actorLabel} overrode to ${nameOf(accountId)} (agent proposed ${nameOf(hypothesis.accountId)})`,
          detail: {
            agentProposed: hypothesis.accountId,
            userPicked: accountId,
          },
        });
      } else {
        append({
          id: `evt.${txn.id}.${decidedAt}.confirm`,
          txnId: txn.id,
          timestamp: decidedAt,
          type: "user_confirmed",
          actor,
          summary: `${actorLabel} confirmed ${nameOf(accountId)}`,
          detail: { accountId },
        });
      }

      if (rule) {
        addRule(rule);
        append({
          id: `evt.${txn.id}.${rule.createdAt}.rule`,
          txnId: txn.id,
          timestamp: rule.createdAt,
          type: "rule_created",
          actor,
          summary: `Rule created: ${describeRule(rule)}`,
          detail: { rule },
        });
      }

      // Undo toast — short-window forgiveness for accidental clicks.
      pushToastExternal({
        message: toastMessageFor(status, accountId, hypothesis.accountId),
        detail: `${txn.merchant} · ${formatToastAmount(txn)}`,
        actionLabel: "Undo",
        onAction: () => {
          // Same logic as reopen, inlined to avoid stale closures across
          // the resolved/redirected page boundary.
          const now = new Date().toISOString();
          clearDecision(txn.id);
          append({
            id: `evt.${txn.id}.${now}.undo`,
            txnId: txn.id,
            timestamp: now,
            type: "user_reopened",
            actor,
            summary: `${actorLabel} undid the previous action`,
          });
        },
      });

      if (redirect) router.push(redirect);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [companyId, txn, hypothesis, actor, actorLabel, recordDecision, clearDecision, append, addRule, router],
  );

  const skip = useCallback(() => {
    const now = new Date().toISOString();
    recordDecision({
      txnId: txn.id,
      categoryId: hypothesis.accountId,
      status: "needs_review",
      decidedAt: now,
      hypothesisAtDecision: hypothesis,
      notes: "Skipped — still ambiguous",
    });
    append({
      id: `evt.${txn.id}.${now}.skip`,
      txnId: txn.id,
      timestamp: now,
      type: "user_skipped",
      actor,
      summary: `${actorLabel} skipped — still ambiguous`,
    });
    pushToastExternal({
      message: "Skipped — back in inbox",
      detail: `${txn.merchant} · ${formatToastAmount(txn)}`,
      actionLabel: "Undo",
      onAction: () => {
        const undoAt = new Date().toISOString();
        clearDecision(txn.id);
        append({
          id: `evt.${txn.id}.${undoAt}.undo`,
          txnId: txn.id,
          timestamp: undoAt,
          type: "user_reopened",
          actor,
          summary: `${actorLabel} undid the skip`,
        });
      },
    });
    router.push("/tasks");
  }, [txn, hypothesis, actor, actorLabel, recordDecision, clearDecision, append, router]);

  const recordClarifyingAnswer = useCallback(
    (suggestedAccountId: AccountId, label: string) => {
      const now = new Date().toISOString();
      append({
        id: `evt.${txn.id}.${now}.clarify`,
        txnId: txn.id,
        timestamp: now,
        type: "user_confirmed",
        actor,
        summary: `${actorLabel} answered "${label}" → ${nameOf(suggestedAccountId)}`,
        detail: { label, suggestedAccountId },
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [txn, actor, actorLabel, append],
  );

  return { resolve, skip, recordClarifyingAnswer, reopen };
}

function toastMessageFor(
  status: TransactionStatus,
  accountId: string,
  agentProposed: string,
): string {
  const account = accountById(accountId)?.name ?? accountId;
  if (status === "flagged_for_cpa") return `Flagged for CPA review`;
  if (accountId !== agentProposed) return `Saved correction → ${account}`;
  return `Confirmed ${account}`;
}

function formatToastAmount(txn: Transaction): string {
  const sign = txn.direction === "inflow" ? "+" : "−";
  return `${sign}$${txn.amount.toLocaleString("en-US")}`;
}

function describeRule(rule: Rule): string {
  const accountName = accountById(rule.accountId)?.name ?? rule.accountId;
  if (rule.scope === "this_merchant") {
    return `${rule.merchant} → ${accountName}`;
  }
  return `${rule.merchant} between $${rule.amountMin?.toFixed(0)}–$${rule.amountMax?.toFixed(0)} → ${accountName}`;
}
