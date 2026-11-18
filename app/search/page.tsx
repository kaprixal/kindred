"use client";

// Quick search: gift ideas without a saved profile. The buyer says what they're after, picks the
// occasion (so its customs still apply) and where it's going. Under the hood it's the same picks
// pipeline, fed a stand-in person who exists only for this search and is never saved.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/lib/store";
import { customsForOccasion } from "@/lib/hooks";
import { HOLIDAYS } from "@/lib/occasions/holidays";
import { holidayOccasions } from "@/lib/occasions/build";
import { countryName, destinationOk } from "@/lib/countries";
import { addDays, formatShort } from "@/lib/dates";
import { deadlineFor } from "@/lib/delivery";
import { DEMO_CURRENCY } from "@/lib/demo/seed";
import { BackLink } from "@/components/ui";
import { PickCard } from "@/components/PickCard";
import { AppBar } from "@/components/AppBar";
import { DestinationFields } from "@/components/DestinationFields";
import type { CustomRule, Destination, FilteredOut, Occasion, Person, Pick, PicksRequest, PicksResponse } from "@/lib/types";

const BIRTHDAY = "birthday";

type Search = { n: number; person: Person; occasion: Occasion; rules: CustomRule[] };

/** "matcha, Miffy; tea" → ["Matcha", "Miffy", "Tea"], deduped, at most 5 (the pipeline's limit). */
function parseInterests(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/[,;\n]/)) {
    const v = raw.trim();
    if (!v || seen.has(v.toLowerCase())) continue;
    seen.add(v.toLowerCase());
    out.push(v.charAt(0).toUpperCase() + v.slice(1));
  }
  return out.slice(0, 5);
}

export default function QuickSearch() {
  const { ready, state, holidayDates, occasions: myOccasions, today } = useApp();

  // Every holiday Kindred knows (plus the user's own), not just the ones they follow on screen 1.
  const holidayOptions = useMemo(
    () =>
      holidayOccasions(holidayDates, HOLIDAYS.map((h) => h.id), {}, state.customHolidays, today).sort((a, b) =>
        a.date === b.date ? a.title.localeCompare(b.title) : a.date < b.date ? -1 : 1,
      ),
    [holidayDates, state.customHolidays, today],
  );
  const savedPeople = Object.values(state.people);
  const currency = savedPeople[0]?.budget.currency ?? DEMO_CURRENCY;

  const [lookingFor, setLookingFor] = useState("");
  const [relationship, setRelationship] = useState("");
  const [occasionId, setOccasionId] = useState("");
  const [birthdayDate, setBirthdayDate] = useState("");
  const [dest, setDest] = useState<Destination>();
  const [budget, setBudget] = useState({ min: 20, max: 80 });
  const [customsOn, setCustomsOn] = useState<Record<string, boolean>>({});
  const [avoidText, setAvoidText] = useState("");
  const [tried, setTried] = useState(false);

  // Sensible starting points once state loads: the soonest holiday the user follows, and the
  // country their saved people ship to. Both are just defaults the buyer can change.
  const seeded = useRef(false);
  useEffect(() => {
    if (!ready || seeded.current || holidayOptions.length === 0) return;
    seeded.current = true;
    const followed = myOccasions.find((o) => o.kind === "holiday" && holidayOptions.some((h) => h.id === o.id));
    setOccasionId((id) => id || (followed ?? holidayOptions[0]).id);
    const country = savedPeople.find((p) => p.shipTo?.country)?.shipTo?.country;
    if (country) setDest((d) => d ?? { country });
  }, [ready, holidayOptions, myOccasions, savedPeople]);

  const occasion: Occasion | undefined = useMemo(() => {
    if (occasionId === BIRTHDAY) {
      return birthdayDate
        ? { id: `quick:birthday:${birthdayDate}`, kind: "birthday", title: "Birthday", date: birthdayDate, personIds: [], source: "custom" }
        : undefined;
    }
    return holidayOptions.find((o) => o.id === occasionId);
  }, [occasionId, birthdayDate, holidayOptions]);

  const rulesOffered = customsForOccasion(occasion);
  const interests = parseInterests(lookingFor);
  const budgetOk = budget.max > 0 && budget.min <= budget.max;
  const problems = [
    interests.length === 0 && "Say what you're looking for.",
    !occasion && (occasionId === BIRTHDAY ? "Add the birthday's date." : "Pick an occasion."),
    !destinationOk(dest) && "Choose where it's going.",
    !budgetOk && "Check the budget: the top needs to be above the bottom.",
  ].filter(Boolean) as string[];

  const [search, setSearch] = useState<Search>();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (problems.length || !occasion) return;
    setSearch((prev) => ({
      n: (prev?.n ?? 0) + 1,
      person: {
        id: "quick-search",
        name: "someone",
        relationship: relationship.trim() || undefined,
        interests,
        photos: [],
        budget: { ...budget, currency },
        shipTo: dest,
        avoidText: avoidText.trim() || undefined,
      },
      occasion,
      rules: rulesOffered.filter((r) => customsOn[r.id] ?? r.defaultOn),
    }));
  }

  return (
    <>
      <AppBar />
      <main className="screen" style={{ gap: 18 }}>
        <div className="topbar">
          <BackLink href="/" />
          <div className="display mobile-only" style={{ fontSize: 18, color: "var(--accent)" }}>Kindred</div>
        </div>

        <div className="stack" style={{ gap: 4 }}>
          <h1>Quick search</h1>
          <p className="muted small" style={{ margin: 0, fontSize: 14 }}>
            For someone you haven&apos;t set up a profile for. Say what you&apos;re after and pick the occasion; we still check its customs and ship-to.
          </p>
        </div>

        <form className="card search-form" onSubmit={submit} noValidate>
          <label className="field span-2">
            What are you looking for?
            <input
              className="input"
              value={lookingFor}
              onChange={(e) => setLookingFor(e.target.value)}
              placeholder="e.g. matcha, Miffy, mahjong"
              aria-invalid={tried && interests.length === 0}
              aria-describedby="lf-hint"
            />
            <span id="lf-hint" className="xsmall muted">Separate ideas with commas. Up to 5; we search a few kinds of product for each.</span>
          </label>

          <div className="stack">
            <label className="field">
              Occasion
              <select className="input" value={occasionId} onChange={(e) => setOccasionId(e.target.value)} aria-invalid={tried && !occasion}>
                <option value="" disabled>
                  {holidayOptions.length ? "Choose…" : "Loading dates…"}
                </option>
                <option value={BIRTHDAY}>Birthday</option>
                <optgroup label="Holidays">
                  {holidayOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.title} · {formatShort(o.date)}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
            {occasionId === BIRTHDAY && (
              <label className="field">
                Birthday date
                <input className="input" type="date" min={today} max={addDays(today, 366)} value={birthdayDate} onChange={(e) => setBirthdayDate(e.target.value)} aria-invalid={tried && !birthdayDate} />
              </label>
            )}
            {occasion && <span className="xsmall muted">Needs to arrive by {formatShort(deadlineFor(occasion.date))}, the day before.</span>}
          </div>

          <label className="field">
            Who it&apos;s for (optional)
            <input className="input" value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder="e.g. coworker, aunt, neighbour" />
            <span className="xsmall muted">Only used to word the suggestions. Anyone else is &ldquo;they&rdquo;.</span>
          </label>

          <div className="stack span-2" style={{ gap: 6 }}>
            <DestinationFields value={dest} onChange={setDest} />
            <span className="xsmall muted">We only show shops that ship here.</span>
          </div>

          <div className="row span-2" style={{ alignItems: "flex-start" }}>
            <label className="field" style={{ flex: 1 }}>
              Budget from ({currency})
              <input className="input" type="number" min={0} value={budget.min} onChange={(e) => setBudget((b) => ({ ...b, min: Number(e.target.value) }))} />
            </label>
            <label className="field" style={{ flex: 1 }}>
              to
              <input className="input" type="number" min={0} value={budget.max} onChange={(e) => setBudget((b) => ({ ...b, max: Number(e.target.value) }))} aria-invalid={tried && !budgetOk} />
            </label>
          </div>

          <fieldset className="stack-lg span-2" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ fontWeight: 600, fontSize: 15, padding: 0, marginBottom: 4 }}>
              {rulesOffered.length && occasion ? `Gift customs for ${occasion.title}` : "Anything to avoid?"}
            </legend>
            {rulesOffered.length > 0 && <div className="xsmall muted">Keep the ones that apply. We never guess from someone&apos;s name.</div>}
            {rulesOffered.map((r) => (
              <label key={r.id} className="check">
                <input type="checkbox" checked={customsOn[r.id] ?? r.defaultOn} onChange={(e) => setCustomsOn((c) => ({ ...c, [r.id]: e.target.checked }))} />
                <span>
                  {r.label}
                  {r.reason && <span className="why">{r.reason}</span>}
                </span>
              </label>
            ))}
            <label className="field">
              {rulesOffered.length ? "Anything else to avoid?" : "Separate with commas"}
              <input className="input" value={avoidText} onChange={(e) => setAvoidText(e.target.value)} placeholder="e.g. no alcohol, no wool" />
            </label>
          </fieldset>

          <div className="stack span-2">
            {tried && problems.length > 0 && (
              <div className="error" role="alert">
                {problems.join(" ")}
              </div>
            )}
            <button type="submit" className="btn" disabled={!ready}>
              Find gifts
            </button>
          </div>
        </form>

        {/* Keyed per submit, so a new search starts fresh (and drops any "more like this"). */}
        {search && <Results key={search.n} search={search} />}
      </main>
    </>
  );
}

function Results({ search }: { search: Search }) {
  const { person, occasion, rules } = search;
  const [like, setLike] = useState<{ id: string; title: string }>();
  const [items, setItems] = useState<Pick[]>([]);
  const [filteredOut, setFilteredOut] = useState<FilteredOut[]>([]);
  const [searched, setSearched] = useState<string[]>([]);
  const [meta, setMeta] = useState<{ mode?: PicksResponse["mode"]; notice?: string }>({});
  const [cursor, setCursor] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string>();
  const [facetFilter, setFacetFilter] = useState("all");
  const generation = useRef(0);
  const top = useRef<HTMLDivElement>(null);

  const fetchPage = useCallback(
    async (c?: string): Promise<PicksResponse> => {
      const body: PicksRequest = { person, occasion, rules, likeId: like?.id, cursor: c };
      const r = await fetch("/api/picks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error ?? `HTTP ${r.status}`);
      return b as PicksResponse;
    },
    [person, occasion, rules, like],
  );

  const addFiltered = (list: FilteredOut[]) =>
    setFilteredOut((prev) => {
      const seen = new Set(prev.map((f) => f.title));
      return [...prev, ...list.filter((f) => !seen.has(f.title) && (seen.add(f.title), true))];
    });

  useEffect(() => {
    const gen = ++generation.current;
    setLoading(true);
    setError(undefined);
    setItems([]);
    setFilteredOut([]);
    setCursor(undefined);
    setFacetFilter("all");
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    fetchPage()
      .then((b) => {
        if (gen !== generation.current) return;
        setItems(b.picks);
        addFiltered(b.filteredOut);
        setSearched(b.searched);
        setMeta({ mode: b.mode, notice: b.notice });
        setCursor(b.nextCursor);
      })
      .catch((e) => gen === generation.current && setError(e instanceof Error ? e.message : "Something went wrong"))
      .finally(() => gen === generation.current && setLoading(false));
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (!cursor || loading || loadingMore) return;
    const gen = generation.current;
    setLoadingMore(true);
    try {
      const b = await fetchPage(cursor);
      if (gen !== generation.current) return;
      setItems((prev) => {
        const have = new Set(prev.map((p) => p.productId));
        return [...prev, ...b.picks.filter((p) => !have.has(p.productId))];
      });
      addFiltered(b.filteredOut);
      setCursor(b.nextCursor);
      if (b.notice) setMeta((m) => ({ ...m, notice: b.notice }));
    } catch (e) {
      if (gen === generation.current) setError(e instanceof Error ? e.message : "Couldn't load more");
    } finally {
      if (gen === generation.current) setLoadingMore(false);
    }
  }, [cursor, loading, loadingMore, fetchPage]);

  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !cursor) return;
    const io = new IntersectionObserver((entries) => entries[0].isIntersecting && loadMore(), { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [cursor, loadMore]);

  const country = countryName(person.shipTo?.country);
  const facetsPresent = [...new Set(items.map((p) => p.facet?.interest).filter(Boolean) as string[])];
  const visible = items.filter((p) => facetFilter === "all" || p.facet?.interest === facetFilter);
  const occasionLabel = occasion.kind === "birthday" ? "Birthday" : occasion.title;

  return (
    <section className="stack-lg" aria-labelledby="results-h" style={{ scrollMarginTop: 90 }} ref={top}>
      <div className="stack" style={{ gap: 2 }}>
        <h2 id="results-h" className="display" style={{ fontSize: 22, margin: 0 }}>
          {like ? "More like this" : "Ideas"}
        </h2>
        <div className="small muted">
          {like ? (
            <>
              Similar to {like.title} ·{" "}
              <button type="button" className="link-btn" onClick={() => setLike(undefined)}>
                Back to all ideas
              </button>
            </>
          ) : (
            `${occasionLabel} · ${formatShort(occasion.date)} · $${person.budget.min}–${person.budget.max}`
          )}
        </div>
      </div>

      <div className="wrap" style={{ gap: 6 }} aria-label="What we checked">
        {country && <span className="signal">Ships to {country}</span>}
        {rules.some((r) => r.kind === "avoid") || person.avoidText ? <span className="signal">Customs checked</span> : null}
        <span className="signal">Up to ${person.budget.max}</span>
      </div>

      {facetsPresent.length > 1 && (
        <div className="wrap" role="group" aria-label="Filter by what you searched" style={{ gap: 6 }}>
          <button type="button" className="chip" aria-pressed={facetFilter === "all"} onClick={() => setFacetFilter("all")}>
            All
          </button>
          {facetsPresent.map((f) => (
            <button key={f} type="button" className="chip" aria-pressed={facetFilter === f} onClick={() => setFacetFilter(f)}>
              {f}
            </button>
          ))}
        </div>
      )}

      {meta.notice && <div className="warn">{meta.notice}</div>}
      {error && (
        <div className="warn" role="alert">
          Couldn&apos;t load ideas: {error}
        </div>
      )}

      {filteredOut.length > 0 && (
        <details className="warn">
          <summary style={{ fontWeight: 600 }}>
            Left out {filteredOut.length} item{filteredOut.length === 1 ? "" : "s"} for your customs
          </summary>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
            {filteredOut.map((f) => (
              <li key={f.title} style={{ marginBottom: 3 }}>
                {f.title} <strong>({f.reason.toLowerCase()})</strong>
                {f.evidence && f.evidence.toLowerCase() !== f.title.toLowerCase() && <span> · matched &ldquo;{f.evidence}&rdquo;</span>}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="pick-grid" aria-busy={loading || loadingMore}>
        {loading && [0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton pick-skeleton" style={{ minHeight: 150 }} />)}
        {!loading && items.length === 0 && !error && (
          <div className="card small muted" style={{ gridColumn: "1 / -1" }}>
            Nothing passed every check. Try a bigger budget or different search words.
          </div>
        )}
        {!loading &&
          visible.map((p) => (
            <PickCard
              key={p.productId}
              p={p}
              budgetCurrency={person.budget.currency}
              onMoreLike={(x) => setLike({ id: x.productId, title: x.title })}
            />
          ))}
        {loadingMore && [0, 1, 2].map((i) => <div key={`m${i}`} className="skeleton pick-skeleton" style={{ minHeight: 150 }} />)}
      </div>

      <div ref={sentinel} className="stack" style={{ alignItems: "center", gap: 6, padding: "8px 0" }}>
        {!loading && cursor && !loadingMore && (
          <button type="button" className="btn-ghost" onClick={loadMore}>
            Load more ideas
          </button>
        )}
        {!loading && !cursor && items.length > 0 && <span className="xsmall muted">That&apos;s everything we found. {items.length} ideas.</span>}
      </div>

      <div className="demo-bar stack xsmall muted">
        {searched.length > 0 && (
          <details>
            <summary>How we searched</summary>
            <p style={{ margin: "6px 0 0" }}>
              Shopify Catalog searches: {searched.join(" · ")}. Only shops that ship to {country || "the destination"}, up to ${person.budget.max}, in stock; at most 2 per shop per kind
              of gift. There&apos;s no saved address here, so delivery dates are shown at the shop&apos;s own checkout.
            </p>
          </details>
        )}
        <span>
          Needs to arrive by {formatShort(deadlineFor(occasion.date))} (the day before). {meta.mode === "sample" ? "Offline sample data." : "Live Shopify Catalog."} Nothing from this search is
          saved.
        </span>
      </div>
    </section>
  );
}
