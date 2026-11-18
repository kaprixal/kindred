"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useApp, pickKey } from "@/lib/store";
import { parseIcs } from "@/lib/ics";
import { HOLIDAYS } from "@/lib/occasions/holidays";
import { addDays, dayOfMonth, daysBetween, formatShort, monthShort, relativeDays } from "@/lib/dates";
import { slug } from "@/lib/occasions/build";
import { Icon } from "@/components/ui";
import { AppBar } from "@/components/AppBar";
import type { Occasion, Person } from "@/lib/types";

const WINDOW_DAYS = 120;
const OVERSEAS_DAYS = 21;

export default function ComingUp() {
  const { ready, state, occasions, today, update, importCalendar, resetDemo, holidayFeedsLive } = useApp();
  const [showAll, setShowAll] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [adding, setAdding] = useState(false);
  const [importMsg, setImportMsg] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);

  const cutoff = addDays(today, WINDOW_DAYS);
  const rows = occasions.flatMap((o) =>
    o.personIds.length ? o.personIds.map((pid) => ({ o, person: state.people[pid] as Person | undefined })) : [{ o, person: undefined }],
  );
  const visible = showAll ? rows : rows.filter((r) => r.o.date <= cutoff);
  const hidden = rows.length - visible.length;

  function toggleHoliday(id: string) {
    update((s) => ({
      ...s,
      selectedHolidays: s.selectedHolidays.includes(id) ? s.selectedHolidays.filter((h) => h !== id) : [...s.selectedHolidays, id],
    }));
  }

  function link(holidayId: string, personId: string) {
    update((s) => ({ ...s, links: { ...s.links, [holidayId]: [...new Set([...(s.links[holidayId] ?? []), personId])] } }));
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    const events = parseIcs(text);
    const name = text.match(/^X-WR-CALNAME:(.+)$/m)?.[1]?.trim() ?? f.name.replace(/\.ics$/i, "");
    const birthdays = events.filter((ev) => /birthday/i.test(ev.summary)).length;
    importCalendar(name, events, "upload");
    setImportMsg(`Imported ${birthdays} birthday${birthdays === 1 ? "" : "s"} from ${f.name}.`);
    e.target.value = "";
  }

  const visibleHolidays = HOLIDAYS.filter((h) => h.featured || showMore || state.selectedHolidays.includes(h.id));

  const calendarPill = (
    <button type="button" className="pill" onClick={() => fileRef.current?.click()} style={{ cursor: "pointer" }} title="Import a calendar (.ics)">
      <Icon name="calendar" size={14} />
      {state.calendarSource === "upload" ? `From ${state.calendarName ?? "your calendar"}` : "Demo calendar · Import .ics"}
    </button>
  );

  return (
    <>
    <AppBar step={1} />
    <main className="screen" style={{ gap: 20 }}>
      <div className="row mobile-only" style={{ justifyContent: "space-between" }}>
        <div className="display" style={{ fontSize: 22, color: "var(--accent)" }}>Kindred</div>
        {calendarPill}
      </div>
      <input ref={fileRef} type="file" accept=".ics,text/calendar" className="sr-only" onChange={onFile} aria-label="Import a calendar file" />

      <div className="page-head">
        <div className="stack" style={{ gap: 4 }}>
          <h1>Coming up</h1>
          <p className="muted small" style={{ margin: 0, fontSize: 14 }}>
            Birthdays from your calendar, plus the holidays your people actually celebrate.
          </p>
          {importMsg && (
            <p className="small" role="status" style={{ margin: 0, color: "var(--accent-dark)" }}>
              {importMsg}
            </p>
          )}
        </div>
        <div className="desktop-only">{calendarPill}</div>
      </div>

      <div className="cols">
      <div className="occ-grid">
        {!ready &&
          [0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 78 }} />)}
        {ready && visible.length === 0 && (
          <div className="card muted small">Nothing in the next {WINDOW_DAYS} days. Import a calendar or pick a holiday below.</div>
        )}
        {ready &&
          visible.map(({ o, person }) => (
            <OccasionRow
              key={`${o.id}:${person?.id ?? "none"}`}
              o={o}
              person={person}
              today={today}
              people={Object.values(state.people)}
              ideas={person ? state.ideasReady[pickKey(person.id, o.id)] : undefined}
              onLink={(pid) => o.holidayId && link(o.holidayId, pid)}
            />
          ))}
        {ready && (hidden > 0 || showAll) && (
          <button type="button" className="link-btn" onClick={() => setShowAll((v) => !v)} style={{ alignSelf: "flex-start" }}>
            {showAll ? "Show fewer" : `Show ${hidden} later this year`}
          </button>
        )}
      </div>

      <aside className="col aside">
      <Link href="/search" className="card row" style={{ gap: 12, textDecoration: "none", color: "inherit" }}>
        <div className="stack" style={{ gap: 3, flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>Shopping for someone not on your list?</div>
          <div className="small muted">Quick search: say what you&apos;re after and pick the occasion. No profile needed.</div>
        </div>
        <span className="btn-sm" aria-hidden="true">Search</span>
      </Link>

      <section className="panel stack-lg" aria-labelledby="occ-h">
        <div className="stack" style={{ gap: 4 }}>
          <div id="occ-h" style={{ fontWeight: 600, fontSize: 15 }}>Which occasions does your circle celebrate?</div>
          <div className="small" style={{ color: "var(--muted-2)" }}>We add these to your list. We never guess from someone&apos;s name.</div>
        </div>
        <div className="wrap">
          {visibleHolidays.map((h) => (
            <button key={h.id} type="button" className="chip" aria-pressed={state.selectedHolidays.includes(h.id)} onClick={() => toggleHoliday(h.id)}>
              {h.name}
            </button>
          ))}
          {!showMore && (
            <button type="button" className="chip chip-dashed" onClick={() => setShowMore(true)}>
              More…
            </button>
          )}
          <button type="button" className="chip chip-dashed" onClick={() => setAdding((v) => !v)} aria-expanded={adding}>
            + Add your own
          </button>
        </div>
        {adding && <AddHoliday onDone={() => setAdding(false)} />}
        <div className="xsmall" style={{ color: "var(--muted-2)" }}>
          {holidayFeedsLive ? "Dates from Google's public holiday calendars." : "Dates from the built-in holiday table (holiday feeds unreachable)."}
        </div>
      </section>

      <div className="demo-bar row xsmall muted" style={{ justifyContent: "space-between" }}>
        <span>Demo · data stays in this browser</span>
        <button type="button" className="link-btn xsmall" onClick={() => resetDemo()}>
          Reset demo
        </button>
      </div>
      </aside>
      </div>
    </main>
    </>
  );
}

function OccasionRow({
  o,
  person,
  today,
  people,
  ideas,
  onLink,
}: {
  o: Occasion;
  person?: Person;
  today: string;
  people: Person[];
  ideas?: number;
  onLink: (personId: string) => void;
}) {
  const days = daysBetween(today, o.date);
  const title = person ? `${person.name} · ${o.title}` : o.title;
  const profileReady = person && (person.interests.length > 0 || person.photos.length > 0);

  let sub: React.ReactNode;
  let subColor = "var(--muted)";
  if (!person) sub = "Who's it for?";
  else if (o.kind === "holiday" && days > OVERSEAS_DAYS + 3 && profileReady) {
    sub = `Ships from overseas? Order by ${formatShort(addDays(o.date, -OVERSEAS_DAYS))}`;
    subColor = "var(--warn-strong)";
  } else if (ideas) sub = `${relativeDays(today, o.date)} · ${ideas} idea${ideas === 1 ? "" : "s"} ready`;
  else if (profileReady) sub = `${relativeDays(today, o.date)} · Ready to find ideas`;
  else sub = `Tell us a bit about ${person.name} to get ideas`;

  const extra = o.lunar && o.kind === "birthday" ? "Lunar calendar · date moves every year" : o.tentative ? "Date depends on the moon sighting" : undefined;
  const highlight = o.kind === "holiday" && !!profileReady;
  const href = person ? `/people/${person.id}?occasion=${encodeURIComponent(o.id)}` : undefined;

  const body = (
    <>
      <div className="date-block">
        <div className="m">{monthShort(o.date)}</div>
        <div className="d">{dayOfMonth(o.date)}</div>
      </div>
      <div className="stack" style={{ gap: 3, flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 15 }}>{title}</div>
        <div className="small" style={{ color: subColor }}>{sub}</div>
        {extra && <div className="xsmall muted">{extra}</div>}
        {!person && people.length > 0 && (
          <label className="xsmall muted row" style={{ gap: 6 }}>
            <span className="sr-only">Who celebrates {o.title}?</span>
            <select
              className="input"
              style={{ minHeight: 36, padding: "6px 8px", fontSize: 13 }}
              defaultValue=""
              onChange={(e) => e.target.value && onLink(e.target.value)}
            >
              <option value="" disabled>
                Choose someone…
              </option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {person && (
        <span className="btn-sm" aria-hidden="true">
          {o.kind === "holiday" ? "Plan" : "View"}
        </span>
      )}
    </>
  );

  const style: React.CSSProperties = { display: "flex", gap: 14, alignItems: "center", textDecoration: "none", color: "inherit" };
  return href ? (
    <Link href={href} className={`card ${highlight ? "card-accent" : ""}`} style={style} aria-label={`${title}, ${formatShort(o.date)}. ${typeof sub === "string" ? sub : ""}`}>
      {body}
    </Link>
  ) : (
    <div className="card" style={style}>
      {body}
    </div>
  );
}

function AddHoliday({ onDone }: { onDone: () => void }) {
  const { update, today } = useApp();
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim() || !date) return;
        const id = slug(name) || `h${Date.now()}`;
        update((s) => ({
          ...s,
          customHolidays: [...s.customHolidays.filter((c) => c.id !== id), { id, name: name.trim(), date }],
        }));
        onDone();
      }}
    >
      <label className="field">
        Occasion name
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Vaisakhi, Tết, Navroz" />
      </label>
      <label className="field">
        Date
        <input className="input" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <button type="submit" className="btn" style={{ minHeight: 44, padding: 10, fontSize: 14 }}>
        Add occasion
      </button>
    </form>
  );
}
