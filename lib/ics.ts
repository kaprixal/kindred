// Minimal iCalendar (.ics) reader: enough for all-day birthdays and holiday feeds.
// Handles line folding, escaped text, DATE and DATE-TIME starts, and yearly repeats.

import type { ISODate } from "./types";

export type IcsEvent = {
  uid?: string;
  summary: string;
  description?: string;
  date: ISODate;
  yearly: boolean;
};

function unfold(text: string): string[] {
  return text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
}

function unescape(v: string): string {
  return v.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");
}

function toDate(value: string): ISODate | undefined {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : undefined;
}

export function parseIcs(text: string): IcsEvent[] {
  const events: IcsEvent[] = [];
  let cur: Partial<IcsEvent> & { inEvent?: boolean } = {};
  for (const line of unfold(text)) {
    if (line === "BEGIN:VEVENT") {
      cur = { inEvent: true, yearly: false };
      continue;
    }
    if (line === "END:VEVENT") {
      if (cur.summary && cur.date) {
        events.push({
          uid: cur.uid,
          summary: cur.summary,
          description: cur.description,
          date: cur.date,
          yearly: !!cur.yearly,
        });
      }
      cur = {};
      continue;
    }
    if (!cur.inEvent) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const name = line.slice(0, idx).split(";")[0].toUpperCase();
    const value = line.slice(idx + 1);
    if (name === "SUMMARY") cur.summary = unescape(value).trim();
    else if (name === "DESCRIPTION") cur.description = unescape(value).trim();
    else if (name === "UID") cur.uid = value.trim();
    else if (name === "DTSTART") cur.date = toDate(value);
    else if (name === "RRULE" && /FREQ=YEARLY/i.test(value)) cur.yearly = true;
  }
  return events;
}

/** "Ma's birthday" → "Ma". Returns undefined if the event isn't a birthday. */
export function birthdayName(summary: string): string | undefined {
  const m = summary.match(/^(.+?)['’]s\s+birthday\b/i) ?? summary.match(/^birthday[:\s-]+(.+)$/i);
  return m?.[1].trim();
}

/** "Birthday. Relationship: Friend" → "Friend" */
export function relationshipFrom(description?: string): string | undefined {
  return description?.match(/Relationship:\s*([^\n.]+)/i)?.[1].trim();
}
