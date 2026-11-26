import { describe, expect, it } from "vitest";
import { dispatchPalette } from "./dispatch.js";
import { parseAction } from "./parse.js";
import { routePaletteQuery } from "./route.js";

describe("palette routing", () => {
  it("sends lookups to search", () => {
    expect(routePaletteQuery("find room 214").target).toBe("search");
    expect(routePaletteQuery("who is in room 305?").target).toBe("search");
    expect(routePaletteQuery("Amina Shah").target).toBe("search");
  });

  it("sends imperatives to actions", () => {
    const checkIn = routePaletteQuery("check in LH-1842");
    expect(checkIn.target).toBe("actions");
    expect(checkIn.execute).toBe(true);
    expect(checkIn.action).toEqual({ name: "check_in", reservationId: "LH-1842" });

    const assign = routePaletteQuery("assign room 222 to LH-1860");
    expect(assign.target).toBe("actions");
    expect(assign.action).toMatchObject({ name: "assign_room", roomNumber: "222", reservationId: "LH-1860" });

    expect(routePaletteQuery("log housekeeping request for room 305: extra pillows").target).toBe("actions");
    expect(routePaletteQuery("please check out LH-1848").target).toBe("actions");
  });

  it("sends policy questions to docs without executing them", () => {
    const policy = routePaletteQuery("what is the cancellation policy?");
    expect(policy.target).toBe("docs");
    expect(policy.execute).toBe(false);
    expect(policy.action).toBeNull();

    const eligibility = routePaletteQuery("can I cancel LH-1871 without a fee?");
    expect(eligibility.target).toBe("docs");
    expect(eligibility.execute).toBe(false);
    expect(eligibility.action?.name).toBe("cancel_reservation");
  });

  it("sends an operation that also asks for a rule through docs", () => {
    const mixed = routePaletteQuery("check in LH-1842 and quote the identification rule");
    expect(mixed.target).toBe("docs");
    expect(mixed.execute).toBe(true);
    expect(mixed.action).toEqual({ name: "check_in", reservationId: "LH-1842" });
  });
});

describe("command parsing", () => {
  it("reads the supported desk commands", () => {
    expect(parseAction("book Elena Voss from 2026-12-01 to 2026-12-03")).toMatchObject({
      name: "create_reservation",
      guestName: "Elena Voss",
      arrival: "2026-12-01",
      departure: "2026-12-03",
    });
    expect(parseAction("complete request SR-441")).toEqual({
      name: "advance_staff_request",
      requestId: "SR-441",
    });
    expect(parseAction("what is the check-in procedure?")).toBeNull();
  });
});

describe("palette dispatch", () => {
  const endpoints = {
    searchUrl: "http://search.test",
    actionsUrl: "http://actions.test",
    docsUrl: "http://docs.test",
  };

  it("calls only the search service for a lookup", async () => {
    const seen: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      seen.push(url);
      return json({ businessDate: "2026-11-26", query: "room 214", hits: [] });
    };
    const result = await dispatchPalette("find room 214", endpoints, fetchImpl);
    expect(result.ok && result.kind).toBe("search");
    expect(seen).toEqual(["http://search.test/search?q=find+room+214"]);
  });

  it("posts a check-in to the actions service", async () => {
    let body = "";
    const fetchImpl: typeof fetch = async (_input, init) => {
      body = String(init?.body ?? "");
      return json({ ok: true, changed: true, message: "Amina Shah is in house in room 214." });
    };
    const result = await dispatchPalette("check in LH-1842", endpoints, fetchImpl);
    expect(result.ok && result.kind).toBe("actions");
    expect(JSON.parse(body)).toEqual({ name: "check_in", reservationId: "LH-1842" });
    if (result.ok && result.kind === "actions") {
      expect(result.response.message).toMatch(/in house/i);
    }
  });

  it("asks the docs service for a policy question", async () => {
    const seen: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      seen.push(String(input));
      return json({ question: "policy", text: "Fee-free window.", citations: [], tools: [] });
    };
    const result = await dispatchPalette("what is the cancellation policy?", endpoints, fetchImpl);
    expect(seen).toEqual(["http://docs.test/ask"]);
    expect(result.ok && result.kind).toBe("docs");
  });
});

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
