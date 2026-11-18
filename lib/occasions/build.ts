// Builds the "Coming up" list from calendar birthdays + the holidays the user picked.

import { birthdayName, relationshipFrom, type IcsEvent } from "../ics";
import { nextYearly } from "../dates";
import { HOLIDAY_BY_ID, type HolidayDate } from "./holidays";
import type { ISODate, Occasion, Person } from "../types";

export function slug(name: string): string {
  return name.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-");
}

/** People found in the calendar's birthday events. */
export function peopleFromCalendar(events: IcsEvent[], currency: string): Person[] {
  const out = new Map<string, Person>();
  for (const e of events) {
    const name = birthdayName(e.summary.replace(/\s*\(lunar\)\s*$/i, ""));
    if (!name) continue;
    const id = slug(name);
    if (out.has(id)) continue;
    out.set(id, {
      id,
      name,
      relationship: relationshipFrom(e.description),
      interests: [],
      photos: [],
      budget: { min: 40, max: 80, currency },
    });
  }
  return [...out.values()];
}

export function birthdayOccasions(events: IcsEvent[], today: ISODate): Occasion[] {
  const out: Occasion[] = [];
  for (const e of events) {
    const name = birthdayName(e.summary.replace(/\s*\(lunar\)\s*$/i, ""));
    if (!name) continue;
    const date = e.yearly ? nextYearly(e.date, today) : e.date;
    if (date < today) continue;
    const id = slug(name);
    out.push({
      id: `birthday:${id}:${date}`,
      kind: "birthday",
      title: "Birthday",
      date,
      personIds: [id],
      lunar: /\(lunar\)/i.test(e.summary),
      source: "calendar",
    });
  }
  return out;
}

export function holidayOccasions(
  dates: HolidayDate[],
  selected: string[],
  links: Record<string, string[]>,
  custom: { id: string; name: string; date: ISODate }[],
  today: ISODate,
): Occasion[] {
  const out: Occasion[] = [];
  for (const id of selected) {
    const def = HOLIDAY_BY_ID[id];
    if (!def) continue;
    const next = dates.find((d) => d.holidayId === id && d.date >= today);
    if (!next) continue;
    out.push({
      id: `holiday:${id}:${next.date}`,
      kind: "holiday",
      holidayId: id,
      title: def.name,
      date: next.date,
      personIds: links[id] ?? [],
      lunar: def.lunar,
      tentative: def.tentative,
      source: next.source,
    });
  }
  for (const c of custom) {
    if (c.date < today) continue;
    out.push({
      id: `custom:${c.id}:${c.date}`,
      kind: "holiday",
      holidayId: `custom:${c.id}`,
      title: c.name,
      date: c.date,
      personIds: links[`custom:${c.id}`] ?? [],
      source: "custom",
    });
  }
  return out;
}

export function sortOccasions(list: Occasion[]): Occasion[] {
  return [...list].sort((a, b) => (a.date === b.date ? a.title.localeCompare(b.title) : a.date < b.date ? -1 : 1));
}
