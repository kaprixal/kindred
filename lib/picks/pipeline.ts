// Picks pipeline, one page at a time:
//   facets (several product kinds per interest, plus photos) → one catalog search each
//   → customs filter → dedupe → rank within facet → interleave facets for variety.
// Delivery estimates are separate (estimateArrival) and run per card as it scrolls into
// view, because each one is a create_checkout call at the shop.

import "server-only";
import { searchCatalog, type CatalogProduct, type SearchPage } from "../shopify/catalog";
import { createCheckout } from "../shopify/checkout";
import { ShopifyError, hasCredentials } from "../shopify/mcp";
import { cached, TTL } from "../cache";
import { deadlineFor, estimate } from "../delivery";
import { todayISO } from "../dates";
import { SAMPLE_PRODUCTS } from "../demo/sample-products";
import { destinationOf, fullAddress } from "../countries";
import { activeRules, applyRules, PREFER_COLOURS } from "./filter";
import { facetsFor, photoQuery } from "./queries";
import { photoLead, pronounFor, whyThisFits } from "./explain";
import type { Arrival, FilteredOut, Occasion, Person, Pick, PicksRequest, PicksResponse } from "../types";

/** Raw results we aim for per page, spread across facets. */
const TARGET_PER_PAGE = 30;
/** At most this many products from one shop per facet per page, so one store can't flood a row. */
const MAX_PER_SHOP = 2;

type Job = {
  key: string;
  interest: string;
  label?: string;
  lead: string;
  run: (cursor?: string) => Promise<SearchPage>;
};

type CursorState = { r: number; c: Record<string, string | null>; s: string[] };

function decodeCursor(raw?: string): CursorState | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  } catch {
    return undefined;
  }
}
function encodeCursor(c: CursorState): string {
  return Buffer.from(JSON.stringify(c)).toString("base64url");
}

function buildJobs(req: PicksRequest): Job[] {
  const { person } = req;
  const dest = destinationOf(person);
  const pronoun = pronounFor(person.relationship);
  const base = {
    country: dest?.country ?? "CA",
    region: dest?.region,
    postalCode: fullAddress(person)?.postalCode,
    currency: person.budget.currency,
    // The budget's top is a hard limit; the bottom is only a preference (see score), so
    // small things like keychains and whisks still show up.
    priceMax: person.budget.max,
    intent: `${req.occasion.title} gift for ${person.relationship ?? person.name}`,
  };

  if (req.likeId) {
    return [{ key: "like", interest: "Similar", lead: "Similar to one you liked", run: (cursor) => searchCatalog({ ...base, likeId: req.likeId, cursor, limit: 12 }) }];
  }

  const facets = facetsFor(person.interests);
  const photos = (req.photoSearch ?? []).slice(0, 3);
  const count = facets.length + photos.length || 1;
  const limit = Math.min(8, Math.max(3, Math.ceil(TARGET_PER_PAGE / count)));

  const jobs: Job[] = facets.map((f) => ({
    key: f.key,
    interest: f.interest,
    label: f.label,
    lead: f.why(pronoun),
    run: (cursor) => searchCatalog({ ...base, query: f.query, cursor, limit }),
  }));
  photos.forEach((p, i) => {
    const q = photoQuery(p.caption);
    jobs.push({
      key: `photo:${i}`,
      interest: "Photos",
      label: p.caption,
      lead: photoLead(p.caption),
      // Image searches aren't cursor-cached, so later pages re-run them with the cursor.
      run: (cursor) => searchCatalog({ ...base, query: q || undefined, likeImage: { contentType: p.contentType, data: p.data }, cursor, limit }),
    });
  });
  return jobs;
}

function score(p: CatalogProduct, order: number, person: Person, prefersRed: boolean): number {
  const r = p.rating;
  let s = 10 - order; // catalog relevance within the facet
  if (r && r.count >= 3) s += (r.value - 4) * 3;
  if (prefersRed && PREFER_COLOURS.test(p.title)) s += 2;
  if (!p.image) s -= 5;
  const v = p.variants[0]?.price;
  if (v && v.currency === person.budget.currency && v.amount < person.budget.min * 100) s -= 1.5;
  return s;
}

function normTitle(t: string) {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export async function buildPicks(req: PicksRequest): Promise<PicksResponse> {
  if (!hasCredentials()) return samplePicks(req, "Shopify keys aren't set, so these are offline samples.");

  const state: CursorState = decodeCursor(req.cursor) ?? { r: 0, c: {}, s: [] };
  const jobs = buildJobs(req).filter((j) => state.r === 0 || (j.key in state.c && state.c[j.key] !== null));
  if (jobs.length === 0) return { picks: [], filteredOut: [], searched: [], mode: "live" };

  const results = await Promise.allSettled(jobs.map((j) => j.run(state.c[j.key] ?? undefined)));
  if (results.every((r) => r.status === "rejected")) {
    const e = (results[0] as PromiseRejectedResult).reason;
    if (state.r > 0) return { picks: [], filteredOut: [], searched: [], mode: "live", notice: "Couldn't load more right now. Try again in a moment." };
    const why = e instanceof ShopifyError ? e.message : "the catalog didn't respond";
    return samplePicks(req, `Live catalog unavailable (${why}). Showing offline samples.`);
  }

  const rules = activeRules(req.rules, req.person.avoidText);
  const prefersRed = req.rules.some((r) => r.id === "red-gold");
  const seen = new Set(state.s);
  const filteredOut: FilteredOut[] = [];
  const nextCursors: Record<string, string | null> = { ...state.c };
  const perFacet: { job: Job; picks: { pick: Pick; score: number }[] }[] = [];

  results.forEach((res, i) => {
    const job = jobs[i];
    if (res.status === "rejected") {
      nextCursors[job.key] = state.c[job.key] ?? null; // retry next time
      return;
    }
    nextCursors[job.key] = res.value.nextCursor ?? null;
    const shopCount = new Map<string, number>();
    const kept: { pick: Pick; score: number }[] = [];
    res.value.products.forEach((p, order) => {
      const titleKey = normTitle(p.title);
      if (seen.has(p.id) || seen.has(titleKey)) return;
      seen.add(p.id);
      seen.add(titleKey);

      const verdict = applyRules(
        {
          title: p.title,
          description: [p.description, ...p.features].join(" "),
          optionsText: p.optionsText,
          variants: p.variants.map((v) => ({ id: v.id, text: `${v.title} ${v.optionText}` })),
        },
        rules,
      );
      if (!verdict.ok) {
        filteredOut.push({ title: p.title, shop: p.variants[0]?.seller.name, ruleId: verdict.ruleId, reason: verdict.label, evidence: verdict.evidence });
        return;
      }
      const v = p.variants.find((x) => verdict.variantIds.includes(x.id) && x.available) ?? p.variants[0];
      if (!v) return;
      const shopKey = v.seller.domain || v.seller.name;
      const n = shopCount.get(shopKey) ?? 0;
      if (n >= MAX_PER_SHOP) return;
      shopCount.set(shopKey, n + 1);

      const colour = prefersRed ? p.title.match(PREFER_COLOURS)?.[0]?.toLowerCase() : undefined;
      const rating = v.rating ?? p.rating;
      kept.push({
        score: score(p, order, req.person, prefersRed),
        pick: {
          productId: p.id,
          variantId: v.id,
          title: p.title,
          shop: v.seller,
          price: v.price ?? { amount: 0, currency: req.person.budget.currency },
          image: v.image ?? p.image,
          rating,
          url: v.url,
          checkoutUrl: v.checkoutUrl,
          matched: [job.interest],
          facet: { interest: job.interest, label: job.label },
          why: whyThisFits({ lead: job.lead, luckyColour: colour === "golden" ? "gold" : colour, holidayId: req.occasion.holidayId, rating }),
        },
      });
    });
    kept.sort((a, b) => b.score - a.score);
    perFacet.push({ job, picks: kept });
  });

  // Interleave: whisk, keychain, bowl set, t-shirt, matcha, plush, whisk… so variety shows first.
  const picks: Pick[] = [];
  for (let i = 0; perFacet.some((f) => f.picks[i]); i++) {
    for (const f of perFacet) if (f.picks[i]) picks.push(f.picks[i].pick);
  }

  const more = Object.values(nextCursors).some((c) => c !== null);
  return {
    picks,
    filteredOut,
    searched: state.r === 0 ? jobs.map((j) => (j.label ? `${j.interest}: ${j.label}` : j.interest)) : [],
    mode: "live",
    nextCursor: more ? encodeCursor({ r: state.r + 1, c: nextCursors, s: [...seen].slice(-600) }) : undefined,
  };
}

/** Delivery estimate for one pick: a create_checkout with the full address (cached 10 min). */
export async function estimateArrival(
  person: Person,
  occasion: Occasion,
  pick: { variantId: string; shopDomain: string },
  asOf: string | undefined,
  buyerIp: string | undefined,
): Promise<Arrival> {
  const deadline = deadlineFor(occasion.date);
  const a = fullAddress(person);
  if (!a) return { status: "unknown", options: [], deadline, note: "Delivery dates at checkout", needsAddress: true };
  if (!buyerIp || !pick.shopDomain) return { status: "unknown", options: [], deadline, note: "No shipping estimate" };
  try {
    const summary = await cached(`arrival:${pick.variantId}:${JSON.stringify(a)}`, TTL.priceAndAvailability, () =>
      createCheckout({
        shopDomain: pick.shopDomain,
        variantId: pick.variantId,
        address: a,
        currency: person.budget.currency,
        intent: `Estimate delivery for a ${occasion.title} gift`,
        buyerIp,
      }),
    );
    return estimate(summary.options, occasion.date, asOf ?? todayISO());
  } catch {
    return { status: "unknown", options: [], deadline, note: "Couldn't reach the shop for a shipping estimate." };
  }
}

function samplePicks(req: PicksRequest, notice: string): PicksResponse {
  const rules = activeRules(req.rules, req.person.avoidText);
  const pronoun = pronounFor(req.person.relationship);
  const prefersRed = req.rules.some((r) => r.id === "red-gold");
  const facets = facetsFor(req.person.interests);
  const picks: Pick[] = [];
  const filteredOut: FilteredOut[] = [];
  for (const p of SAMPLE_PRODUCTS) {
    const v = p.variants[0];
    const res = applyRules({ title: p.title, description: p.description, variants: [{ id: v.id, text: v.title }] }, rules);
    if (!res.ok) {
      filteredOut.push({ title: p.title, shop: v.seller.name, ruleId: res.ruleId, reason: res.label, evidence: res.evidence });
      continue;
    }
    const colour = prefersRed ? p.title.match(PREFER_COLOURS)?.[0]?.toLowerCase() : undefined;
    const opts = p.shippingText ? [{ id: "std", title: "Standard shipping", description: p.shippingText }] : [];
    const facet = facets.find((f) => f.interest === p.interest);
    picks.push({
      productId: p.id,
      variantId: v.id,
      title: p.title,
      shop: v.seller,
      price: v.price!,
      why: whyThisFits({ lead: facet?.why(pronoun) ?? `Matches ${pronoun.possessive} interests`, luckyColour: colour, holidayId: req.occasion.holidayId }),
      matched: [p.interest],
      facet: { interest: p.interest },
      arrival: estimate(opts, req.occasion.date, req.asOf ?? todayISO()),
      sample: true,
    });
  }
  return { picks, filteredOut, searched: [], mode: "sample", notice };
}
