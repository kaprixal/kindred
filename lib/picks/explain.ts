// "Why this fits" — a sentence built only from signals we actually have, so it never
// claims something the data doesn't show.
// MOCK: an AI writer would go here later; this template is the fallback either way.

export type WhySignals = {
  lead: string; // from the facet ("For whisking her matcha") or photo ("Looks like her teapot")
  luckyColour?: string; // "red" / "gold" when the user kept the red-or-gold custom
  holidayId?: string;
  rating?: { value: number; count: number };
};

export function whyThisFits(s: WhySignals): string {
  const parts = [s.lead];
  if (s.luckyColour) {
    const newYear = s.holidayId === "lunar-new-year" || s.holidayId === "seollal";
    parts.push(newYear ? `${s.luckyColour} is a lucky colour for the new year` : `${s.luckyColour} feels festive`);
  }
  let sentence = parts.join(", and ") + ".";
  if (s.rating && s.rating.count >= 3 && s.rating.value >= 4.5) {
    sentence += ` Rated ${s.rating.value.toFixed(1)} by ${s.rating.count} buyers.`;
  }
  return sentence;
}

export function photoLead(caption: string): string {
  return `Looks like ${caption.charAt(0).toLowerCase()}${caption.slice(1)}`;
}

export function pronounFor(relationship?: string): { subject: string; possessive: string } {
  // Only relationships that state a gender pick a pronoun; everything else uses "they".
  const r = (relationship ?? "").toLowerCase();
  if (/(grandmother|grandma|mother|mom|mum|aunt|sister|daughter|wife|niece|nai nai|po po|lola|nani|dadi)/.test(r))
    return { subject: "she", possessive: "her" };
  if (/(grandfather|grandpa|father|dad|uncle|brother|son|husband|nephew|ye ye|lolo|nana|dada)/.test(r))
    return { subject: "he", possessive: "his" };
  return { subject: "they", possessive: "their" };
}
