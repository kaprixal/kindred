"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { STATUS_LABEL } from "@/lib/delivery";
import { formatShort } from "@/lib/dates";
import type { Arrival, ArrivalStatus, Money } from "@/lib/types";

export function Icon({ name, size = 22 }: { name: "back" | "calendar" | "x" | "plus" | "upload" | "check" | "clock"; size?: number }) {
  const paths: Record<string, ReactNode> = {
    back: <path d="M15 18l-6-6 6-6" />,
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18" />
      </>
    ),
    x: <path d="M6 6l12 12M18 6L6 18" />,
    plus: <path d="M12 5v14M5 12h14" />,
    upload: <path d="M12 16V4M6 10l6-6 6 6M4 20h16" />,
    check: <path d="M5 12l5 5 9-10" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

export function BackLink({ href, label = "Back" }: { href: string; label?: string }) {
  return (
    <Link href={href} className="back" aria-label={label}>
      <Icon name="back" />
    </Link>
  );
}

export function formatMoney(m?: Money, opts: { showCode?: boolean } = {}): string {
  if (!m) return "";
  const value = m.amount / 100;
  const whole = Number.isInteger(value);
  const s = new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: m.currency,
    currencyDisplay: opts.showCode ? "code" : "narrowSymbol",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
  return s;
}

export function ArrivalBadge({ status, arrival }: { status?: ArrivalStatus; arrival?: Arrival }) {
  const s = status ?? arrival?.status ?? "unknown";
  return (
    <span className={`badge badge-${s}`}>
      {s === "on_time" && <Icon name="check" size={12} />}
      {s === "tight" && <Icon name="clock" size={12} />}
      {STATUS_LABEL[s]}
    </span>
  );
}

export function arrivalLine(a?: Arrival): string {
  if (!a) return "Delivery dates at checkout";
  const b = a.best;
  if (!b) return a.note ?? "No shipping estimate";
  const when = b.latest ? (b.earliest && b.earliest !== b.latest ? `${formatShort(b.earliest)}–${formatShort(b.latest)}` : formatShort(b.latest)) : b.description ?? "";
  const cost = b.cost ? ` · ${b.cost.amount === 0 ? "free" : formatMoney(b.cost)} shipping` : "";
  return `${when ? `Arrives ${when}` : b.title}${cost}`;
}
