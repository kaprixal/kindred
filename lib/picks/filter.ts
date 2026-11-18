// Customs filter: keyword and pattern rules over product titles, options and variants.
// Every exclusion carries the words that triggered it, so the UI can say exactly why.
// (An AI review pass can sit after this later; this layer stays as the explainable base.)

import type { CustomRule } from "../types";

export type Matcher = {
  /** Patterns checked against the title and variant/option text. */
  strong: RegExp[];
  /** Patterns also checked against the description (keep these high-precision). */
  description?: RegExp[];
  /** Text that cancels a hit, e.g. "faux leather". */
  unless?: RegExp;
};

const FOUR_ITEMS =
  "cups|mugs|teas|teacups|bowls|plates|glasses|coasters|sachets|tins|jars|candles|bottles|flavou?rs|varieties|bars|boxes|chopsticks|pairs|towels|napkins|placemats|spoons|pots|planters|brushes|pieces";

export const MATCHERS: Record<string, Matcher> = {
  "no-clocks": {
    strong: [/\b(clock|clocks)\b/i],
  },
  "no-fours": {
    strong: [
      /\b(set|pack|box|collection|bundle)\s+of\s+(4|four)\b/i,
      /(?<![\d.,])(4|four)[\s-]*(pc|pcs|piece|pieces|pack|packs|count|ct|set|sets)\b/i,
      /(?<![\d.,])4\s*[x×]\s*\d/i,
      new RegExp(
        String.raw`(?<![\d.,])\b(4|four)\s+(premium\s+|assorted\s+|different\s+|mini\s+|small\s+|large\s+|signature\s+)?(${FOUR_ITEMS})\b`,
        "i",
      ),
    ],
    description: [/\b(set|pack|box)\s+of\s+(4|four)\b/i],
  },
  "no-white-flowers": {
    strong: [
      /\bwhite\s+(roses?|lil(y|ies)|flowers?|bouquets?|orchids?|carnations?|peon(y|ies)|tulips?)\b/i,
      /\bchrysanthemums?\b/i,
    ],
  },
  "no-alcohol": {
    strong: [
      /\b(wine|wines|whisk(e)?y|vodka|sake|soju|beer|champagne|prosecco|liquor|liqueur|baijiu|rum|gin|tequila|bourbon|brandy|cognac|alcohol|alcoholic|spirits)\b/i,
    ],
    unless: /\b(non-?alcoholic|alcohol-?free|wine glass(es)?|0\.0%)\b/i,
  },
  "no-pork": {
    strong: [/\b(pork|bacon|ham|prosciutto|lard|gelatine?|chorizo|salami|pepperoni)\b/i],
  },
  "no-leather": {
    strong: [/\bleather\b/i],
    unless: /\b(vegan|faux|imitation|pu)\s+leather\b|\bleatherette\b/i,
  },
};

/** Free-text avoids ("she doesn't drink, no wool") become simple word rules. */
export function freeTextMatchers(text: string | undefined): { id: string; label: string; matcher: Matcher }[] {
  if (!text?.trim()) return [];
  const out: { id: string; label: string; matcher: Matcher }[] = [];
  for (const raw of text.split(/[,;\n]+/)) {
    const phrase = raw
      .trim()
      .replace(/^(no|avoid|not|nothing with|she doesn't|he doesn't|they don't|doesn't|don't)\s+/i, "")
      .replace(/^(like|want|use|eat|have)\s+/i, "")
      .trim();
    if (phrase.length < 3) continue;
    if (/^(drink|drinks|alcohol|booze)$/i.test(phrase)) {
      out.push({ id: "free:alcohol", label: "No alcohol (your note)", matcher: MATCHERS["no-alcohol"] });
      continue;
    }
    const word = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/s$/i, "");
    out.push({
      id: `free:${phrase.toLowerCase()}`,
      label: `No ${phrase} (your note)`,
      matcher: { strong: [new RegExp(String.raw`\b${word}s?\b`, "i")] },
    });
  }
  return out;
}

export type Candidate = {
  title: string;
  description?: string;
  /** One entry per variant: its title plus option labels. */
  variants: { id: string; text: string }[];
  /** Product-level option text, e.g. "Size: 4 x 25g Pouches / 4 x 50g Pouches". */
  optionsText?: string;
};

export type ActiveRule = { id: string; label: string; matcher: Matcher };

export type FilterResult =
  | { ok: true; variantIds: string[] } // variants that passed every rule
  | { ok: false; ruleId: string; label: string; evidence: string };

function firstHit(patterns: RegExp[] | undefined, text: string | undefined, unless?: RegExp): string | undefined {
  if (!patterns || !text) return undefined;
  if (unless?.test(text)) {
    // Remove the cancelling phrase and check again, so "faux leather tote with leather strap" still hits.
    text = text.replace(new RegExp(unless.source, unless.flags.includes("g") ? unless.flags : unless.flags + "g"), " ");
  }
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[0];
  }
  return undefined;
}

function snippet(text: string, hit: string): string {
  const i = text.toLowerCase().indexOf(hit.toLowerCase());
  if (i < 0 || text.length <= 60) return text.trim();
  const start = Math.max(0, i - 20);
  const end = Math.min(text.length, i + hit.length + 25);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

export function applyRules(c: Candidate, rules: ActiveRule[]): FilterResult {
  // 1) Product-level: title, options and description rule the whole product out.
  for (const r of rules) {
    const titleHit = firstHit(r.matcher.strong, c.title, r.matcher.unless);
    if (titleHit) return { ok: false, ruleId: r.id, label: r.label, evidence: snippet(c.title, titleHit) };
    const descHit = firstHit(r.matcher.description, c.description, r.matcher.unless);
    if (descHit) return { ok: false, ruleId: r.id, label: r.label, evidence: snippet(c.description!, descHit) };
  }
  // 2) Variant-level: keep the variants that pass (e.g. "Set of 2" when "Set of 4" is also sold).
  const passing: string[] = [];
  let firstFail: { ruleId: string; label: string; evidence: string } | undefined;
  for (const v of c.variants) {
    let failed = false;
    for (const r of rules) {
      const hit = firstHit(r.matcher.strong, v.text, r.matcher.unless);
      if (hit) {
        failed = true;
        firstFail ??= { ruleId: r.id, label: r.label, evidence: snippet(v.text, hit) };
        break;
      }
    }
    if (!failed) passing.push(v.id);
  }
  if (passing.length === 0 && firstFail) return { ok: false, ...firstFail };
  if (passing.length === 0 && c.optionsText) {
    for (const r of rules) {
      const hit = firstHit(r.matcher.strong, c.optionsText, r.matcher.unless);
      if (hit) return { ok: false, ruleId: r.id, label: r.label, evidence: snippet(c.optionsText, hit) };
    }
  }
  return { ok: true, variantIds: passing.length ? passing : c.variants.map((v) => v.id) };
}

export function activeRules(rules: CustomRule[], avoidText?: string): ActiveRule[] {
  const fromCustoms = rules
    .filter((r) => r.kind === "avoid" && MATCHERS[r.id])
    .map((r) => ({ id: r.id, label: r.label, matcher: MATCHERS[r.id] }));
  return [...fromCustoms, ...freeTextMatchers(avoidText)];
}

export const PREFER_COLOURS = /\b(red|gold|golden|crimson|vermilion|scarlet)\b/i;
