// Shared types for Kindred. Dates are plain "YYYY-MM-DD" strings (no time zone),
// because birthdays and holidays are all-day events.

export type ISODate = string;

export type Money = { amount: number; currency: string }; // amount in minor units (cents)

export type Address = {
  firstName: string;
  lastName: string;
  phone: string;
  country: string; // ISO 3166-1 alpha-2
  street: string;
  extended?: string; // apt, unit, c/o
  locality: string; // city / town
  region?: string; // province / state code when the country uses one
  postalCode?: string; // optional: not every country has one
};

export type Destination = { country: string; region?: string };

export type Photo = {
  id: string;
  caption: string; // e.g. "her blue-and-white teapot" — typed by the user
  dataUrl: string; // resized JPEG, kept in the browser only
};

export type Person = {
  id: string;
  name: string;
  relationship?: string;
  city?: string;
  interests: string[];
  photos: Photo[];
  budget: { min: number; max: number; currency: string }; // major units, e.g. 50–80 CAD
  /** All the picks search needs: which shops ship there. */
  shipTo?: Destination;
  /** Optional full address: unlocks exact delivery dates on the picks. Required at checkout. */
  address?: Address;
  avoidText?: string; // free text "anything else to avoid?", comma separated
};

export type OccasionKind = "birthday" | "holiday";

export type Occasion = {
  id: string;
  kind: OccasionKind;
  holidayId?: string; // key into HOLIDAYS for holiday occasions
  title: string; // "Lunar New Year", "Ma's birthday"
  date: ISODate;
  personIds: string[];
  lunar?: boolean; // date follows the lunar calendar and moves every year
  tentative?: boolean; // e.g. Eid, which depends on moon sighting
  source: "calendar" | "holiday-feed" | "builtin" | "custom";
};

/** A customs rule the user confirms per person + occasion. */
export type CustomRule = {
  id: string;
  label: string;
  reason?: string;
  kind: "avoid" | "prefer";
  defaultOn: boolean;
};

export type ArrivalStatus = "on_time" | "tight" | "late" | "unknown";

export type ShippingEstimate = {
  optionId: string;
  title: string; // "DHL Express Worldwide"
  description?: string; // "1 to 3 business days"
  cost?: Money;
  earliest?: ISODate;
  latest?: ISODate;
  status: ArrivalStatus;
};

export type Arrival = {
  status: ArrivalStatus;
  best?: ShippingEstimate; // cheapest option that makes it on time, else fastest
  options: ShippingEstimate[];
  deadline: ISODate;
  note?: string;
  /** No street address yet, so the shop can't quote shipping. Not a failure: dates come at checkout. */
  needsAddress?: boolean;
};

export type Pick = {
  productId: string;
  variantId: string;
  title: string;
  shop: { name: string; domain: string; url?: string };
  price: Money;
  image?: { url: string; alt?: string };
  rating?: { value: number; count: number };
  url?: string;
  checkoutUrl?: string;
  why: string;
  matched: string[]; // interests / photo captions this pick matched
  facet?: { interest: string; label?: string }; // "Matcha" · "Whisk"
  arrival?: Arrival;
  sample?: boolean; // offline sample data, not a live Shopify product
};

export type FilteredOut = {
  title: string;
  shop?: string;
  ruleId: string;
  reason: string; // "No sets of four" / "Over budget" / "Doesn't ship to Canada"
  evidence?: string; // the words that triggered it, e.g. "4 x 25g Pouches"
};

export type PicksRequest = {
  person: Person;
  occasion: Occasion;
  rules: CustomRule[]; // only the rules the user kept on
  photoSearch?: { caption: string; contentType: string; data: string }[]; // base64, no prefix
  asOf?: ISODate; // "pretend today is" — demo control for arrival states
  cursor?: string; // opaque, from the previous page's nextCursor
  likeId?: string; // "More like this"
};

export type PicksResponse = {
  picks: Pick[];
  filteredOut: FilteredOut[];
  searched: string[]; // the queries we ran, shown for transparency
  mode: "live" | "sample";
  notice?: string;
  nextCursor?: string; // undefined when there's nothing more
};
