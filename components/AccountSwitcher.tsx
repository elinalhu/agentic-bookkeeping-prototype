"use client";

import { companies } from "@/lib/fixtures";
import { useActiveCompany } from "@/lib/store";

export function AccountSwitcher() {
  const { companyId, switchCompany, hydrated } = useActiveCompany();

  if (!hydrated) {
    return <div className="h-8 w-56 animate-pulse rounded-md bg-zinc-100" />;
  }

  return (
    <select
      value={companyId}
      onChange={(e) => switchCompany(e.target.value)}
      title="Active business"
      aria-label="Active business"
      className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
    >
      {Object.values(companies).map((c) => {
        const isNew = c.joinedDaysAgo < 60;
        return (
          <option key={c.id} value={c.id}>
            {c.profile.name}
            {isNew ? " · new" : ""}
          </option>
        );
      })}
    </select>
  );
}
