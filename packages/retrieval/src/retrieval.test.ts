import { describe, expect, it } from "vitest";
import { Bm25Index, selectSentences } from "./bm25.js";
import { chunkMarkdown } from "./chunk.js";

const cancellation = `# Cancellation and deposits

Harbor House takes a first-night deposit when a reservation is confirmed.

## Fee-free window

A confirmed reservation can be cancelled without a fee when the business date is at least two nights before the arrival date. The deposit is released back to the original method.

## Inside the window

When arrival is tomorrow or today, a cancellation forfeits the first night.
`;

const housekeeping = `# Housekeeping

## Departure clean

A departure room is marked dirty at check-out. Front desk does not check a new guest into a dirty room.
`;

const checkIn = `# Check-in

## Identification

Ask for a government photo identification and match the name to the reservation. Do not copy the document into the desk notes.
`;

describe("policy retrieval", () => {
  const chunks = [
    ...chunkMarkdown("cancellation", cancellation),
    ...chunkMarkdown("housekeeping", housekeeping),
    ...chunkMarkdown("check-in", checkIn),
  ];
  const index = new Bm25Index(chunks);

  it("chunks a policy on its headings", () => {
    const parts = chunkMarkdown("cancellation", cancellation);
    expect(parts.map((part) => part.heading)).toEqual(["Overview", "Fee-free window", "Inside the window"]);
  });

  it("ranks the fee-free cancellation passage first", () => {
    const hits = index.search("how long before arrival can a guest cancel without a fee");
    expect(hits[0]?.chunk.heading).toBe("Fee-free window");
    expect(hits[0]?.chunk.documentId).toBe("cancellation");
    expect(hits[0]?.score).toBeGreaterThan(hits[1]?.score ?? 0);
  });

  it("finds the identification rule rather than housekeeping", () => {
    const hits = index.search("government photo identification at check-in");
    expect(hits[0]?.chunk.heading).toBe("Identification");
  });

  it("prefers a specific section over a short overview", () => {
    const late = chunkMarkdown(
      "late-checkout",
      `# Late checkout

Checkout at Harbor House is a morning event.

## Standard departure

Checkout is 11:00 on the departure date. At check-out the room becomes dirty.
`,
    );
    const hits = new Bm25Index(late).search("what is the late checkout policy");
    expect(hits[0]?.chunk.heading).toBe("Standard departure");
  });

  it("selects the sentence that overlaps the question", () => {
    const excerpt = selectSentences(chunks[1]?.text ?? "", "cancel without a fee", 1);
    expect(excerpt).toMatch(/without a fee/i);
  });
});
