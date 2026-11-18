import { NextResponse, type NextRequest } from "next/server";
import { estimateArrival } from "@/lib/picks/pipeline";
import { buyerIp } from "@/lib/shopify/buyer-ip";
import { fullAddress } from "@/lib/countries";
import type { Occasion, Person } from "@/lib/types";

export const dynamic = "force-dynamic";

/** One pick's delivery estimate. The picks grid calls this as each card scrolls into view. */
export async function POST(req: NextRequest) {
  let body: { person: Person; occasion: Occasion; variantId: string; shopDomain: string; asOf?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body?.person || !body?.occasion || !body.variantId) return NextResponse.json({ error: "person, occasion and variantId are required" }, { status: 400 });
  const asOf = body.asOf && /^\d{4}-\d{2}-\d{2}$/.test(body.asOf) ? body.asOf : undefined;
  const ip = fullAddress(body.person) ? await buyerIp(req.headers) : undefined;
  const arrival = await estimateArrival(body.person, body.occasion, { variantId: body.variantId, shopDomain: body.shopDomain }, asOf, ip);
  return NextResponse.json({ arrival });
}
