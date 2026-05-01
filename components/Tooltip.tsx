"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

// Lightweight tooltip — appears immediately on hover/focus (no
// browser-style delay), portaled to body so it can escape card
// overflow-hidden, dark pill styling.

interface Props {
  content: React.ReactNode;
  children: React.ReactNode;
  placement?: "top" | "bottom";
  /** Optional max width override (Tailwind class, e.g. "max-w-xs"). */
  maxWidthClass?: string;
}

export function Tooltip({
  content,
  children,
  placement = "bottom",
  maxWidthClass = "max-w-md",
}: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const wrapperRef = useRef<HTMLSpanElement | null>(null);

  const show = () => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (placement === "top") {
      setPos({
        top: rect.top + window.scrollY - 6,
        left: rect.left + window.scrollX + rect.width / 2,
      });
    } else {
      setPos({
        top: rect.bottom + window.scrollY + 6,
        left: rect.left + window.scrollX + rect.width / 2,
      });
    }
    setOpen(true);
  };
  const hide = () => setOpen(false);

  return (
    <span
      ref={wrapperRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      className="inline-flex"
    >
      {children}
      {open && pos && typeof document !== "undefined"
        ? createPortal(
            <div
              role="tooltip"
              style={{
                position: "absolute",
                top: pos.top,
                left: pos.left,
                transform:
                  placement === "top"
                    ? "translate(-50%, -100%)"
                    : "translate(-50%, 0)",
              }}
              className={cn(
                "pointer-events-none z-50 rounded-md bg-zinc-900 px-2.5 py-1.5 text-xs text-white shadow-lg ring-1 ring-zinc-700",
                maxWidthClass,
              )}
            >
              {content}
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}
