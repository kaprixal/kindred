// UCP checkout against the merchant's own endpoint. Kindred has general access, so
// it never calls complete_checkout: the buyer finishes on the merchant via continue_url.

import "server-only";
import { callTool } from "./mcp";
import type { Address, Money } from "../types";
import type { RawOption } from "../delivery";

type RawTotal = { type: string; amount: number; display_text?: string };
type RawGroupOption = {
  id: string;
  title: string;
  description?: { plain?: string };
  carrier?: string;
  earliest_fulfillment_time?: string;
  latest_fulfillment_time?: string;
  totals?: RawTotal[];
};
type RawCheckout = {
  id: string;
  status: string;
  currency?: string;
  totals?: RawTotal[];
  line_items?: { id: string; quantity: number; item?: { id: string; title?: string } }[];
  fulfillment?: {
    methods?: {
      id?: string;
      type: string;
      line_item_ids?: string[];
      selected_destination_id?: string;
      destinations?: Record<string, unknown>[];
      groups?: { id: string; line_item_ids: string[]; selected_option_id?: string | null; options?: RawGroupOption[] }[];
    }[];
  };
  messages?: { type: string; code?: string; content?: string; severity?: string; path?: string }[];
  continue_url?: string;
  expires_at?: string;
};

export type CheckoutSummary = {
  id: string;
  status: string;
  currency: string;
  subtotal?: Money;
  shipping?: Money;
  total?: Money;
  options: RawOption[];
  selectedOptionId?: string;
  groupId?: string;
  methodId?: string;
  lineItemIds: string[];
  messages: { code?: string; content: string; severity?: string }[];
  continueUrl?: string;
  expiresAt?: string;
};

export function toDestination(a: Address) {
  return {
    first_name: a.firstName,
    last_name: a.lastName,
    street_address: a.street,
    ...(a.extended ? { extended_address: a.extended } : {}),
    address_locality: a.locality,
    ...(a.region ? { address_region: a.region } : {}),
    ...(a.postalCode ? { postal_code: a.postalCode } : {}),
    address_country: a.country,
    ...(a.phone ? { phone_number: a.phone } : {}),
  };
}

function summarise(c: RawCheckout): CheckoutSummary {
  const currency = c.currency ?? "USD";
  const total = (type: string) => {
    const t = c.totals?.find((x) => x.type === type);
    return t ? { amount: t.amount, currency } : undefined;
  };
  const method = c.fulfillment?.methods?.find((m) => m.type === "shipping");
  const group = method?.groups?.[0];
  const options: RawOption[] = (group?.options ?? []).map((o) => ({
    id: o.id,
    title: o.title,
    description: o.description?.plain,
    carrier: o.carrier,
    earliest: o.earliest_fulfillment_time,
    latest: o.latest_fulfillment_time,
    cost: (() => {
      const t = o.totals?.find((x) => x.type === "total") ?? o.totals?.[0];
      return t ? { amount: t.amount, currency } : undefined;
    })(),
  }));
  return {
    id: c.id,
    status: c.status,
    currency,
    subtotal: total("subtotal"),
    shipping: total("fulfillment"),
    total: total("total"),
    options,
    selectedOptionId: group?.selected_option_id ?? undefined,
    groupId: group?.id,
    methodId: method?.id,
    lineItemIds: (c.line_items ?? []).map((l) => l.id),
    messages: (c.messages ?? []).map((m) => ({ code: m.code, content: m.content ?? m.code ?? "", severity: m.severity })),
    continueUrl: safeContinueUrl(c.continue_url),
    expiresAt: c.expires_at,
  };
}

/** Only https URLs are shown; attribution is added with a URL parser. Never logged. */
export function safeContinueUrl(raw?: string): string | undefined {
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return undefined;
    if (!u.searchParams.has("utm_source")) u.searchParams.set("utm_source", "kindred");
    if (!u.searchParams.has("utm_medium")) u.searchParams.set("utm_medium", "gift_assistant");
    return u.toString();
  } catch {
    return undefined;
  }
}

function endpoint(shopDomain: string): string {
  if (!/^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$/i.test(shopDomain)) throw new Error("Invalid shop domain");
  return `https://${shopDomain}/api/ucp/mcp`;
}

export type CreateInput = {
  shopDomain: string;
  variantId: string;
  address: Address;
  currency: string;
  buyerEmail?: string;
  intent?: string;
  buyerIp: string;
};

export async function createCheckout(input: CreateInput): Promise<CheckoutSummary> {
  const checkout: Record<string, unknown> = {
    currency: input.currency,
    line_items: [{ quantity: 1, item: { id: input.variantId } }],
    context: {
      address_country: input.address.country,
      ...(input.address.region ? { address_region: input.address.region } : {}),
      ...(input.address.postalCode ? { postal_code: input.address.postalCode } : {}),
      currency: input.currency,
      ...(input.intent ? { intent: input.intent } : {}),
    },
    fulfillment: { methods: [{ type: "shipping", destinations: [toDestination(input.address)] }] },
  };
  if (input.buyerEmail) checkout.buyer = { email: input.buyerEmail };
  const raw = await callTool<RawCheckout>(endpoint(input.shopDomain), "create_checkout", { checkout }, { buyerIp: input.buyerIp });
  return summarise(raw);
}

export type SelectInput = CreateInput & {
  checkoutId: string;
  lineItemIds: string[];
  groupId: string;
  optionId: string;
};

/** update_checkout replaces the whole checkout, so we resend everything plus the chosen option. */
export async function selectShipping(input: SelectInput): Promise<CheckoutSummary> {
  const checkout: Record<string, unknown> = {
    currency: input.currency,
    line_items: input.lineItemIds.map((id) => ({ id, quantity: 1, item: { id: input.variantId } })),
    fulfillment: {
      methods: [
        {
          type: "shipping",
          line_item_ids: input.lineItemIds,
          destinations: [toDestination(input.address)],
          groups: [{ id: input.groupId, line_item_ids: input.lineItemIds, selected_option_id: input.optionId }],
        },
      ],
    },
  };
  if (input.buyerEmail) checkout.buyer = { email: input.buyerEmail };
  const raw = await callTool<RawCheckout>(
    endpoint(input.shopDomain),
    "update_checkout",
    { id: input.checkoutId, checkout },
    { buyerIp: input.buyerIp },
  );
  return summarise(raw);
}
