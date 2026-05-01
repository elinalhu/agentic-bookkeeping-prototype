"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import {
  effectiveTransaction,
  useActiveCompany,
  useDecisions,
  useSidebarCollapsed,
  useUserProfile,
} from "@/lib/store";
import { cn } from "@/lib/utils";
import { PilotLogo } from "./PilotLogo";

// Left sidebar nav, modeled on Pilot's actual app:
//   - Top section mirrors their existing nav (Dashboard, Tasks, Books,
//     Cash, Bank Transactions, Tax, Settings) with appropriate stubs.
//   - When the active profile is CPA, a CPA workspace section appears
//     below with a single "CPA review" entry.
//   - Collapsible to an icon rail (matches Pilot's bottom-left toggle).
//   - Footer links match Pilot's (Billing FAQ, Privacy Policy,
//     Customer Terms) — placeholder hrefs.

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  badgeClass?: string;
}

// PILOT_NAV is built dynamically inside Sidebar so the Tasks count
// badge reflects live needs-review state for the active company.

export function Sidebar() {
  const pathname = usePathname();
  const { profile } = useUserProfile();
  const { collapsed, toggle } = useSidebarCollapsed();
  const { company } = useActiveCompany();
  const { decisions } = useDecisions(company.id);

  const tasksCount = useMemo(() => {
    return company.inbox
      .map((t) => effectiveTransaction(t, decisions))
      .filter((t) => t.status === "needs_review").length;
  }, [company, decisions]);

  const pilotNav: NavItem[] = useMemo(
    () => [
      { href: "/", label: "Dashboard", icon: <DashboardIcon /> },
      {
        href: "/tasks",
        label: "Tasks",
        icon: <TasksIcon />,
        badge: tasksCount > 0 ? String(tasksCount) : undefined,
        badgeClass: "bg-violet-100 text-violet-700",
      },
      { href: "/books", label: "Books", icon: <BooksIcon /> },
      { href: "/cash", label: "Cash", icon: <CashIcon /> },
      {
        href: "/bank-transactions",
        label: "Bank Transactions",
        icon: <BankIcon />,
      },
      { href: "/tax", label: "Tax", icon: <TaxIcon /> },
      { href: "/settings", label: "Settings", icon: <SettingsIcon /> },
    ],
    [tasksCount],
  );

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <aside
      className={cn(
        // Pinned to the viewport so it stays in place as the main
        // content scrolls. The inner nav scrolls within this aside if
        // it ever overflows.
        "sticky top-0 flex h-screen shrink-0 flex-col self-start border-r border-zinc-200 bg-white transition-[width] duration-150",
        collapsed ? "w-[64px]" : "w-60",
      )}
    >
      <div
        className={cn(
          "flex items-center py-5",
          collapsed ? "justify-center px-0" : "px-5",
        )}
      >
        <Link href="/" aria-label="Pilot home" className="inline-block">
          <PilotLogo size={collapsed ? 28 : 36} />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        <ul className="space-y-0.5">
          {pilotNav.map((item) => (
            <li key={item.href}>
              <NavLink
                item={item}
                active={isActive(item.href)}
                collapsed={collapsed}
              />
            </li>
          ))}
        </ul>

        {profile === "cpa" ? (
          <div className="mt-6 border-t border-zinc-200 pt-4">
            {!collapsed ? (
              <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                CPA workspace
              </div>
            ) : null}
            <ul className="space-y-0.5">
              <li>
                <NavLink
                  item={{
                    href: "/cpa",
                    label: "CPA review",
                    icon: <ReviewIcon />,
                  }}
                  active={isActive("/cpa")}
                  collapsed={collapsed}
                />
              </li>
            </ul>
          </div>
        ) : null}
      </nav>

      {!collapsed ? (
        <div className="border-t border-zinc-200 px-5 py-3 text-[11px] text-zinc-500">
          <div className="space-y-0.5">
            <div className="hover:text-zinc-700 cursor-default">
              Billing FAQ
            </div>
            <div className="hover:text-zinc-700 cursor-default">
              Privacy Policy
            </div>
            <div className="hover:text-zinc-700 cursor-default">
              Customer Terms
            </div>
          </div>
        </div>
      ) : null}

      {/* Toggle pinned to the bottom edge in both states so its position
          stays put when the footer links hide on collapse. */}
      <div className="border-t border-zinc-200 px-3 py-2">
        <button
          onClick={toggle}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700",
            collapsed ? "justify-center" : "justify-start",
          )}
        >
          <CollapseIcon collapsed={collapsed} />
          {!collapsed ? <span>Collapse</span> : null}
        </button>
      </div>
    </aside>
  );
}

function NavLink({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  const inner = (
    <>
      <span
        className={cn(
          "shrink-0",
          active ? "text-violet-700" : "text-zinc-500",
        )}
      >
        {item.icon}
      </span>
      {!collapsed ? (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge ? (
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                item.badgeClass ?? "bg-zinc-100 text-zinc-600",
              )}
            >
              {item.badge}
            </span>
          ) : null}
        </>
      ) : null}
    </>
  );

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={cn(
        "flex items-center rounded-md text-sm transition-colors",
        collapsed ? "h-9 justify-center" : "gap-2.5 px-3 py-1.5",
        active
          ? "bg-violet-50 font-medium text-violet-700"
          : "text-zinc-700 hover:bg-zinc-50",
      )}
    >
      {inner}
    </Link>
  );
}

// ---- Icons (Lucide-style outline, inlined to avoid an extra dep) ----

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      {children}
    </svg>
  );
}

function DashboardIcon() {
  return (
    <Icon>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </Icon>
  );
}
function TasksIcon() {
  return (
    <Icon>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="m9 11 3 3 8-8" />
    </Icon>
  );
}
function BooksIcon() {
  return (
    <Icon>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </Icon>
  );
}
function CashIcon() {
  return (
    <Icon>
      <line x1="3" y1="20" x2="21" y2="20" />
      <polyline points="5 17 11 11 15 15 21 9" />
    </Icon>
  );
}
function BankIcon() {
  return (
    <Icon>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </Icon>
  );
}
function TaxIcon() {
  return (
    <Icon>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <line x1="8" y1="8" x2="16" y2="8" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <line x1="8" y1="16" x2="12" y2="16" />
    </Icon>
  );
}
function SettingsIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Icon>
  );
}
function ReviewIcon() {
  return (
    <Icon>
      <path d="M21 12c0 4.97-4.03 9-9 9-4.97 0-9-4.03-9-9 0-4.97 4.03-9 9-9 2.39 0 4.68.94 6.36 2.64" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </Icon>
  );
}
function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
      {collapsed ? (
        <polyline points="14 9 17 12 14 15" />
      ) : (
        <polyline points="17 9 14 12 17 15" />
      )}
    </svg>
  );
}
