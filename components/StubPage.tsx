// Shared empty-page shell for Pilot product surfaces that aren't part
// of the agentic Tasks enhancement. Each one is a thin stub so the
// nav doesn't 404 — and so the prototype reads as "I'm proposing a
// change inside an existing app."

import Link from "next/link";

interface Props {
  title: string;
  blurb: string;
  details?: React.ReactNode;
}

export function StubPage({ title, blurb, details }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">{title}</h1>
        <p className="mt-1 text-sm text-zinc-600">{blurb}</p>
      </div>

      <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-8">
        <div className="text-center">
          <h2 className="text-sm font-semibold text-zinc-900">
            Not part of this prototype
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            Pilot already has this surface today. The agentic enhancement
            this take-home proposes is in the{" "}
            <Link
              href="/tasks"
              className="font-medium text-violet-700 hover:underline"
            >
              Tasks
            </Link>{" "}
            tab.
          </p>
          {details ? (
            <div className="mt-4 text-xs text-zinc-500">{details}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
