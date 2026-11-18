"use client";

import { useEffect, useRef } from "react";
import { ArrivalBadge, arrivalLine, formatMoney } from "@/components/ui";
import type { Arrival, Pick } from "@/lib/types";

/**
 * One gift idea. Used on the person's Picks screen and on Quick search.
 * Without `onChoose` (no saved person to check out for), the card links to the shop's own listing instead.
 */
export function PickCard({
  p,
  arrival,
  estimating = false,
  budgetCurrency,
  onVisible,
  onChoose,
  onMoreLike,
}: {
  p: Pick;
  arrival?: Arrival;
  estimating?: boolean;
  budgetCurrency: string;
  onVisible?: (p: Pick) => void;
  onChoose?: (p: Pick) => void;
  onMoreLike?: (p: Pick) => void;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !onVisible) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onVisible(p);
          io.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [p, onVisible]);

  const late = arrival?.status === "late";
  const shopHref = p.url ?? p.shop.url;
  return (
    <article ref={ref} className="card pick-card" style={late ? { opacity: 0.7 } : undefined}>
      {p.image ? (
        // Shopify CDN image, resized by the CDN; shown only with its listing.
        // eslint-disable-next-line @next/next/no-img-element
        <img className="thumb" src={`${p.image.url}${p.image.url.includes("?") ? "&" : "?"}width=600`} alt={p.image.alt ?? p.title} loading="lazy" />
      ) : (
        <div className="thumb" aria-hidden="true">{p.sample ? "Sample item" : "No photo"}</div>
      )}
      <div className="stack" style={{ gap: 5, flex: 1, minWidth: 0 }}>
        {p.facet && (
          <div className="facet">
            {p.facet.interest}
            {p.facet.label ? ` · ${p.facet.label}` : ""}
          </div>
        )}
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.25 }}>{p.title}</div>
          <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap" }}>{formatMoney(p.price, { showCode: p.price.currency !== budgetCurrency })}</div>
        </div>
        <div className="xsmall muted">
          {p.shop.name}
          {p.rating && p.rating.count > 0 ? ` · ★ ${p.rating.value.toFixed(1)} (${p.rating.count})` : ""}
        </div>
        <div className="xsmall" style={{ lineHeight: 1.35 }}>
          <span style={{ fontWeight: 600, color: "var(--accent)" }}>Why: </span>
          {p.why}
        </div>
        <div className="row xsmall" style={{ gap: 6, flexWrap: "wrap", minHeight: 22 }}>
          {estimating ? (
            <span className="muted">Checking delivery…</span>
          ) : (
            <>
              {arrival && !arrival.needsAddress && <ArrivalBadge arrival={arrival} />}
              <span className="muted">{arrivalLine(arrival)}</span>
            </>
          )}
        </div>
        <div className="row actions" style={{ marginTop: 2 }}>
          {onChoose ? (
            <button type="button" className="btn-sm" onClick={() => onChoose(p)} disabled={p.sample}>
              Choose
            </button>
          ) : p.sample || !shopHref ? (
            <button type="button" className="btn-sm" disabled>
              View at shop
            </button>
          ) : (
            <a className="btn-sm" href={shopHref} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
              View at shop<span className="sr-only"> (opens {p.shop.name} in a new tab)</span>
            </a>
          )}
          {onMoreLike && !p.sample && (
            <button type="button" className="btn-ghost" onClick={() => onMoreLike(p)}>
              More like this
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
