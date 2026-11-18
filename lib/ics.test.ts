import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { birthdayName, parseIcs, relationshipFrom } from "./ics";
import { birthdayOccasions, peopleFromCalendar } from "./occasions/build";

const demo = readFileSync(new URL("../fixtures/calendar.ics", import.meta.url), "utf8");

describe("demo calendar", () => {
  const events = parseIcs(demo);

  it("reads all 33 events", () => expect(events).toHaveLength(33));

  it("finds 8 people with relationships", () => {
    const people = peopleFromCalendar(events, "CAD");
    expect(people).toHaveLength(8);
    expect(people.find((p) => p.id === "nai-nai")?.relationship).toBe("Grandmother");
    expect(people.find((p) => p.id === "ma")?.relationship).toBe("Mom");
  });

  it("keeps Nai Nai's lunar birthday as a one-off, and rolls yearly birthdays forward", () => {
    const occ = birthdayOccasions(events, "2026-11-17");
    const nn = occ.find((o) => o.personIds[0] === "nai-nai");
    expect(nn?.date).toBe("2027-04-14");
    expect(nn?.lunar).toBe(true);
    expect(occ.find((o) => o.personIds[0] === "ma")?.date).toBe("2026-12-03");
  });

  it("unfolds long description lines", () => {
    const nn = events.find((e) => e.summary.startsWith("Nai Nai"));
    expect(nn?.description).toContain("lunar calendar (3rd month, 8th day)");
  });
});

describe("helpers", () => {
  it("parses names", () => {
    expect(birthdayName("Ji-woo's birthday")).toBe("Ji-woo");
    expect(birthdayName("Birthday: Sam")).toBe("Sam");
    expect(birthdayName("Diwali")).toBeUndefined();
  });
  it("parses relationships", () => expect(relationshipFrom("Birthday. Relationship: Friend")).toBe("Friend"));
});
