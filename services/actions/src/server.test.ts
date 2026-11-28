import { MemoryStore } from "@lumen/domain/server";
import { close, listen } from "@lumen/http";
import type http from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createActionsServer } from "./server.js";

let server: http.Server | undefined;

afterEach(async () => {
  if (server) await close(server);
  server = undefined;
});

describe("actions service", () => {
  it("checks a guest in, persists the stay, and emits a desk event", async () => {
    const store = new MemoryStore();
    server = createActionsServer(store);
    const port = await listen(server, 0);
    const base = `http://127.0.0.1:${port}`;

    const stream = await fetch(`${base}/events`, { headers: { accept: "text/event-stream" } });
    const reader = stream.body?.getReader();
    expect(reader).toBeTruthy();
    if (!reader) return;
    await readUntil(reader, (frame) => frame.includes(": connected"));

    const response = await fetch(`${base}/actions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "check_in", reservationId: "LH-1842" }),
    });
    const body = (await response.json()) as { ok: boolean; message: string; events: { type: string }[] };
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.message).toMatch(/Amina Shah is in house in room 214/);
    expect(body.events.map((event) => event.type)).toEqual(["reservation.upserted", "room.updated"]);

    const frame = await readUntil(reader, (chunk) => chunk.includes("reservation.upserted"));
    expect(frame).toMatch(/"status":"in_house"/);
    await reader.cancel();

    const saved = store.read();
    expect(saved.reservations.find((item) => item.id === "LH-1842")?.status).toBe("in_house");
    expect(saved.rooms.find((room) => room.number === "214")?.status).toBe("occupied");
  });
});

async function readUntil(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  ready: (buffer: string) => boolean,
): Promise<string> {
  const decoder = new TextDecoder();
  let buffer = "";
  const started = Date.now();
  while (Date.now() - started < 5000) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    if (ready(buffer)) return buffer;
  }
  throw new Error(`Timed out waiting for a server event. Saw: ${buffer}`);
}
