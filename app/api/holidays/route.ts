import { NextResponse } from "next/server";
import { holidayDates } from "@/lib/occasions/holiday-dates";

export const dynamic = "force-dynamic";

export async function GET() {
  const { dates, live, failed } = await holidayDates();
  return NextResponse.json({ dates, liveFeeds: live.length, failedFeeds: failed.length });
}
