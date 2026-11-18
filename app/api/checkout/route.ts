import { NextResponse, type NextRequest } from "next/server";
import { createCheckout, selectShipping, type CheckoutSummary } from "@/lib/shopify/checkout";
import { buyerIp } from "@/lib/shopify/buyer-ip";
import { ShopifyError } from "@/lib/shopify/mcp";
import { estimate } from "@/lib/delivery";
import { todayISO } from "@/lib/dates";
import type { Address } from "@/lib/types";

export const dynamic = "force-dynamic";

type Body = {
  action: "create" | "select";
  shopDomain: string;
  variantId: string;
  address: Address;
  currency: string;
  buyerEmail?: string;
  occasionDate: string;
  occasionTitle?: string;
  asOf?: string;
  // select only
  checkoutId?: string;
  lineItemIds?: string[];
  groupId?: string;
  optionId?: string;
};

function respond(summary: CheckoutSummary, body: Body) {
  const arrival = estimate(summary.options, body.occasionDate, body.asOf ?? todayISO());
  return NextResponse.json({
    checkout: {
      id: summary.id,
      status: summary.status,
      currency: summary.currency,
      subtotal: summary.subtotal,
      shipping: summary.shipping,
      total: summary.total,
      selectedOptionId: summary.selectedOptionId,
      groupId: summary.groupId,
      lineItemIds: summary.lineItemIds,
      messages: summary.messages,
      continueUrl: summary.continueUrl, // shown to this buyer only, never logged
      expiresAt: summary.expiresAt,
    },
    arrival,
  });
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.shopDomain || !body.variantId || !body.address) {
    return NextResponse.json({ error: "shopDomain, variantId and address are required" }, { status: 400 });
  }
  const ip = await buyerIp(req.headers);
  if (!ip) return NextResponse.json({ error: "Couldn't determine the buyer's IP address, which Shopify requires for checkout." }, { status: 400 });

  const base = {
    shopDomain: body.shopDomain,
    variantId: body.variantId,
    address: body.address,
    currency: body.currency,
    buyerEmail: body.buyerEmail || undefined,
    intent: body.occasionTitle ? `${body.occasionTitle} gift; needs to arrive before ${body.occasionDate}` : undefined,
    buyerIp: ip,
  };

  try {
    if (body.action === "select") {
      if (!body.checkoutId || !body.groupId || !body.optionId || !body.lineItemIds?.length) {
        return NextResponse.json({ error: "checkoutId, groupId, optionId and lineItemIds are required" }, { status: 400 });
      }
      const summary = await selectShipping({
        ...base,
        checkoutId: body.checkoutId,
        groupId: body.groupId,
        optionId: body.optionId,
        lineItemIds: body.lineItemIds,
      });
      return respond(summary, body);
    }
    return respond(await createCheckout(base), body);
  } catch (e) {
    const message = e instanceof ShopifyError ? e.message : "The shop's checkout didn't respond.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
