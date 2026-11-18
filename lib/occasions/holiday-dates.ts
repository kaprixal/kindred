// Resolves holiday dates: Google public holiday feeds → demo calendar → built-in table.

import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { cached, TTL } from "../cache";
import { parseIcs, type IcsEvent } from "../ics";
import { addDays, todayISO } from "../dates";
import { HOLIDAYS, feedUrl, type HolidayDate } from "./holidays";

export async function readDemoCalendar(): Promise<{ name?: string; events: IcsEvent[] }> {
  const text = await readFile(path.join(process.cwd(), "fixtures", "calendar.ics"), "utf8");
  const name = text.match(/^X-WR-CALNAME:(.+)$/m)?.[1]?.trim();
  return { name, events: parseIcs(text) };
}

async function fetchFeed(feed: string): Promise<IcsEvent[]> {
  return cached(`feed:${feed}`, TTL.holidays, async () => {
    const res = await fetch(feedUrl(feed), { cache: "no-store", signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(`feed ${res.status}`);
    return parseIcs(await res.text());
  });
}

export async function holidayDates(from = todayISO()): Promise<{ dates: HolidayDate[]; live: string[]; failed: string[] }> {
  const to = addDays(from, 400);
  const feeds = [...new Set(HOLIDAYS.map((h) => h.feed).filter(Boolean) as string[])];
  const live: string[] = [];
  const failed: string[] = [];
  const feedEvents = new Map<string, IcsEvent[]>();
  await Promise.all(
    feeds.map(async (f) => {
      try {
        feedEvents.set(f, await fetchFeed(f));
        live.push(f);
      } catch {
        failed.push(f);
      }
    }),
  );

  let demo: IcsEvent[] = [];
  try {
    demo = (await readDemoCalendar()).events;
  } catch {
    /* no demo calendar */
  }

  const inWindow = (d: string) => d >= from && d <= to;
  const dates: HolidayDate[] = [];
  for (const h of HOLIDAYS) {
    const fromFeed = (h.feed ? feedEvents.get(h.feed) ?? [] : []).filter((e) => h.match.test(e.summary) && inWindow(e.date));
    if (fromFeed.length) {
      for (const e of fromFeed) dates.push({ holidayId: h.id, date: e.date, source: "holiday-feed" });
      continue;
    }
    const fromDemo = demo.filter((e) => h.match.test(e.summary) && inWindow(e.date));
    if (fromDemo.length) {
      for (const e of fromDemo) dates.push({ holidayId: h.id, date: e.date, source: "calendar" });
      continue;
    }
    for (const d of h.builtin.filter(inWindow)) dates.push({ holidayId: h.id, date: d, source: "builtin" });
  }
  // One entry per holiday per date.
  const seen = new Set<string>();
  return {
    dates: dates
      .filter((d) => (seen.has(d.holidayId + d.date) ? false : (seen.add(d.holidayId + d.date), true)))
      .sort((a, b) => (a.date < b.date ? -1 : 1)),
    live,
    failed,
  };
}
