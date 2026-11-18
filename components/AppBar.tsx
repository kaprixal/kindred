"use client";

import Link from "next/link";
import { Fragment } from "react";

const STEPS = ["Coming up", "Who it's for", "Picks", "Send it"];

/**
 * Desktop-only top bar with the four-step flow. Hidden on phones (the screens have their own headers).
 * Quick search sits outside the flow, so it passes no step and the bar marks the Quick search link instead.
 */
export function AppBar({ step }: { step?: 1 | 2 | 3 | 4 }) {
  return (
    <header className="appbar">
      <div className="appbar-inner">
        <Link href="/" className="brand">
          Kindred
        </Link>
        <nav aria-label="Progress" style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          {step && (
            <ol className="steps">
              {STEPS.map((label, i) => {
                const n = i + 1;
                return (
                  <Fragment key={label}>
                    {i > 0 && <span className="sep" aria-hidden="true" />}
                    <li aria-current={n === step ? "step" : undefined} className={n < step ? "done" : undefined}>
                      <span className="n">{n}</span>
                      {label}
                    </li>
                  </Fragment>
                );
              })}
            </ol>
          )}
        </nav>
        <Link href="/search" className="appbar-link" aria-current={step ? undefined : "page"}>
          Quick search
        </Link>
      </div>
    </header>
  );
}
