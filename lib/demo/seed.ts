// Demo setup for the Nai Nai / Lunar New Year 2027 walkthrough.
// Layered on top of the people found in fixtures/calendar.ics.

import type { Person } from "../types";

export const DEMO_CURRENCY = "CAD";

export const DEMO_PEOPLE: Record<string, Partial<Person>> = {
  "nai-nai": {
    relationship: "Grandmother",
    city: "Markham, ON",
    interests: ["Oolong tea", "Balcony garden", "Calligraphy"],
    budget: { min: 50, max: 80, currency: "CAD" },
    shipTo: { country: "CA", region: "ON" },
    // Optional full address for exact delivery dates. Demo address: Markham Civic Centre (a public building). Replace with hers.
    address: {
      firstName: "Nai Nai",
      lastName: "Demo",
      phone: "+1 905 555 0123",
      country: "CA",
      street: "101 Town Centre Blvd",
      locality: "Markham",
      region: "ON",
      postalCode: "L3R 9W3",
    },
  },
};

/** Used to show a "replace with her real address" reminder. */
export const DEMO_ADDRESS_STREET = "101 Town Centre Blvd";

export const DEMO_SELECTED_HOLIDAYS = ["lunar-new-year", "hanukkah"];

export const DEMO_LINKS: Record<string, string[]> = {
  "lunar-new-year": ["nai-nai"],
  hanukkah: ["ezra"],
};
