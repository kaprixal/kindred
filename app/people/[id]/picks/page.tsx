"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp, customsKey, pickKey } from "@/lib/store";
import { customsForOccasion, usePersonOccasion } from "@/lib/hooks";
import { countryName, destinationOf, fullAddress } from "@/lib/countries";
import { dataUrlParts } from "@/lib/photos";
import { formatShort } from "@/lib/dates";
import { deadlineFor } from "@/lib/delivery";
import { BackLink } from "@/components/ui";
import { PickCard } from "@/components/PickCard";
import { AppBar } from "@/components/AppBar";
import type { Arrival, FilteredOut, Pick, PicksResponse } from "@/lib/types";

export default function Page() {
  return (
    <Suspense>
      <Picks />
    </Suspense>
  );
}

const ESTIMATE_CONCURRENCY = 2;

function Picks() {
  const { ready, state, update, today } = useApp();
  const { person, occasion } = usePersonOccasion();
  const search = useSearchParams();
  const router = useRouter();
  const likeId = search.get("like") ?? undefined;
  const likeTitle = search.get("likeTitle") ?? undefined;
  const [asOf, setAsOf] = useState<string>(search.get("asOf") ?? "");

  const [items, setItems] = useState<Pick[]>([]);
  const [filteredOut, setFilteredOut] = useState<FilteredOut[]>([]);
  const [searched, setSearched] = useState<string[]>([]);
  const [meta, setMeta] = useState<{ mode?: PicksResponse["mode"]; notice?: string }>({});
  const [cursor, setCursor] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string>();
  const [facetFilter, setFacetFilter] = useState<string>("all");
  const [hideLate, setHideLate] = useState(false);
  const [arrivals, setArrivals] = useState<Record<string, Arrival | "loading">>({});

  const rules = useMemo(() => {
    if (!person || !occasion) return [];
    const saved = state.customs[customsKey(person.id, occasion)] ?? {};
    return customsForOccasion(occasion).filter((r) => saved[r.id] ?? r.defaultOn);
  }, [person, occasion, state.customs]);

  const effectiveAsOf = asOf || (today !== new Date().toISOString().slice(0, 10) ? today : undefined);
  const requestKey = person && occasion ? JSON.stringify([person, occasion.id, rules.map((r) => r.id), likeId]) : "";
  const generation = useRef(0);

  const baseBody = useCallback(
    () =>
      person && occasion
        ? {
            person: { ...person, photos: [] },
            occasion,
            rules,
            likeId,
            asOf: effectiveAsOf,
            photoSearch: likeId ? [] : person.photos.map((ph) => ({ caption: ph.caption, ...dataUrlParts(ph.dataUrl) })),
          }
        : undefined,
    [person, occasion, rules, likeId, effectiveAsOf],
  );

  async function fetchPage(c?: string): Promise<PicksResponse> {
    const r = await fetch("/api/picks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...baseBody(), cursor: c }) });
    const b = await r.json();
    if (!r.ok) throw new Error(b.error ?? `HTTP ${r.status}`);
    return b as PicksResponse;
  }

  function addFiltered(list: FilteredOut[]) {
    setFilteredOut((prev) => {
      const seen = new Set(prev.map((f) => f.title));
      return [...prev, ...list.filter((f) => !seen.has(f.title) && (seen.add(f.title), true))];
    });
  }

  // First page (and a full reset whenever the profile, customs or "more like this" changes).
  useEffect(() => {
    if (!ready || !person || !occasion) return;
    const gen = ++generation.current;
    setLoading(true);
    setError(undefined);
    setItems([]);
    setFilteredOut([]);
    setArrivals({});
    setCursor(undefined);
    setFacetFilter("all");
    queue.current = [];
    fetchPage()
      .then((b) => {
        if (gen !== generation.current) return;
        setItems(b.picks);
        addFiltered(b.filteredOut);
        setSearched(b.searched);
        setMeta({ mode: b.mode, notice: b.notice });
        setCursor(b.nextCursor);
        if (!likeId) update((s) => ({ ...s, ideasReady: { ...s.ideasReady, [pickKey(person.id, occasion.id)]: b.picks.length } }));
      })
      .catch((e) => gen === generation.current && setError(e instanceof Error ? e.message : "Something went wrong"))
      .finally(() => gen === generation.current && setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, requestKey]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore || loading) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, loadingMore, loading]);

  // Endless scroll: a sentinel below the grid loads the next page as it nears the viewport.
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !cursor) return;
    const io = new IntersectionObserver((entries) => entries[0].isIntersecting && loadMore(), { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [cursor, loadMore]);

  // Delivery estimates: one create_checkout per pick, so only for cards the person actually sees.
  const hasAddress = !!(person && fullAddress(person));
  const queue = useRef<Pick[]>([]);
  const active = useRef(0);
  const asked = useRef(new Set<string>());
  useEffect(() => {
    asked.current = new Set();
    queue.current = [];
    setArrivals({});
  }, [effectiveAsOf, requestKey]);

  const pump = useCallback(() => {
    while (active.current < ESTIMATE_CONCURRENCY && queue.current.length) {
      const p = queue.current.shift()!;
      const gen = generation.current;
      const asOfAtRequest = effectiveAsOf;
      active.current++;
      fetch("/api/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person: { ...person, photos: [] }, occasion, variantId: p.variantId, shopDomain: p.shop.domain, asOf: asOfAtRequest }),
      })
        .then((r) => r.json())
        .then((b) => gen === generation.current && setArrivals((a) => ({ ...a, [p.variantId]: b.arrival })))
        .catch(() => {})
        .finally(() => {
          active.current--;
          pump();
        });
    }
  }, [person, occasion, effectiveAsOf]);

  const wantEstimate = useCallback(
    (p: Pick) => {
      if (!hasAddress || p.sample || asked.current.has(p.variantId)) return;
      asked.current.add(p.variantId);
      setArrivals((a) => ({ ...a, [p.variantId]: "loading" }));
      queue.current.push(p);
      pump();
    },
    [hasAddress, pump],
  );

  if (!ready) return <main className="screen"><div className="skeleton" style={{ height: 300 }} /></main>;
  if (!person || !occasion) {
    return (
      <main className="screen">
        <BackLink href="/" />
        <p>
          Pick an occasion first. <Link href="/">Back to Coming up</Link>
        </p>
      </main>
    );
  }

  const profileHref = `/people/${person.id}?occasion=${encodeURIComponent(occasion.id)}`;
  const budget = `$${person.budget.min}–${person.budget.max}`;
  const country = countryName(destinationOf(person)?.country);
  const facetsPresent = [...new Set(items.map((p) => p.facet?.interest).filter(Boolean) as string[])];
  const arrivalOf = (p: Pick): Arrival | undefined => {
    const a = arrivals[p.variantId];
    return a && a !== "loading" ? a : p.arrival;
  };
  const visible = items.filter(
    (p) => (facetFilter === "all" || p.facet?.interest === facetFilter) && !(hideLate && arrivalOf(p)?.status === "late"),
  );
  const lateCount = items.filter((p) => arrivalOf(p)?.status === "late").length;

  function choose(p: Pick) {
    const withArrival = { ...p, arrival: arrivalOf(p) };
    update((s) => ({ ...s, chosen: { ...s.chosen, [pickKey(person!.id, occasion!.id)]: withArrival } }));
    const q = new URLSearchParams({ occasion: occasion!.id });
    if (asOf) q.set("asOf", asOf);
    router.push(`/checkout/${person!.id}?${q}`);
  }

  function moreLike(p: Pick) {
    const q = new URLSearchParams({ occasion: occasion!.id, like: p.productId, likeTitle: p.title });
    if (asOf) q.set("asOf", asOf);
    router.push(`/people/${person!.id}/picks?${q}`);
  }

  return (
    <>
      <AppBar step={3} />
      <main className="screen" style={{ gap: 14 }}>
        <div className="topbar">
          <BackLink href={likeId ? `/people/${person.id}/picks?occasion=${encodeURIComponent(occasion.id)}` : profileHref} />
          <div className="stack" style={{ gap: 0 }}>
            <div className="display" style={{ fontSize: 22 }}>{likeId ? "More like this" : `For ${person.name}`}</div>
            <div className="small muted">
              {likeId && likeTitle ? `Similar to ${likeTitle}` : `${occasion.kind === "birthday" ? "Birthday" : occasion.title} · ${budget}`}
            </div>
          </div>
        </div>

        <div className="wrap" style={{ gap: 6 }} aria-label="What we checked">
          {person.photos.length > 0 && !likeId && <span className="signal">Looks like {person.name}&apos;s photos</span>}
          {country && <span className="signal">Ships to {country}</span>}
          {rules.some((r) => r.kind === "avoid") || person.avoidText ? <span className="signal">Customs checked</span> : null}
          <span className="signal">Up to ${person.budget.max}</span>
        </div>

        {facetsPresent.length > 1 && (
          <div className="toolbar">
            <div className="wrap" role="group" aria-label="Filter by interest" style={{ gap: 6 }}>
              <button type="button" className="chip" aria-pressed={facetFilter === "all"} onClick={() => setFacetFilter("all")}>
                All
              </button>
              {facetsPresent.map((f) => (
                <button key={f} type="button" className="chip" aria-pressed={facetFilter === f} onClick={() => setFacetFilter(f)}>
                  {f}
                </button>
              ))}
            </div>
            {hasAddress && lateCount > 0 && (
              <label className="check small" style={{ alignItems: "center" }}>
                <input type="checkbox" checked={hideLate} onChange={(e) => setHideLate(e.target.checked)} />
                Hide {lateCount} that won&apos;t arrive in time
              </label>
            )}
          </div>
        )}

        {meta.notice && <div className="warn">{meta.notice}</div>}
        {error && (
          <div className="warn" role="alert">
            Couldn&apos;t load picks: {error}
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
              Nothing passed every check. Try a bigger budget or another interest on <Link href={profileHref}>{person.name}&apos;s profile</Link>.
            </div>
          )}
          {!loading &&
            visible.map((p) => (
              <PickCard
                key={p.productId}
                p={p}
                arrival={arrivalOf(p)}
                estimating={arrivals[p.variantId] === "loading"}
                budgetCurrency={person.budget.currency}
                onVisible={wantEstimate}
                onChoose={choose}
                onMoreLike={moreLike}
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
                Shopify Catalog searches: {searched.join(" · ")}. Only shops that ship to {country || "the destination"}, up to ${person.budget.max}, in stock; at most 2 per shop per kind of gift.{" "}
                {hasAddress
                  ? "Delivery estimates come from each shop's checkout as cards appear, plus 2 business days to pack."
                  : "Add a street address on the profile to see delivery dates here; otherwise they're checked at checkout."}
              </p>
            </details>
          )}
          <label className="row" style={{ gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
            <span>
              Demo · check arrival as if ordering on <span className="sr-only">(needs to arrive by {formatShort(deadlineFor(occasion.date))})</span>
            </span>
            <input type="date" className="input" style={{ width: 160, minHeight: 36, fontSize: 13 }} value={asOf} max={occasion.date} onChange={(e) => setAsOf(e.target.value)} />
          </label>
          <span>
            Needs to arrive by {formatShort(deadlineFor(occasion.date))} (the day before). {meta.mode === "sample" ? "Offline sample data." : "Live Shopify Catalog."}
          </span>
        </div>
      </main>
    </>
  );
}
