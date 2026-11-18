import { describe, expect, it } from "vitest";
import { activeRules, applyRules, freeTextMatchers } from "./filter";
import { CUSTOMS } from "../occasions/customs";

const lny = activeRules([CUSTOMS["no-clocks"], CUSTOMS["no-fours"], CUSTOMS["red-gold"], CUSTOMS["no-white-flowers"]]);
const product = (title: string, variants: string[] = ["Default"], optionsText = "") => ({
  title,
  variants: variants.map((v, i) => ({ id: `v${i}`, text: v })),
  optionsText,
});

describe("no sets of four", () => {
  it.each([
    "Chinese Oolong Tea Gift Set - Four Premium Teas 100g", // live catalog result
    "Celadon tea cups, set of 4",
    "4-piece porcelain tea set",
    "Pack of four candles",
    "4 pcs ceramic coasters",
  ])("filters %s", (title) => {
    const r = applyRules(product(title), lny);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.ruleId).toBe("no-fours");
  });

  it.each(["Dong Ding Oolong 4.75 oz tin", "Tea set for 6", "14 pcs bamboo set", "Set of 24 brushes", "Fourteen-day tea journey"])(
    "keeps %s",
    (title) => {
      expect(applyRules(product(title), lny).ok).toBe(true);
    },
  );

  it("filters when every variant is a four (live: Emperor's Oolong Bundle)", () => {
    const r = applyRules(product("Emperor's Oolong Bundle", ["Size: 4 x 25g Pouches", "Size: 4 x 50g Pouches", "Size: 4 x 100g Pouches"]), lny);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.evidence).toContain("4 x 25g");
  });

  it("keeps the product but drops the four-variant", () => {
    const r = applyRules(product("Celadon cups", ["Set of 2", "Set of 4", "Set of 6"]), lny);
    expect(r).toEqual({ ok: true, variantIds: ["v0", "v2"] });
  });
});

describe("no clocks", () => {
  it("filters clocks", () => expect(applyRules(product("Walnut desk clock"), lny).ok).toBe(false));
  it("doesn't match clockwise or o'clock-free names", () => expect(applyRules(product("Clockwise spiral planter"), lny).ok).toBe(true));
});

describe("white flowers", () => {
  it("filters chrysanthemums", () => expect(applyRules(product("Dried chrysanthemum bouquet"), lny).ok).toBe(false));
  it("keeps red roses", () => expect(applyRules(product("Red rose bouquet"), lny).ok).toBe(true));
});

describe("free text", () => {
  it("turns 'she doesn't drink, no wool' into rules", () => {
    const rules = freeTextMatchers("she doesn't drink, no wool");
    expect(rules.map((r) => r.id)).toEqual(["free:alcohol", "free:wool"]);
    expect(applyRules(product("Merino wool scarf"), rules).ok).toBe(false);
    expect(applyRules(product("Plum wine gift box"), rules).ok).toBe(false);
    expect(applyRules(product("Silk scarf"), rules).ok).toBe(true);
  });
});

describe("leather", () => {
  const rules = activeRules([CUSTOMS["no-leather"]]);
  it("ignores vegan leather", () => expect(applyRules(product("Vegan leather journal"), rules).ok).toBe(true));
  it("filters leather", () => expect(applyRules(product("Leather journal"), rules).ok).toBe(false));
});
