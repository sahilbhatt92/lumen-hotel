import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkIn } from "./actions.js";
import { createSeedState } from "./seed.js";
import { MemoryStore, openFileStore } from "@lumen/domain/server";

const files: string[] = [];

afterEach(() => {
  for (const file of files.splice(0)) fs.rmSync(file, { force: true });
});

describe("hotel store", () => {
  it("keeps an unchanged assessment out of memory", () => {
    const store = new MemoryStore();
    const before = store.read().revision;
    const outcome = store.transact((state) => checkIn({ ...state, businessDate: "2026-01-01" }, "LH-1842"));
    expect(outcome.ok).toBe(false);
    expect(store.read().revision).toBe(before);
  });

  it("writes a check-in through the shared file", () => {
    const file = path.join(os.tmpdir(), `lumen-${process.pid}-${Date.now()}.json`);
    files.push(file);
    fs.writeFileSync(file, JSON.stringify(createSeedState()));
    const writing = openFileStore(file);
    const reading = openFileStore(file);
    const outcome = writing.transact((state) => checkIn(state, "LH-1842"));
    expect(outcome.ok).toBe(true);
    expect(reading.read().reservations.find((item) => item.id === "LH-1842")?.status).toBe("in_house");
    expect(reading.read().rooms.find((room) => room.number === "214")?.status).toBe("occupied");
  });
});
