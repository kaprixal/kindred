// Global Catalog search, normalised to what Kindred needs.
// Keeps variant ids and checkout URLs exactly as returned (attribution must stay intact).

import "server-only";
import { cached, TTL } from "../cache";
import { CATALOG_ENDPOINT, callTool } from "./mcp";
import type { Money } from "../types";

type RawMoney = { amount: number; currency: string };
type RawVariant = {
  id: string;
  title?: string;
  price?: RawMoney;
  availability?: { available?: boolean };
  options?: { name: string; label: string }[];
  seller?: { name?: string; domain?: string; url?: string };
  checkout_url?: string;
  url?: string;
  media?: { type: string; url: string; alt_text?: string }[];
  rating?: { value: number; count: number };
};
type RawProduct = {
  id: string;
  title: string;
  description?: { plain?: string; html?: string };
  url?: string;
  price_range?: { min?: RawMoney; max?: RawMoney };
  media?: { type: string; url: string; alt_text?: string }[];
  options?: { name: string; values?: { label: string }[] }[];
  variants?: RawVariant[];
  rating?: { value: number; count: number };
  metadata?: { top_features?: string[]; unique_selling_points?: string[] };
};
type SearchResult = {
  products?: RawProduct[];
  messages?: { code?: string; content?: string }[];
  pagination?: { cursor?: string; has_next_page?: boolean; total_count?: number };
};

export type CatalogVariant = {
  id: string;
  title: string;
  optionText: string;
  price?: Money;
  available: boolean;
  seller: { name: string; domain: string; url?: string };
  checkoutUrl?: string;
  url?: string;
  image?: { url: string; alt?: string };
  rating?: { value: number; count: number };
};

export type CatalogProduct = {
  id: string;
  title: string;
  description: string;
  features: string[];
  optionsText: string;
  image?: { url: string; alt?: string };
  rating?: { value: number; count: number };
  variants: CatalogVariant[];
};

export type SearchParams = {
  query?: string;
  likeImage?: { contentType: string; data: string };
  likeId?: string;
  country: string;
  region?: string;
  postalCode?: string;
  currency: string;
  priceMin?: number; // major units
  priceMax?: number;
  intent?: string;
  limit?: number;
  cursor?: string;
};

export type SearchPage = { products: CatalogProduct[]; messages: string[]; nextCursor?: string };

function stripHtml(s?: string): string {
  return (s ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

function normalise(p: RawProduct): CatalogProduct {
  const img = p.media?.find((m) => m.type === "image");
  return {
    id: p.id,
    title: p.title,
    description: stripHtml(p.description?.plain ?? p.description?.html),
    features: [...(p.metadata?.top_features ?? []), ...(p.metadata?.unique_selling_points ?? [])],
    optionsText: (p.options ?? []).map((o) => `${o.name}: ${(o.values ?? []).map((v) => v.label).join(" / ")}`).join("; "),
    image: img ? { url: img.url, alt: img.alt_text } : undefined,
    rating: p.rating?.count ? { value: p.rating.value, count: p.rating.count } : undefined,
    variants: (p.variants ?? []).map((v) => {
      const vimg = v.media?.find((m) => m.type === "image");
      return {
        id: v.id,
        title: v.title ?? p.title,
        optionText: (v.options ?? []).map((o) => `${o.name}: ${o.label}`).join(", "),
        price: v.price ? { amount: v.price.amount, currency: v.price.currency } : undefined,
        available: v.availability?.available !== false,
        seller: { name: v.seller?.name ?? "Shopify merchant", domain: v.seller?.domain ?? "", url: v.seller?.url },
        checkoutUrl: v.checkout_url,
        url: v.url,
        image: vimg ? { url: vimg.url, alt: vimg.alt_text } : undefined,
        rating: v.rating?.count ? { value: v.rating.value, count: v.rating.count } : undefined,
      };
    }),
  };
}

export async function searchCatalog(params: SearchParams): Promise<SearchPage> {
  const filters: Record<string, unknown> = {
    available: true,
    ships_to: { country: params.country, ...(params.region ? { region: params.region } : {}), ...(params.postalCode ? { postal_code: params.postalCode } : {}) },
  };
  if (params.priceMin != null || params.priceMax != null) {
    filters.price = {
      ...(params.priceMin != null ? { min: Math.round(params.priceMin * 100) } : {}),
      ...(params.priceMax != null ? { max: Math.round(params.priceMax * 100) } : {}),
    };
  }
  const like = params.likeImage
    ? [{ image: { content_type: params.likeImage.contentType, data: params.likeImage.data } }]
    : params.likeId
      ? [{ id: params.likeId }]
      : undefined;

  const catalog: Record<string, unknown> = {
    ...(params.query ? { query: params.query } : {}),
    ...(like ? { like } : {}),
    filters,
    context: {
      address_country: params.country,
      ...(params.region ? { address_region: params.region } : {}),
      currency: params.currency,
      language: "en",
      ...(params.intent ? { intent: params.intent } : {}),
    },
    pagination: { limit: params.limit ?? 10, ...(params.cursor ? { cursor: params.cursor } : {}) },
  };

  // Image searches aren't cached (the key would be the whole image). Text searches are
  // cached for 10 minutes — inside Shopify's limit for price and availability.
  const run = async () => {
    const res = await callTool<SearchResult>(CATALOG_ENDPOINT, "search_catalog", { catalog });
    return {
      products: (res.products ?? []).map(normalise),
      messages: (res.messages ?? []).map((m) => m.content ?? m.code ?? "").filter(Boolean),
      nextCursor: res.pagination?.has_next_page && res.pagination.cursor ? res.pagination.cursor : undefined,
    };
  };
  if (params.likeImage) return run();
  const key = `search:${JSON.stringify(catalog)}`;
  return cached(key, TTL.priceAndAvailability, run);
}
