import { describe, expect, it } from "vitest";
import { createSeedState } from "./seed.js";
import { searchOperations } from "./search.js";

describe("operational search", () => {
  const state = createSeedState();

  it("ranks the named room first", () => {
    const result = searchOperations(state, "find room 214");
    expect(result.hits[0]?.id).toBe("room-214");
    expect(result.hits[0]?.subtitle).toMatch(/inspected/i);
  });

  it("finds a guest and their stay", () => {
    const result = searchOperations(state, "Amina Shah");
    const kinds = result.hits.slice(0, 3).map((hit) => hit.kind);
    expect(kinds).toContain("guest");
    expect(result.hits.some((hit) => hit.id === "LH-1842")).toBe(true);
  });

  it("lists today's arrivals", () => {
    const result = searchOperations(state, "arrivals");
    const ids = result.hits.map((hit) => hit.id);
    expect(ids).toEqual(expect.arrayContaining(["LH-1842", "LH-1855", "LH-1860"]));
    expect(ids).not.toContain("LH-1848");
  });
});
