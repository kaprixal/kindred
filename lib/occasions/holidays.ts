// Holidays Kindred knows about. Dates come from Google's public holiday calendars
// (no API key, no OAuth) and fall back to the demo calendar, then to the table below.

import type { ISODate } from "../types";

export type HolidayDef = {
  id: string;
  name: string;
  /** Google public calendar id, e.g. "en.china#holiday@group.v.calendar.google.com" */
  feed?: string;
  /** Matches the event title in the feed or the demo calendar. */
  match: RegExp;
  tentative?: boolean; // moon-sighting dependent
  lunar?: boolean; // moves every year on the Gregorian calendar
  /** Last-resort dates, used only when the feed and the demo calendar both lack the holiday. */
  builtin: ISODate[];
  customs: string[]; // CustomRule ids offered for this holiday
  /** Shown in the chip row on screen 1 without opening "More". */
  featured?: boolean;
};

const g = (id: string) => `${id}#holiday@group.v.calendar.google.com`;

export const HOLIDAYS: HolidayDef[] = [
  {
    id: "lunar-new-year",
    name: "Lunar New Year",
    feed: g("en.china"),
    match: /^(Chinese New Year|Lunar New Year)/i,
    lunar: true,
    builtin: ["2027-02-06", "2028-01-26"],
    customs: ["no-clocks", "no-fours", "red-gold", "no-white-flowers"],
    featured: true,
  },
  {
    id: "hanukkah",
    name: "Hanukkah",
    feed: g("en.judaism"),
    match: /^(Hanukkah|Chanukah)\s*\(Day 1\)/i,
    lunar: true,
    builtin: ["2026-12-05", "2027-12-25"],
    customs: ["kosher-food"],
    featured: true,
  },
  {
    id: "diwali",
    name: "Diwali",
    feed: g("en.hinduism"),
    match: /^Diwali/i,
    lunar: true,
    builtin: ["2027-10-29"],
    customs: ["no-leather", "no-alcohol"],
    featured: true,
  },
  {
    id: "eid-al-fitr",
    name: "Eid al-Fitr",
    feed: g("en.islamic"),
    match: /^Eid al-Fitr/i,
    tentative: true,
    lunar: true,
    builtin: ["2027-03-10"],
    customs: ["no-alcohol", "no-pork"],
    featured: true,
  },
  {
    id: "nowruz",
    name: "Nowruz",
    match: /^(Nowruz|Norouz|Persian New Year)/i,
    // Falls on the March equinox; 2027's equinox is the evening of Mar 20 (UTC).
    tentative: true,
    builtin: ["2027-03-21"],
    customs: [],
    featured: true,
  },
  {
    id: "christmas",
    name: "Christmas",
    feed: g("en.christian"),
    match: /^Christmas Day/i,
    builtin: ["2026-12-25", "2027-12-25"],
    customs: [],
    featured: true,
  },
  {
    id: "seollal",
    name: "Seollal",
    feed: g("en.south_korea"),
    match: /^(Seollal|Korean New Year)/i,
    lunar: true,
    builtin: ["2027-02-07"],
    customs: ["no-fours", "no-white-flowers"],
  },
  {
    id: "eid-al-adha",
    name: "Eid al-Adha",
    feed: g("en.islamic"),
    match: /^Eid al-Adha/i,
    tentative: true,
    lunar: true,
    builtin: ["2027-05-17"],
    customs: ["no-alcohol", "no-pork"],
  },
  {
    id: "holi",
    name: "Holi",
    feed: g("en.hinduism"),
    match: /^Holi\b/i,
    lunar: true,
    builtin: ["2027-03-22"],
    customs: ["no-leather"],
  },
  {
    id: "mid-autumn",
    name: "Mid-Autumn Festival",
    feed: g("en.china"),
    match: /^Mid-Autumn/i,
    lunar: true,
    builtin: ["2027-09-15"],
    customs: ["no-clocks", "no-fours"],
  },
];

export const HOLIDAY_BY_ID = Object.fromEntries(HOLIDAYS.map((h) => [h.id, h]));

export function feedUrl(feed: string): string {
  return `https://calendar.google.com/calendar/ical/${encodeURIComponent(feed)}/public/basic.ics`;
}

export type HolidayDate = {
  holidayId: string;
  date: ISODate;
  source: "holiday-feed" | "calendar" | "builtin";
};
