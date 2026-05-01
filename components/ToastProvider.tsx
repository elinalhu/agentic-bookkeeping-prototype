"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { cn } from "@/lib/utils";

// Lightweight toast system. Pushes a message + optional Undo button
// to the bottom of the screen for 8 seconds. Used by useAgentResolution
// to make every action reversible at low friction (Gmail-style).

interface ToastItem {
  id: string;
  message: string;
  detail?: string;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
}

interface ToastContextValue {
  push: (toast: Omit<ToastItem, "id">) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION_MS = 8000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (toast: Omit<ToastItem, "id">) => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `t.${Date.now()}.${Math.random()}`;
      setToasts((prev) => [...prev, { ...toast, id }]);
      const ms = toast.durationMs ?? DEFAULT_DURATION_MS;
      setTimeout(() => dismiss(id), ms);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ push, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <div className="pointer-events-auto flex w-full max-w-md flex-col gap-2">
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
        ))}
      </div>
    </div>
  );
}

function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: () => void;
}) {
  const [actioned, setActioned] = useState(false);

  return (
    <div className="flex items-start gap-3 rounded-lg bg-zinc-900 px-4 py-3 text-sm text-white shadow-lg ring-1 ring-zinc-800">
      <div className="mt-0.5 flex-1">
        <div className="font-medium">{toast.message}</div>
        {toast.detail ? (
          <div className="mt-0.5 text-xs text-zinc-400">{toast.detail}</div>
        ) : null}
      </div>
      {toast.actionLabel && toast.onAction ? (
        <button
          onClick={() => {
            if (actioned) return;
            setActioned(true);
            toast.onAction!();
            onDismiss();
          }}
          disabled={actioned}
          className={cn(
            "shrink-0 rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wide transition-colors",
            actioned
              ? "text-zinc-500"
              : "text-violet-300 hover:bg-zinc-800 hover:text-violet-200",
          )}
        >
          {toast.actionLabel}
        </button>
      ) : null}
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded-md px-1 text-zinc-500 hover:text-zinc-300"
      >
        ✕
      </button>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Permissive fallback so components don't crash if rendered outside
    // the provider during SSR — the toast just becomes a no-op.
    return {
      push: () => {},
      dismiss: () => {},
    } satisfies ToastContextValue;
  }
  return ctx;
}

// Module-level singleton so non-React code (or hooks that don't have
// the context) can still push toasts. Mounted by ToastBridge below.
type Pusher = (toast: Omit<ToastItem, "id">) => void;
let externalPush: Pusher | null = null;

export function pushToastExternal(toast: Omit<ToastItem, "id">) {
  externalPush?.(toast);
}

// Tiny bridge component that mirrors the hook's push into the module
// singleton. Mounted inside the provider tree (see app/layout.tsx).
export function ToastBridge() {
  const { push } = useToast();
  useEffect(() => {
    externalPush = push;
    return () => {
      if (externalPush === push) externalPush = null;
    };
  }, [push]);
  return null;
}
