"use client";

import type { AuditEvent } from "@/lib/types";

const ACTOR_LABEL: Record<AuditEvent["actor"], string> = {
  agent: "Agent",
  owner: "Owner",
  cpa: "CPA",
  system: "System",
};

const ACTOR_COLOR: Record<AuditEvent["actor"], string> = {
  agent: "bg-blue-100 text-blue-900",
  owner: "bg-zinc-100 text-zinc-900",
  cpa: "bg-violet-100 text-violet-900",
  system: "bg-zinc-100 text-zinc-700",
};

export function AuditTrail({ events }: { events: AuditEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="text-xs text-zinc-500">
        No agent-tracked events for this transaction. It either predates the
        agent flow, was seeded as historical data, or was resolved without
        audit logging.
      </div>
    );
  }

  return (
    <ol className="space-y-3">
      {events
        .slice()
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
        .map((e) => (
          <li key={e.id} className="flex gap-3 text-sm">
            <div className="w-32 shrink-0 font-mono text-xs text-zinc-500">
              {new Date(e.timestamp).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${ACTOR_COLOR[e.actor]}`}
                >
                  {ACTOR_LABEL[e.actor]}
                </span>
                <span className="text-xs text-zinc-500">
                  {humanizeType(e.type)}
                </span>
              </div>
              <div className="mt-0.5 text-sm text-zinc-800">{e.summary}</div>
            </div>
          </li>
        ))}
    </ol>
  );
}

function humanizeType(type: AuditEvent["type"]): string {
  return type.replace(/_/g, " ");
}
