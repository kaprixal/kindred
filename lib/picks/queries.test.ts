import { describe, expect, it } from "vitest";
import { facetsFor } from "./queries";

const she = { subject: "she", possessive: "her" };
const they = { subject: "they", possessive: "their" };

describe("facetsFor", () => {
  it("splits matcha into a whisk, a bowl & cup set, and matcha itself", () => {
    const f = facetsFor(["Matcha"]);
    expect(f.map((x) => x.label)).toEqual(["Whisk", "Bowl & cup set", "Matcha"]);
    expect(f[0].why(she)).toBe("For whisking her matcha");
    expect(f[2].why(they)).toBe("They're into matcha");
  });

  it("splits Miffy into keychains, apparel and plushies", () => {
    expect(facetsFor(["Miffy"]).map((x) => x.label)).toEqual(["Keychain", "Apparel", "Plush"]);
  });

  it("gives unknown interests generic variety", () => {
    const f = facetsFor(["Pickleball"]);
    expect(f.map((x) => x.query)).toEqual(["Pickleball", "Pickleball gift set", "Pickleball accessories"]);
    expect(f[0].why(they)).toBe("Matches their interest in pickleball");
  });

  it("keeps facet keys unique across interests", () => {
    const keys = facetsFor(["Matcha", "Miffy", "Oolong tea"]).map((x) => x.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
