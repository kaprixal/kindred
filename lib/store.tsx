"use client";

// App state lives in the browser (no accounts). Persisted to localStorage when available;
// the app still works if storage is blocked — it just forgets on reload.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { IcsEvent } from "./ics";
import type { HolidayDate } from "./occasions/holidays";
import type { Occasion, Person, Pick } from "./types";
import { birthdayOccasions, holidayOccasions, peopleFromCalendar, sortOccasions } from "./occasions/build";
import { todayISO } from "./dates";
import { DEMO_CURRENCY, DEMO_LINKS, DEMO_PEOPLE, DEMO_SELECTED_HOLIDAYS } from "./demo/seed";

const KEY = "kindred:v1";

export type AppState = {
  calendarName?: string;
  calendarSource: "demo" | "upload";
  events: IcsEvent[];
  people: Record<string, Person>;
  selectedHolidays: string[];
  links: Record<string, string[]>; // holidayId → personIds
  customHolidays: { id: string; name: string; date: string }[];
  customs: Record<string, Record<string, boolean>>; // `${personId}|${holidayId|birthday}` → ruleId → on
  chosen: Record<string, Pick>; // `${personId}|${occasionId}` → pick
  ideasReady: Record<string, number>; // `${personId}|${occasionId}` → count
};

type Ctx = {
  ready: boolean;
  state: AppState;
  holidayDates: HolidayDate[];
  holidayFeedsLive: boolean;
  occasions: Occasion[];
  today: string;
  update: (fn: (s: AppState) => AppState) => void;
  updatePerson: (id: string, patch: Partial<Person>) => void;
  importCalendar: (name: string | undefined, events: IcsEvent[], source: "demo" | "upload") => void;
  resetDemo: () => Promise<void>;
};

const AppContext = createContext<Ctx | null>(null);

function load(): AppState | undefined {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AppState) : undefined;
  } catch {
    return undefined;
  }
}

function save(s: AppState) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Storage full or blocked: photos are the usual culprit. Retry without them.
    try {
      const slim = { ...s, people: Object.fromEntries(Object.entries(s.people).map(([k, p]) => [k, { ...p, photos: [] }])) };
      window.localStorage.setItem(KEY, JSON.stringify(slim));
    } catch {
      /* give up quietly */
    }
  }
}

function mergePeople(existing: Record<string, Person>, found: Person[], withDemo: boolean): Record<string, Person> {
  const out: Record<string, Person> = { ...existing };
  for (const p of found) {
    const demo = withDemo ? DEMO_PEOPLE[p.id] : undefined;
    out[p.id] = { ...p, ...demo, ...existing[p.id], relationship: existing[p.id]?.relationship ?? demo?.relationship ?? p.relationship };
  }
  return out;
}

async function demoState(): Promise<AppState> {
  let events: IcsEvent[] = [];
  let name: string | undefined;
  try {
    const res = await fetch("/api/calendar");
    const body = await res.json();
    events = body.events ?? [];
    name = body.name;
  } catch {
    /* empty calendar */
  }
  return {
    calendarName: name,
    calendarSource: "demo",
    events,
    people: mergePeople({}, peopleFromCalendar(events, DEMO_CURRENCY), true),
    selectedHolidays: DEMO_SELECTED_HOLIDAYS,
    links: DEMO_LINKS,
    customHolidays: [],
    customs: {},
    chosen: {},
    ideasReady: {},
  };
}

const EMPTY: AppState = {
  calendarSource: "demo",
  events: [],
  people: {},
  selectedHolidays: [],
  links: {},
  customHolidays: [],
  customs: {},
  chosen: {},
  ideasReady: {},
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(EMPTY);
  const [ready, setReady] = useState(false);
  const [holidayDates, setHolidayDates] = useState<HolidayDate[]>([]);
  const [holidayFeedsLive, setFeedsLive] = useState(false);
  const today = useMemo(() => {
    // Demo control: ?today=YYYY-MM-DD shifts "today" across the app.
    if (typeof window !== "undefined") {
      const q = new URLSearchParams(window.location.search).get("today");
      if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) return q;
    }
    return todayISO();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = load();
      const s = saved ?? (await demoState());
      if (!cancelled) {
        setState(s);
        setReady(true);
      }
    })();
    fetch("/api/holidays")
      .then((r) => r.json())
      .then((b) => {
        if (cancelled) return;
        setHolidayDates(b.dates ?? []);
        setFeedsLive((b.liveFeeds ?? 0) > 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (ready) save(state);
  }, [state, ready]);

  const update = useCallback((fn: (s: AppState) => AppState) => setState((s) => fn(s)), []);

  const updatePerson = useCallback(
    (id: string, patch: Partial<Person>) =>
      setState((s) => ({ ...s, people: { ...s.people, [id]: { ...s.people[id], ...patch } } })),
    [],
  );

  const importCalendar = useCallback((name: string | undefined, events: IcsEvent[], source: "demo" | "upload") => {
    setState((s) => {
      const currency = Object.values(s.people)[0]?.budget.currency ?? DEMO_CURRENCY;
      return {
        ...s,
        calendarName: name,
        calendarSource: source,
        events,
        people: mergePeople(s.people, peopleFromCalendar(events, currency), source === "demo"),
      };
    });
  }, []);

  const resetDemo = useCallback(async () => {
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    setState(await demoState());
  }, []);

  const occasions = useMemo(
    () =>
      sortOccasions([
        ...birthdayOccasions(state.events, today),
        ...holidayOccasions(holidayDates, state.selectedHolidays, state.links, state.customHolidays, today),
      ]),
    [state.events, state.selectedHolidays, state.links, state.customHolidays, holidayDates, today],
  );

  const value: Ctx = { ready, state, holidayDates, holidayFeedsLive, occasions, today, update, updatePerson, importCalendar, resetDemo };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): Ctx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}

export function customsKey(personId: string, occasion: Occasion): string {
  return `${personId}|${occasion.kind === "birthday" ? "birthday" : occasion.holidayId}`;
}

export function pickKey(personId: string, occasionId: string): string {
  return `${personId}|${occasionId}`;
}
