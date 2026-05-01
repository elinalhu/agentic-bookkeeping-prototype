"use client";

import { useEffect, useState } from "react";
import {
  useActiveCompany,
  useBusinessNarrativeOverride,
  useCachedAgent,
  useUserProfile,
} from "@/lib/store";
import { cn } from "@/lib/utils";

// Business profile + agent narrative. Editable by CPAs (Pilot
// internal staff who curate this as the books evolve); read-only for
// owners (they see what the agent thinks they are, but Pilot's team
// owns the canonical source).

export function BusinessProfilePanel() {
  const { company } = useActiveCompany();
  const { profile } = useUserProfile();
  const { override, setOverride, reset, hydrated } =
    useBusinessNarrativeOverride(company.id);
  const { cache, clear } = useCachedAgent(company.id);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const canEdit = profile === "cpa";

  // Hydrate the draft from override (or fixture default) when entering edit.
  useEffect(() => {
    if (!editing) {
      setDraft(override ?? company.profile.narrative);
    }
  }, [editing, override, company.profile.narrative]);

  if (!hydrated) {
    return <div className="h-32 animate-pulse rounded-lg bg-zinc-100" />;
  }

  const effectiveNarrative = override ?? company.profile.narrative;
  const isCustom = override !== null && override !== company.profile.narrative;

  const flushAgentCache = () => {
    // Drop every cached agent response so subsequent prefetches use
    // the new narrative.
    Object.keys(cache).forEach((id) => clear(id));
  };

  const handleSave = () => {
    setOverride(draft);
    flushAgentCache();
    setEditing(false);
    setSavedNote(
      "Saved · agent cache cleared, future categorizations will use this narrative",
    );
    setTimeout(() => setSavedNote(null), 6000);
  };

  const handleResetToDefault = () => {
    reset();
    flushAgentCache();
    setEditing(false);
    setSavedNote("Reset to seed narrative · agent cache cleared");
    setTimeout(() => setSavedNote(null), 6000);
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">
            Business profile
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            What the agent sees about{" "}
            <span className="font-medium text-zinc-700">
              {company.profile.name}
            </span>{" "}
            on every call. Edit this when the business changes (entity type,
            production launch, new payroll provider, etc.) — the agent picks
            it up on the next categorization.
          </p>
        </div>
        {canEdit && !editing ? (
          <button
            onClick={() => setEditing(true)}
            className="shrink-0 rounded-md border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 shadow-sm hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
          >
            Edit
          </button>
        ) : !canEdit ? (
          <span
            className="shrink-0 rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600"
            title="Pilot's internal team curates this; ask them if it needs updating."
          >
            Read-only for owners
          </span>
        ) : null}
      </div>

      {/* Quick structured fields — read-only summary */}
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
        <Field label="Entity" value={company.profile.entityType} />
        <Field
          label="W-2 employees"
          value={String(company.profile.employeesW2)}
        />
        <Field
          label="1099 contractors"
          value={String(company.profile.contractors1099)}
        />
        <Field
          label="Inventory?"
          value={company.profile.hasInventory ? "Yes" : "No"}
        />
      </div>

      {/* Narrative */}
      <div className="mt-4">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Narrative {isCustom ? "· edited" : "· seed"}
          </div>
          {canEdit && isCustom && !editing ? (
            <button
              onClick={handleResetToDefault}
              className="text-[11px] text-zinc-500 hover:text-zinc-900 hover:underline"
            >
              Reset to seed
            </button>
          ) : null}
        </div>
        {editing ? (
          <>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={6}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white p-2 text-sm text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={handleSave}
                className="rounded-md bg-violet-700 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-violet-800"
              >
                Save changes
              </button>
              <button
                onClick={() => setEditing(false)}
                className="rounded-md px-2.5 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100"
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <p
            className={cn(
              "mt-1 rounded-md border bg-zinc-50 p-3 text-sm leading-relaxed",
              isCustom
                ? "border-violet-200 bg-violet-50/50 text-violet-950"
                : "border-zinc-200 text-zinc-700",
            )}
          >
            {effectiveNarrative}
          </p>
        )}
      </div>

      {savedNote ? (
        <div className="mt-3 rounded-md bg-emerald-50 px-3 py-1.5 text-xs text-emerald-900 ring-1 ring-inset ring-emerald-200">
          {savedNote}
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className="mt-0.5 truncate text-zinc-900">{value}</div>
    </div>
  );
}
