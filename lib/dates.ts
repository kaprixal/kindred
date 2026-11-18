import type { ISODate } from "./types";

// All math is done in UTC on date-only values so time zones never shift a day.

export function parseISO(d: ISODate): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

export function toISO(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

export function todayISO(): ISODate {
  const now = new Date();
  return toISO(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

export function addDays(d: ISODate, n: number): ISODate {
  const x = parseISO(d);
  x.setUTCDate(x.getUTCDate() + n);
  return toISO(x);
}

/** Adds business days (Mon–Fri). Public holidays are ignored — callers add a buffer. */
export function addBusinessDays(d: ISODate, n: number): ISODate {
  const x = parseISO(d);
  let left = n;
  while (left > 0) {
    x.setUTCDate(x.getUTCDate() + 1);
    const wd = x.getUTCDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return toISO(x);
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86_400_000);
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export function monthShort(d: ISODate): string {
  return MONTHS[parseISO(d).getUTCMonth()];
}

export function dayOfMonth(d: ISODate): number {
  return parseISO(d).getUTCDate();
}

export function formatShort(d: ISODate): string {
  const m = MONTHS[parseISO(d).getUTCMonth()];
  return `${m[0]}${m.slice(1).toLowerCase()} ${dayOfMonth(d)}`;
}

export function relativeDays(from: ISODate, to: ISODate): string {
  const n = daysBetween(from, to);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n < 0) return `${-n} days ago`;
  if (n < 14) return `In ${n} days`;
  if (n < 60) return `In ${n} days`;
  return `In ${Math.round(n / 7)} weeks`;
}

/** Next occurrence of a yearly date (month/day of `d`) on or after `from`. */
export function nextYearly(d: ISODate, from: ISODate): ISODate {
  const src = parseISO(d);
  const f = parseISO(from);
  for (let y = f.getUTCFullYear(); y <= f.getUTCFullYear() + 1; y++) {
    const cand = new Date(Date.UTC(y, src.getUTCMonth(), src.getUTCDate()));
    if (cand >= f) return toISO(cand);
  }
  return d;
}
