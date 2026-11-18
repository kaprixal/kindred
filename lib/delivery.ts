// Turns merchant shipping options into an arrival badge: on time / tight / late / unknown.
//
// Merchants mostly describe speed as text ("1 to 3 business days"), not dates, so we:
//   1. use earliest/latest_fulfillment_time when the merchant sends them,
//   2. otherwise parse "N to M (business) days" from the title or description,
//   3. add HANDLING_DAYS business days for the merchant to pack and ship,
//   4. compare against a deadline of the day before the occasion.

import { addBusinessDays, addDays, daysBetween, parseISO, todayISO, toISO } from "./dates";
import type { Arrival, ArrivalStatus, ISODate, Money, ShippingEstimate } from "./types";

export const HANDLING_DAYS = 2;
export const ARRIVE_DAYS_BEFORE = 1;
/** Arriving with less slack than this before the deadline counts as "tight". */
export const TIGHT_SLACK_DAYS = 2;

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export type RawOption = {
  id: string;
  title: string;
  description?: string;
  carrier?: string;
  earliest?: string; // ISO datetime or date from the merchant
  latest?: string;
  cost?: Money;
};

type Range = { earliest: ISODate; latest: ISODate; absolute?: boolean };

/** Parses "1 to 3 business days", "3-5 days", "Arrives in 4 business days", "Arrives Dec 12-15". */
export function parseRange(text: string, shipDate: ISODate): Range | undefined {
  const t = text.toLowerCase().replace(/–|—/g, "-");

  const span = t.match(/(\d{1,2})\s*(?:-|to)\s*(\d{1,2})\s*(business|working)?\s*days?/);
  if (span) {
    const [a, b] = [Number(span[1]), Number(span[2])].sort((x, y) => x - y);
    const add = span[3] ? addBusinessDays : addDays;
    return { earliest: add(shipDate, a), latest: add(shipDate, b) };
  }
  const single = t.match(/(?:in|within)?\s*(\d{1,2})\s*(business|working)?\s*days?/);
  if (single) {
    const n = Number(single[1]);
    const add = single[2] ? addBusinessDays : addDays;
    return { earliest: add(shipDate, Math.max(0, n - 1)), latest: add(shipDate, n) };
  }
  if (/next[- ]day|overnight/.test(t)) {
    const d = addBusinessDays(shipDate, 1);
    return { earliest: d, latest: d };
  }
  // "Arrives Dec 12-15", "Arrives Dec 12", "Wednesday, November 25–Friday, November 27"
  const re = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:\s*-\s*(\d{1,2})\b)?/g;
  const hits = [...t.matchAll(re)];
  if (hits.length) {
    const ship = parseISO(shipDate);
    const mk = (monthName: string, day: number) => {
      const month = MONTHS.indexOf(monthName);
      let year = ship.getUTCFullYear();
      if (month < ship.getUTCMonth() - 1) year += 1; // "Jan 5" seen in December means next year
      return toISO(new Date(Date.UTC(year, month, day)));
    };
    const first = hits[0];
    const last = hits[hits.length - 1];
    const earliest = mk(first[1], Number(first[2]));
    const latest = hits.length > 1 ? mk(last[1], Number(last[3] ?? last[2])) : mk(first[1], Number(first[3] ?? first[2]));
    return { earliest, latest, absolute: true };
  }
  return undefined;
}

export function deadlineFor(occasionDate: ISODate): ISODate {
  return addDays(occasionDate, -ARRIVE_DAYS_BEFORE);
}

function statusFor(range: Range | undefined, deadline: ISODate): ArrivalStatus {
  if (!range) return "unknown";
  if (range.earliest > deadline) return "late";
  if (range.latest > deadline) return "tight";
  if (daysBetween(range.latest, deadline) < TIGHT_SLACK_DAYS) return "tight";
  return "on_time";
}

/**
 * `asOf` simulates ordering on another day (demo control). Relative estimates ("3 to 5 days")
 * are counted from asOf. Absolute dates from the shop were computed from the real today,
 * so they're shifted by the same number of days to stay consistent.
 */
export function estimate(options: RawOption[], occasionDate: ISODate, asOf: ISODate = todayISO(), realToday: ISODate = todayISO()): Arrival {
  const deadline = deadlineFor(occasionDate);
  const shipDate = addBusinessDays(asOf, HANDLING_DAYS);
  const shift = daysBetween(realToday, asOf);
  const shifted = (r: Range): Range => (shift ? { earliest: addDays(r.earliest, shift), latest: addDays(r.latest, shift) } : r);

  const estimates: ShippingEstimate[] = options.map((o) => {
    let range: Range | undefined;
    if (o.earliest || o.latest) {
      const e = (o.earliest ?? o.latest)!.slice(0, 10);
      const l = (o.latest ?? o.earliest)!.slice(0, 10);
      range = shifted({ earliest: e, latest: l });
    } else {
      const text = `${o.description ?? ""} ${o.title}`;
      range = parseRange(text, shipDate);
      if (range?.absolute) range = shifted(parseRange(text, addBusinessDays(realToday, HANDLING_DAYS))!);
    }
    return {
      optionId: o.id,
      title: o.title,
      description: o.description,
      cost: o.cost,
      earliest: range?.earliest,
      latest: range?.latest,
      status: statusFor(range, deadline),
    };
  });

  const cost = (e: ShippingEstimate) => e.cost?.amount ?? Number.MAX_SAFE_INTEGER;
  const byCost = [...estimates].sort((a, b) => cost(a) - cost(b));
  const byLatest = [...estimates].filter((e) => e.latest).sort((a, b) => (a.latest! < b.latest! ? -1 : 1));

  const best =
    byCost.find((e) => e.status === "on_time") ??
    byLatest.find((e) => e.status === "tight") ??
    byLatest[0] ??
    byCost[0];

  const status: ArrivalStatus = best?.status ?? "unknown";
  let note: string | undefined;
  if (options.length === 0) note = "The shop didn't share shipping options for this address.";
  else if (status === "unknown") note = "The shop didn't say how long shipping takes.";

  return { status, best, options: estimates, deadline, note };
}

export const STATUS_LABEL: Record<ArrivalStatus, string> = {
  on_time: "On time",
  tight: "Tight",
  late: "Too late",
  unknown: "No estimate",
};
