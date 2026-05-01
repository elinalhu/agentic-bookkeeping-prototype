"use client";

import { useEffect, useRef, useState } from "react";
import { useUserProfile, type UserProfile } from "@/lib/store";
import { cn } from "@/lib/utils";

// Profile menu — a pill-shaped button (head icon + label) in the
// header that opens a dropdown for switching between Owner and CPA.
// Reads as a real "logged in as" widget. No actual auth.

const PROFILE_META: Record<
  UserProfile,
  { label: string; description: string; bg: string }
> = {
  owner: {
    label: "Owner",
    description: "Run the books day-to-day",
    bg: "bg-zinc-900",
  },
  cpa: {
    label: "CPA",
    description: "Audit at tax time",
    bg: "bg-violet-700",
  },
};

export function UserProfileSwitcher() {
  const { profile, switchProfile, hydrated } = useUserProfile();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // Switching to CPA lands you in their workspace immediately — that's
  // the whole point of the profile, so dropping a click feels off.
  // Switching to Owner: the existing /cpa redirect handles that side.
  const handleSwitch = (next: UserProfile) => {
    switchProfile(next);
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", escHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", escHandler);
    };
  }, [open]);

  if (!hydrated) {
    return <div className="h-8 w-28 animate-pulse rounded-full bg-zinc-100" />;
  }

  const current = PROFILE_META[profile];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title={`Logged in as ${current.label} — click to switch`}
        aria-label={`Logged in as ${current.label}`}
        aria-expanded={open}
        className={cn(
          "flex items-center gap-2 rounded-full border border-zinc-300 bg-white py-0.5 pr-3 pl-0.5 text-sm shadow-sm transition-colors",
          open ? "ring-2 ring-zinc-300" : "hover:bg-zinc-50",
        )}
      >
        <Avatar bg={current.bg} />
        <span className="font-medium text-zinc-900">{current.label}</span>
        <ChevronDown />
      </button>

      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-72 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg">
          <div className="border-b border-zinc-100 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Logged in as
          </div>
          <div className="p-1">
            {(["owner", "cpa"] as UserProfile[]).map((p) => {
              const meta = PROFILE_META[p];
              const active = p === profile;
              return (
                <button
                  key={p}
                  onClick={() => handleSwitch(p)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors",
                    active ? "bg-zinc-50" : "hover:bg-zinc-50",
                  )}
                >
                  <Avatar bg={meta.bg} size="lg" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-zinc-900">
                      {meta.label}
                    </span>
                    <span className="block text-xs text-zinc-500">
                      {meta.description}
                    </span>
                  </span>
                  {active ? (
                    <span
                      className="h-2 w-2 shrink-0 rounded-full bg-emerald-500"
                      aria-label="active"
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className="border-t border-zinc-100 bg-zinc-50 px-3 py-2 text-[11px] leading-snug text-zinc-500">
            In production this would be a real auth flow. Switching here just
            changes who the audit log records as the actor and what nav
            entries show.
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Circular avatar with a head silhouette inside.
function Avatar({
  bg,
  size = "sm",
}: {
  bg: string;
  size?: "sm" | "lg";
}) {
  const dim = size === "lg" ? "h-8 w-8" : "h-7 w-7";
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full text-white",
        bg,
        dim,
      )}
    >
      <UserIcon />
    </span>
  );
}

function UserIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5 text-zinc-400"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
