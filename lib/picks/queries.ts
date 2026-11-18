// Interests → "facets": several kinds of product per interest, so picks have variety.
// "Matcha" → a whisk, a bowl & cup set, and matcha itself — not ten tins of powder.
//
// MOCK: a fixed lookup table stands in for an AI step that would plan these facets (and the
// matching "why" phrase) from the profile. Unknown interests get generic facets
// (the interest itself, a gift set, accessories). Swap this out when AI is connected.

type Pronoun = { subject: string; possessive: string };

export type Facet = {
  key: string; // stable id, used for paging cursors
  interest: string; // "Matcha"
  label?: string; // "Whisk" — shown on the card
  query: string; // catalog query
  why: (p: Pronoun) => string; // opening of "why this fits"
};

type FacetDef = { label: string; query: string; why: (p: Pronoun) => string };
type Entry = { match: RegExp; facets: FacetDef[] };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const is = (p: Pronoun) => (p.subject === "they" ? "they're" : `${p.subject}'s`);
const loves = (p: Pronoun) => (p.subject === "they" ? "love" : "loves");

const MAP: Entry[] = [
  {
    match: /matcha/i,
    facets: [
      { label: "Whisk", query: "matcha whisk chasen", why: (p) => `For whisking ${p.possessive} matcha` },
      { label: "Bowl & cup set", query: "matcha bowl set", why: (p) => `So ${p.subject} can make matcha at home` },
      { label: "Matcha", query: "ceremonial matcha powder", why: (p) => `${cap(is(p))} into matcha` },
    ],
  },
  {
    match: /miffy/i,
    facets: [
      { label: "Keychain", query: "miffy keychain", why: (p) => `A little Miffy for ${p.possessive} keys` },
      { label: "Apparel", query: "miffy t-shirt", why: (p) => `Miffy ${p.subject} can wear` },
      { label: "Plush", query: "miffy plush", why: () => `A Miffy plush to keep` },
    ],
  },
  {
    match: /oolong|tea/i,
    facets: [
      { label: "Tea", query: "oolong tea gift box", why: (p) => `${cap(p.subject)} ${loves(p)} oolong tea` },
      { label: "Teaware", query: "gaiwan tea set", why: (p) => `For brewing ${p.possessive} oolong` },
      { label: "Cups", query: "porcelain tea cups", why: (p) => `For ${p.possessive} tea time` },
    ],
  },
  {
    match: /balcony|garden|plant/i,
    facets: [
      { label: "Planter", query: "ceramic planter pot", why: (p) => `For ${p.possessive} balcony garden` },
      { label: "Seeds", query: "herb seed kit", why: (p) => `Something new to grow on ${p.possessive} balcony` },
      { label: "Tools", query: "gardening tool gift set", why: (p) => `For tending ${p.possessive} garden` },
    ],
  },
  {
    match: /calligraphy|brush|ink/i,
    facets: [
      { label: "Brushes", query: "chinese calligraphy brush set", why: (p) => `${cap(p.subject)} ${p.subject === "they" ? "practise" : "practises"} calligraphy` },
      { label: "Ink & stone", query: "calligraphy ink stone", why: (p) => `For ${p.possessive} calligraphy practice` },
      { label: "Paper", query: "rice paper calligraphy", why: (p) => `Fresh paper for ${p.possessive} calligraphy` },
    ],
  },
  {
    match: /mahjong/i,
    facets: [
      { label: "Set", query: "mahjong set", why: (p) => `For ${p.possessive} mahjong nights` },
      { label: "Accessories", query: "mahjong mat", why: (p) => `For ${p.possessive} mahjong table` },
    ],
  },
];

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function facetsFor(interests: string[]): Facet[] {
  const out: Facet[] = [];
  for (const interest of interests.slice(0, 5)) {
    const hit = MAP.find((m) => m.match.test(interest));
    const lower = interest.charAt(0).toLowerCase() + interest.slice(1);
    const defs: FacetDef[] = hit
      ? hit.facets
      : [
          { label: "", query: interest, why: (p) => `Matches ${p.possessive} interest in ${lower}` },
          { label: "Gift set", query: `${interest} gift set`, why: (p) => `A gift set for ${p.possessive} love of ${lower}` },
          { label: "Accessories", query: `${interest} accessories`, why: (p) => `For ${p.possessive} ${lower}` },
        ];
    for (const d of defs) {
      out.push({ key: `${slugify(interest)}:${slugify(d.label || "main")}`, interest, label: d.label || undefined, query: d.query, why: d.why });
    }
  }
  return out;
}

/** Photos are searched as "image + caption" (Shopify's multimodal search). */
export function photoQuery(caption: string): string {
  return caption.replace(/^(her|his|their|my)\s+/i, "").trim();
}
