// Address rules per country. Not every country uses postal codes or regions, so the
// form only asks for what the destination actually needs.

export type CountryRule = {
  code: string;
  name: string;
  postal: "required" | "optional" | "none";
  postalLabel?: string;
  region: "select" | "text" | "none";
  regionLabel?: string;
  regions?: [string, string][]; // [code, name]
};

const CA_REGIONS: [string, string][] = [
  ["AB", "Alberta"], ["BC", "British Columbia"], ["MB", "Manitoba"], ["NB", "New Brunswick"],
  ["NL", "Newfoundland and Labrador"], ["NS", "Nova Scotia"], ["NT", "Northwest Territories"],
  ["NU", "Nunavut"], ["ON", "Ontario"], ["PE", "Prince Edward Island"], ["QC", "Quebec"],
  ["SK", "Saskatchewan"], ["YT", "Yukon"],
];

const US_REGIONS: [string, string][] = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"],
  ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"],
  ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"],
  ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"],
  ["ME", "Maine"], ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"],
  ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"],
  ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"],
  ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"], ["OR", "Oregon"],
  ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"], ["SD", "South Dakota"],
  ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"],
  ["WA", "Washington"], ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
];

export const COUNTRIES: CountryRule[] = [
  { code: "CA", name: "Canada", postal: "required", postalLabel: "Postal code", region: "select", regionLabel: "Province", regions: CA_REGIONS },
  { code: "US", name: "United States", postal: "required", postalLabel: "ZIP code", region: "select", regionLabel: "State", regions: US_REGIONS },
  { code: "GB", name: "United Kingdom", postal: "required", postalLabel: "Postcode", region: "none" },
  { code: "AU", name: "Australia", postal: "required", postalLabel: "Postcode", region: "text", regionLabel: "State" },
  { code: "NZ", name: "New Zealand", postal: "required", postalLabel: "Postcode", region: "none" },
  { code: "CN", name: "China", postal: "required", region: "text", regionLabel: "Province" },
  { code: "HK", name: "Hong Kong", postal: "none", region: "text", regionLabel: "District" },
  { code: "MO", name: "Macao", postal: "none", region: "none" },
  { code: "TW", name: "Taiwan", postal: "optional", region: "text", regionLabel: "City / county" },
  { code: "SG", name: "Singapore", postal: "required", region: "none" },
  { code: "MY", name: "Malaysia", postal: "required", region: "text", regionLabel: "State" },
  { code: "PH", name: "Philippines", postal: "required", postalLabel: "ZIP code", region: "text", regionLabel: "Province" },
  { code: "VN", name: "Vietnam", postal: "optional", region: "text", regionLabel: "Province" },
  { code: "KR", name: "South Korea", postal: "required", region: "text", regionLabel: "Province" },
  { code: "JP", name: "Japan", postal: "required", region: "text", regionLabel: "Prefecture" },
  { code: "IN", name: "India", postal: "required", postalLabel: "PIN code", region: "text", regionLabel: "State" },
  { code: "PK", name: "Pakistan", postal: "optional", region: "text", regionLabel: "Province" },
  { code: "BD", name: "Bangladesh", postal: "optional", region: "none" },
  { code: "AE", name: "United Arab Emirates", postal: "none", region: "text", regionLabel: "Emirate" },
  { code: "SA", name: "Saudi Arabia", postal: "optional", region: "none" },
  { code: "QA", name: "Qatar", postal: "none", region: "none" },
  { code: "IE", name: "Ireland", postal: "optional", postalLabel: "Eircode", region: "text", regionLabel: "County" },
  { code: "MX", name: "Mexico", postal: "required", region: "text", regionLabel: "State" },
  { code: "NG", name: "Nigeria", postal: "optional", region: "text", regionLabel: "State" },
];

export const COUNTRY_BY_CODE = Object.fromEntries(COUNTRIES.map((c) => [c.code, c]));

export function countryName(code?: string): string {
  return (code && COUNTRY_BY_CODE[code]?.name) || code || "";
}

type Ship = { shipTo?: import("./types").Destination; address?: import("./types").Address };

/** Country + region the gift goes to (older saved profiles only have a full address). */
export function destinationOf(p: Ship): import("./types").Destination | undefined {
  return p.shipTo ?? (p.address ? { country: p.address.country, region: p.address.region } : undefined);
}

export function destinationOk(d?: import("./types").Destination): boolean {
  if (!d?.country) return false;
  const rule = COUNTRY_BY_CODE[d.country];
  return rule?.region !== "select" || !!d.region;
}

export function destinationLabel(d?: import("./types").Destination): string {
  if (!d) return "";
  const rule = COUNTRY_BY_CODE[d.country];
  const region = d.region && rule?.regions ? rule.regions.find(([c]) => c === d.region)?.[1] ?? d.region : d.region;
  return [region, countryName(d.country)].filter(Boolean).join(", ");
}

/** A full street address that matches the chosen destination. */
export function fullAddress(p: Ship): import("./types").Address | undefined {
  const a = p.address;
  if (!a || Object.keys(validateAddress(a)).length) return undefined;
  const d = destinationOf(p);
  if (d && (d.country !== a.country || (d.region && a.region && d.region !== a.region))) return undefined;
  return a;
}

/** Returns field → message for anything missing. */
export function validateAddress(a: Partial<import("./types").Address>): Record<string, string> {
  const errors: Record<string, string> = {};
  const rule = a.country ? COUNTRY_BY_CODE[a.country] : undefined;
  if (!a.country) errors.country = "Choose a country";
  if (!a.firstName?.trim()) errors.firstName = "Needed for the shipping label";
  if (!a.lastName?.trim()) errors.lastName = "Needed for the shipping label";
  if (!a.street?.trim()) errors.street = "Enter a street address";
  if (!a.locality?.trim()) errors.locality = "Enter a city or town";
  if (rule?.region === "select" && !a.region) errors.region = `Choose a ${rule.regionLabel?.toLowerCase() ?? "region"}`;
  if (rule?.postal === "required" && !a.postalCode?.trim()) errors.postalCode = `Enter a ${rule.postalLabel?.toLowerCase() ?? "postal code"}`;
  if (!a.phone?.trim()) errors.phone = "Many carriers need one for delivery";
  return errors;
}
