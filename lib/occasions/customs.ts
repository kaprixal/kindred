// Gift customs the user can confirm for a person and occasion.
// These are suggestions, never applied automatically — and never inferred from a name.

import type { CustomRule } from "../types";

export const CUSTOMS: Record<string, CustomRule> = {
  "no-clocks": {
    id: "no-clocks",
    label: "No clocks",
    reason: "送钟 sounds like seeing someone off at a funeral",
    kind: "avoid",
    defaultOn: true,
  },
  "no-fours": {
    id: "no-fours",
    label: "No sets of four",
    reason: "四 sounds like the word for death",
    kind: "avoid",
    defaultOn: true,
  },
  "red-gold": {
    id: "red-gold",
    label: "Red or gold wrapping",
    reason: "lucky colours for the new year",
    kind: "prefer",
    defaultOn: true,
  },
  "no-white-flowers": {
    id: "no-white-flowers",
    label: "Avoid white flowers",
    reason: "white flowers and chrysanthemums are for mourning",
    kind: "avoid",
    defaultOn: false,
  },
  "no-alcohol": {
    id: "no-alcohol",
    label: "No alcohol",
    kind: "avoid",
    defaultOn: true,
  },
  "no-pork": {
    id: "no-pork",
    label: "No pork or gelatin",
    reason: "keep food gifts halal",
    kind: "avoid",
    defaultOn: true,
  },
  "no-leather": {
    id: "no-leather",
    label: "No leather",
    reason: "some families avoid it for religious reasons",
    kind: "avoid",
    defaultOn: false,
  },
  "kosher-food": {
    id: "kosher-food",
    label: "Food gifts should be kosher",
    reason: "Kindred can't verify this, so check the label",
    kind: "prefer",
    defaultOn: false,
  },
};

export function customsFor(ids: string[]): CustomRule[] {
  return ids.map((id) => CUSTOMS[id]).filter(Boolean);
}
