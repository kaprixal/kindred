# Product

## Platform

web

## Users

Anyone who buys gifts for a mixed circle of friends and family who celebrate different occasions, on different calendars, with different gift customs. The lead case is a diaspora family: buying a Lunar New Year gift for a grandmother (Nai Nai) in Markham, ON. The lead case is not the whole audience, though. The same person might also be buying for a friend's Diwali, a colleague's Eid or a birthday that falls on the lunar calendar.

Their job: notice what's coming up, choose something that suits this particular person and respects their customs, and make sure it arrives before the day.

## Product Purpose

Gift guides are generic and mostly built around Western holidays. Kindred picks gifts for **one specific person**, for the occasions they actually celebrate, and checks that the gift arrives in time.

Success means the buyer leaves with a gift they're confident about in three ways: it fits the person, it doesn't break a custom they care about, and it will arrive before the occasion.

## Positioning

Kindred makes three linked promises, and they carry equal weight. A generic gift guide can't honestly make any of them:

1. **One person, not a demographic.** Picks come from this person's interests and photos, not from a "gifts for grandma" list.
2. **Their occasions and their customs.** Kindred works from the occasions this person actually celebrates. It applies only gift customs the buyer has confirmed (opt-in, never inferred from a name), and it shows why each pick was kept or left out.
3. **Arrives in time.** Arrival is checked shop by shop against a deadline of the day before the occasion, using real checkout shipping options rather than a generic "ships in 3–5 days".

## Operating Context

A four-step flow, phone-first (390px design) with a desktop layout from 1024px up:

1. **Coming up** (`/`): upcoming birthdays from an `.ics` calendar, plus holidays from public holiday calendars, for occasions the user opts into.
2. **Who it's for** (`/people/[id]`): interests, photos, confirmed gift customs, and country + province/state. A street address is optional and only needed for exact delivery dates.
3. **Picks** (`/people/[id]/picks`): live Shopify Global Catalog search, a customs filter with a visible "Left out" list, "why this fits" reasons, and per-card arrival badges (on time / tight / too late / no estimate).
4. **Send it** (`/checkout/[id]`): a country-aware address form, live UCP checkout with an arrival badge on each shipping option, then handoff to the shop's own checkout.

The demo runs on a seeded profile (Nai Nai, Lunar New Year 2027, Feb 6) with demo controls: Reset demo, "Check arrival as if ordering on", and `?today=`.

## Capabilities and Constraints

- **Real:** calendar parsing, holiday dates (with fallbacks), Shopify Global Catalog text and image search, the customs filter including variant-level filtering, UCP checkout and arrival estimates.
- **Mocked, and labelled as mocked:** turning interests into product facets (`lib/picks/queries.ts`) and the "why this fits" wording (`lib/picks/explain.ts`). No AI calls yet.
- **Offline fallback:** with no API keys, or when the catalog can't be reached, Picks shows products clearly labelled as **offline sample** products. They're invented rather than recorded responses, because of Shopify's caching rules.
- **Shopify Catalog guidelines are binding:** cache in memory only, search results for at most 10 minutes, nothing stored on disk, product images shown from Shopify's CDN with their listing and never re-hosted.
- **Checkout is handoff only:** Kindred never calls `complete_checkout` or takes payment. `continue_url` must be `https:`.
- **Delivery estimates are expensive** (one `create_checkout` per product), so they run only for cards scrolled into view, and only once a street address exists.
- **Pronouns:** derived from the relationship (Grandmother → she). Everyone else is *they*.
- **Not doing:** accounts, real calendar OAuth, payments, an AI review pass after the keyword filter.

## Brand Commitments

- Name: **Kindred**. Tagline: "Gifts that fit the person, not the holiday list."
- Voice: plain, specific and honest about its limits. Examples: "We never guess from someone's name." "Kindred can't verify this, so check the label." Each custom states its reason in a short phrase, e.g. "送钟 sounds like seeing someone off at a funeral".
- The interface always says what's real and what isn't: demo calendar, offline sample products, "Delivery dates at checkout", "No estimate".

## Evidence on Hand

- Demo calendar: `fixtures/calendar.ics`. Seeded profile: `lib/demo/seed.ts` (Nai Nai).
- Customs catalogue with reasons: `lib/occasions/customs.ts`.
- Offline sample products: `lib/demo/sample-products.ts`. These are invented and must never be presented as real listings.
- The README explains the delivery-estimate method and the street-address finding (shops return `delivery_address1_required` without a full address).
- No users, testimonials, metrics or press exist yet. Don't invent any.

## Product Principles

1. **Specific over generic.** Every pick, reason and date should be traceable to this person and this occasion.
2. **Customs are the buyer's call.** Suggest, explain and let the buyer confirm. Never infer a custom from a name or ethnicity. Always show what was left out and why.
3. **Honest about certainty.** Say when something is mocked, sampled, estimated, tight or unknown, rather than smoothing it over.
4. **Respect the shops.** Follow catalog rules, show merchant images and listings as they are, and hand the purchase to the shop's own checkout.
5. **Show the thinking.** This is a portfolio project, so the reasoning (filters, ranking, delivery logic) should be visible and legible, not hidden.

## Accessibility & Inclusion

No specific standard has been set. The product handles multilingual and multi-script content (e.g. Chinese characters in custom reasons) and international addresses (postal code and region fields only where the country uses them), and it uses relationship-based or neutral pronouns.
