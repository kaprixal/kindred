# Kindred

Gift guides are generic and mostly built around Western holidays. Kindred picks gifts for **one specific person**, for the occasions they actually celebrate, and checks that the gift arrives in time.

Demo case: a Lunar New Year 2027 (Feb 6) gift for Nai Nai in Markham, ON.

The product brief (users, positioning, what success looks like) is in [PRODUCT.md](PRODUCT.md).

## Run it locally

### 1. Install Node.js

You need **Node.js 20.9 or newer** (the app was built on Node 24). Check your version with:

```bash
node -v
```

If it's missing or older, install the LTS version from [nodejs.org](https://nodejs.org).

### 2. Install dependencies

In a terminal, open the project folder (the one containing `package.json`) and run:

```bash
npm install
```

### 3. Add your Shopify keys in `.env.local`

The app reads its keys from a file called `.env.local` in the project folder. Create it from the template:

```bash
# macOS / Linux / Git Bash
cp .env.example .env.local

# Windows (Command Prompt or PowerShell)
copy .env.example .env.local
```

Open `.env.local` in any text editor and paste in the client ID and client secret of a Shopify app with **Catalog API** access (from the Shopify Dev Dashboard):

```
SHOPIFY_CLIENT_ID=your-client-id
SHOPIFY_CLIENT_SECRET=your-client-secret
```

Use no quotes or spaces around the `=`. `.env.local` is gitignored, so never commit it or share it.

To check the keys work, run one live catalog search:

```bash
npm run probe
```

You should see `auth: ok` followed by a few products. A `401` or `auth` error means the ID or secret is wrong.

> **No keys?** You can skip this step. The app still runs end to end, and screen 3 shows clearly labelled **offline sample** products instead of live catalog results. Checkout (screen 4) needs real keys.

### 4. Start the app

```bash
npm run dev
```

Open **http://localhost:3000**. If port 3000 is busy, run `npm run dev -- -p 3100` and open http://localhost:3100 instead.

Restart `npm run dev` (Ctrl+C, then run it again) after any change to `.env.local`.

### 5. Try the demo

On **Coming up**, open **Nai Nai · Lunar New Year**. Her profile is already filled in, so go to **Find gifts** and then pick something to see the arrival check at checkout. **Reset demo** (bottom of screen 1) restores the starting data at any time. More controls are under [Demo controls](#demo-controls).

### Other commands

```bash
npm test            # unit tests: customs filter, delivery estimates, calendar parsing, facets
npm run typecheck   # TypeScript check
npm run build       # production build, then `npm start` to serve it
```

### Troubleshooting

- **Picks say "offline sample"**: the keys are missing or wrong, or the catalog couldn't be reached. Run `npm run probe` to see the error.
- **Checkout says the buyer IP is missing**: Shopify's checkout needs your public IP. Locally the app looks it up automatically. If your network blocks that, add `BUYER_IP=<your public IP>` to `.env.local` and restart.
- **Data looks stale or odd**: everything is stored in your browser. Use **Reset demo** on screen 1.

## The four screens

| Screen | Route | What's real |
|---|---|---|
| 1. Coming up | `/` | Birthdays parsed from `fixtures/calendar.ics` (or an uploaded `.ics`). Holiday dates from Google's public holiday calendars, falling back to the calendar file, then a built-in table. |
| 2. Who it's for | `/people/[id]?occasion=…` | Interests, photos, gift customs the user confirms, and **just country + province/state**. A street address is optional ("for exact delivery dates"). |
| 3. Picks | `/people/[id]/picks?occasion=…` | Live **Shopify Global Catalog** search (text + image search for photos), customs filter, ranking, "why this fits". With a street address: a delivery badge per pick from each shop's **UCP checkout**. Without one: "Delivery dates at checkout". |
| 4. Send it | `/checkout/[id]?occasion=…` | Asks for the street address if it's missing (country-aware: postal code/region only where they exist). Live UCP `create_checkout` / `update_checkout`, each shipping option with an arrival badge, then hands off to the shop's `continue_url`. |

**Quick search** (`/search`, linked from screen 1 and the top bar) skips the profile: say what you're after (e.g. "matcha, mahjong"), pick the occasion (any holiday, or a birthday with its date), where it's going and a budget. The occasion's customs are offered as usual, and the same picks pipeline runs against a stand-in person that's never saved. Cards link to the shop's own listing instead of screen 4, since there's no saved address to check out with.

**Why the street address is optional but needed for dates:** shops return no shipping options until the destination has a street, city, postal code, name and phone. We tested a country + province-only destination and got `delivery_address1_required`, `delivery_city_required` and similar errors. So picks are searched by country/province, and exact dates wait for the full address.

**Layout:** phone-first (the 390px design), with a desktop layout from 1024px up (tuned for 1920×1080): a top app bar with the 4-step progress, two-column screens with a sticky side panel, a 3-across picks grid, and an order-summary sidebar on checkout.

## How it works

```
interests ─► queries.ts (MOCK) → facets: several kinds of product per interest
               Matcha → whisk · bowl & cup set · matcha     Miffy → keychain · apparel · plush
photos ────► image + caption (multimodal search)
                                    │  one search_catalog per facet, each with its own cursor
                                    ▼  (ships_to, price ≤ budget max, available)
                    filter.ts  customs rules → "Left out", with the matching words
                                    ▼
             dedupe · max 2 per shop per facet · rank within facet
                                    ▼
             interleave facets (whisk, keychain, bowl set, t-shirt, matcha, plush, …)
                                    ▼
             ~25 ideas per page; scrolling loads the next page with the facet cursors
                                    ▼
   card scrolls into view → /api/estimate → create_checkout → on time / tight / late / no estimate
```

**Paging:** each page runs one search per facet (≈30 results spread across them). The response carries an opaque cursor holding every facet's catalog cursor plus the product ids already shown, so the next page continues where each facet left off with no repeats. The grid loads the next page automatically near the bottom (with a "Load more ideas" button as a fallback) and has interest filter chips.

**Budget:** the maximum is a hard filter; the minimum only nudges ranking, so a $15 Miffy keychain or a $25 whisk can still show up.

**Delivery estimates** cost one `create_checkout` per product, so they run only for cards the person actually scrolls to (2 at a time, cached 10 minutes), and only once a street address is saved.

### Arrival badges
Shops describe shipping as text ("1 to 3 business days", "Wednesday, November 25–Friday, November 27"), not dates. `lib/delivery.ts`:
1. uses `earliest/latest_fulfillment_time` when the shop sends them,
2. otherwise parses the text,
3. adds 2 business days for the shop to pack,
4. compares with a deadline of the day before the occasion.

**Tight** = the range straddles the deadline, or arrives with under 2 days to spare. **No estimate** = the shop gave no timing.

The Global Catalog returns no shipping data, and UCP carts return none either (`methods: []`), so each estimate is one `create_checkout` call. That's why estimates only run for cards scrolled into view.

### What's mocked (no AI calls yet)
- `lib/picks/queries.ts`: interest → facets (kinds of product, their queries, and the opening of "why this fits"), from a lookup table. Unknown interests get generic facets: the interest itself, "… gift set", "… accessories".
- `lib/picks/explain.ts`: "why this fits" is a template built only from signals we have (matched interest/photo, lucky colour, rating).

Photo matching is **not** mocked; it uses the catalog's own multimodal search (`catalog.like` with the image).

## Decisions worth knowing

- **Customs are opt-in and never inferred from a name.** Each rule shows its reason (送钟 sounds like seeing someone off at a funeral). Exclusions show the exact words that matched, e.g. `A Set Of 4pcs` in a variant.
- **Variant-level filtering.** If a product sells "Set of 2 / Set of 4 / Set of 6", we keep it and pick a non-four variant.
- **Pronouns** come from the relationship (Grandmother → she); everything else uses *they*.
- **Caching follows Shopify's Catalog guidelines**: in memory only, search results ≤10 minutes (price/availability limit), nothing stored on disk. Product images are shown from Shopify's CDN with their listing, never re-hosted. That's why demo mode falls back to invented sample products rather than recorded responses.
- **Checkout handoff**: Kindred has general access, so it never calls `complete_checkout`. `continue_url` is checked to be `https:`, tagged with UTM params, and never logged.
- **Buyer IP**: checkout calls require `Shopify-Buyer-IP`. Deployed, it's the visitor's IP. Locally (where requests come from 127.0.0.1) the dev server looks up this machine's public IP, or uses `BUYER_IP` from `.env.local`.
- **Agent profile**: uses Shopify's hosted example profile. A production deployment should host its own at `/.well-known/ucp` and set `UCP_AGENT_PROFILE`.

## Demo controls
- **Reset demo** (screen 1) reloads the calendar and the Nai Nai profile.
- **"Check arrival as if ordering on"** (bottom of screen 3) re-runs the estimates for a later order date. Try Jan 25 to see *Tight* and *Too late* badges.
- `?today=YYYY-MM-DD` on any URL shifts "today" for the whole app.

## Not doing
Accounts, real calendar OAuth, payments beyond the checkout handoff, an AI review pass after the keyword filter.

## Layout

```
app/
  page.tsx                       1. Coming up
  people/[id]/page.tsx           2. Who it's for
  people/[id]/picks/page.tsx     3. Picks
  checkout/[id]/page.tsx         4. Send it
  search/page.tsx                Quick search (no profile)
  api/{calendar,holidays,picks,estimate,checkout}/route.ts
lib/
  shopify/  mcp.ts (auth + JSON-RPC), catalog.ts, checkout.ts, buyer-ip.ts
  picks/    pipeline.ts, filter.ts, queries.ts (mock), explain.ts (mock)
  occasions/ holidays.ts, customs.ts, holiday-dates.ts, build.ts
  delivery.ts, ics.ts, dates.ts, countries.ts, cache.ts, store.tsx
  demo/     seed.ts (Nai Nai), sample-products.ts (offline fallback)
fixtures/calendar.ics            demo calendar
scripts/probe-catalog.mjs        live API check
.env.example                     template for .env.local
```
