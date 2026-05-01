"use client";

import { useState } from "react";
import { BusinessProfilePanel } from "@/components/BusinessProfilePanel";
import {
  resetCompanyState,
  useActiveCompany,
  useUserProfile,
} from "@/lib/store";

export default function SettingsPage() {
  const { company, hydrated } = useActiveCompany();
  const { profile, hydrated: profileHydrated } = useUserProfile();
  const [resetNote, setResetNote] = useState<string | null>(null);

  if (!hydrated || !profileHydrated) {
    return <div className="h-96 animate-pulse rounded-lg bg-zinc-100" />;
  }

  // The business narrative is an internal artifact — language curated
  // for the agent, not customer-facing copy. Owners don't see it.
  const showBusinessProfile = profile === "cpa";

  const handleReset = () => {
    if (
      !confirm(
        `Reset all demo state for ${company.profile.name}?\n\nClears:\n• Your decisions on inbox transactions\n• Rules you've created\n• Audit log\n• Cached agent responses (next visit will re-fetch)\n• Business narrative override\n• Dismissed corrections\n\nThis only affects ${company.profile.name}. The other company's state stays put.`,
      )
    )
      return;
    resetCompanyState(company.id);
    setResetNote(
      `Cleared all demo state for ${company.profile.name}. Agent cache flushed — next visit to Tasks will re-fetch.`,
    );
    setTimeout(() => setResetNote(null), 8000);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Settings</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Workspace, integrations, team, and the business profile that
          shapes how the agent categorizes for{" "}
          <span className="font-medium text-zinc-900">
            {company.profile.name}
          </span>
          .
        </p>
      </div>

      {showBusinessProfile ? <BusinessProfilePanel /> : null}

      <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm text-zinc-600">
        Workspace settings, integrations, team, and billing live here in
        production. Out of scope for this prototype.
      </div>

      {/* Demo utility — wipes per-company state from localStorage so
          the prototype can be re-walked with a clean slate. */}
      <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">
              Reset demo state{" "}
              <span className="ml-1 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Prototype
              </span>
            </h2>
            <p className="mt-1 text-xs text-zinc-600">
              Wipes everything stored locally for{" "}
              <span className="font-medium text-zinc-900">
                {company.profile.name}
              </span>{" "}
              — decisions, rules, audit log, agent cache, narrative
              override, dismissed corrections. The seed transactions and
              fixtures stay put. Useful when re-walking the demo or
              showing it cold.
            </p>
          </div>
          <button
            onClick={handleReset}
            className="shrink-0 rounded-md border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 shadow-sm hover:border-rose-400 hover:bg-rose-50"
          >
            Reset {company.profile.name}
          </button>
        </div>
        {resetNote ? (
          <div className="mt-3 rounded-md bg-emerald-50 px-3 py-1.5 text-xs text-emerald-900 ring-1 ring-inset ring-emerald-200">
            {resetNote}
          </div>
        ) : null}
      </div>
    </div>
  );
}
