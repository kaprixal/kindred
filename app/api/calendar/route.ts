import { NextResponse } from "next/server";
import { readDemoCalendar } from "@/lib/occasions/holiday-dates";

export const dynamic = "force-dynamic";

/** The bundled demo calendar (fixtures/calendar.ics). Uploaded calendars are parsed in the browser. */
export async function GET() {
  try {
    const { name, events } = await readDemoCalendar();
    return NextResponse.json({ name, events });
  } catch {
    return NextResponse.json({ name: undefined, events: [] });
  }
}
