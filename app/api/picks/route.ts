import { NextResponse, type NextRequest } from "next/server";
import { buildPicks } from "@/lib/picks/pipeline";
import type { PicksRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: PicksRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body?.person || !body?.occasion) return NextResponse.json({ error: "person and occasion are required" }, { status: 400 });
  if (body.asOf && !/^\d{4}-\d{2}-\d{2}$/.test(body.asOf)) delete body.asOf;
  return NextResponse.json(await buildPicks(body));
}
