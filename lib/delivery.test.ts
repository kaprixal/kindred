import { describe, expect, it } from "vitest";
import { estimate, parseRange } from "./delivery";

describe("parseRange", () => {
  // 2026-11-20 is a Friday
  it("counts business days", () => {
    expect(parseRange("1 to 3 business days", "2026-11-20")).toEqual({ earliest: "2026-11-23", latest: "2026-11-25" });
  });
  it("handles dashes and plain days", () => {
    expect(parseRange("3–5 days", "2026-11-20")).toEqual({ earliest: "2026-11-23", latest: "2026-11-25" });
  });
  it("handles a single number", () => {
    expect(parseRange("Arrives in 4 business days", "2026-11-20")?.latest).toBe("2026-11-26");
  });
  it("handles explicit dates, rolling into next year", () => {
    expect(parseRange("Arrives Jan 12-15 via FedEx", "2026-12-20")).toEqual({ earliest: "2027-01-12", latest: "2027-01-15", absolute: true });
  });
  it("returns undefined when there's nothing to parse", () => {
    expect(parseRange("Standard", "2026-11-20")).toBeUndefined();
  });
});

describe("estimate (live Meimei Fine Teas options, Lunar New Year 2027)", () => {
  const options = [
    { id: "dhl", title: "DHL Express Worldwide", description: "1 to 3 business days", cost: { amount: 5100, currency: "CAD" } },
    { id: "pmi", title: "Priority Mail International", description: "6 to 10 business days", cost: { amount: 6500, currency: "CAD" } },
  ];

  it("is on time in November and picks the cheapest on-time option", () => {
    const a = estimate(options, "2027-02-06", "2026-11-17");
    expect(a.status).toBe("on_time");
    expect(a.best?.optionId).toBe("dhl");
    expect(a.deadline).toBe("2027-02-05");
  });

  it("is tight when only the fast option makes it", () => {
    const a = estimate(options, "2027-02-06", "2027-01-27");
    expect(a.options.find((o) => o.optionId === "pmi")?.status).not.toBe("on_time");
    expect(a.best?.optionId).toBe("dhl");
  });

  it("is late when nothing can arrive", () => {
    expect(estimate(options, "2027-02-06", "2027-02-04").status).toBe("late");
  });

  it("is unknown when the shop gives no timing", () => {
    expect(estimate([{ id: "x", title: "Standard" }], "2027-02-06", "2026-11-17").status).toBe("unknown");
    expect(estimate([], "2027-02-06", "2026-11-17").status).toBe("unknown");
  });

  it("shifts a shop's absolute dates when simulating a later order date", () => {
    // Live text from a Canadian shop, seen on 2026-11-17.
    const opt = [{ id: "c", title: "Canada Shipping", description: "Wednesday, November 25–Friday, November 27" }];
    expect(estimate(opt, "2027-02-06", "2026-11-17", "2026-11-17").best?.latest).toBe("2026-11-27");
    const sim = estimate(opt, "2027-02-06", "2027-01-25", "2026-11-17");
    expect(sim.best?.latest).toBe("2027-02-04"); // +69 days, same lead time
    expect(sim.status).toBe("tight");
  });

  it("prefers merchant dates when given", () => {
    const a = estimate([{ id: "d", title: "Ground", earliest: "2027-02-01T00:00:00Z", latest: "2027-02-03T00:00:00Z" }], "2027-02-06", "2026-11-17", "2026-11-17");
    expect(a.best?.latest).toBe("2027-02-03");
    expect(a.status).toBe("on_time");
  });
});
