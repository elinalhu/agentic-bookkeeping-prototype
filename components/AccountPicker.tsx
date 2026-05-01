"use client";

import { chartOfAccounts } from "@/lib/fixtures";
import type { AccountId } from "@/lib/types";

interface Props {
  value: AccountId;
  onChange: (id: AccountId) => void;
  label?: string;
}

export function AccountPicker({ value, onChange, label }: Props) {
  return (
    <div className="flex flex-col gap-1">
      {label ? (
        <label className="text-xs font-medium text-zinc-700">{label}</label>
      ) : null}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
      >
        {chartOfAccounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
    </div>
  );
}
