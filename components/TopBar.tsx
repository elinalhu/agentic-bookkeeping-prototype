"use client";

import { AccountSwitcher } from "./AccountSwitcher";
import { UserProfileSwitcher } from "./UserProfileSwitcher";

// Thin top bar in the main content area. The Sidebar owns brand + nav,
// so this just hosts the right-aligned controls (active business
// switcher and the profile menu).

export function TopBar() {
  return (
    <div className="flex h-14 items-center justify-end gap-3 border-b border-zinc-200 bg-white px-6">
      <AccountSwitcher />
      <UserProfileSwitcher />
    </div>
  );
}
