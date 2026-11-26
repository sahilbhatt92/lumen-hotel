import { MemoryStore } from "@lumen/domain/server";
import { close, listen } from "@lumen/http";
import { afterEach, describe, expect, it } from "vitest";
import type http from "node:http";
import { createSearchServer } from "./server.js";

let server: http.Server | undefined;

afterEach(async () => {
  if (server) await close(server);
  server = undefined;
});

describe("search service", () => {
  it("returns a ranked room for a natural query", async () => {
    server = createSearchServer(new MemoryStore());
    const port = await listen(server, 0);
    const response = await fetch(`http://127.0.0.1:${port}/search?q=${encodeURIComponent("find room 214")}`);
    const body = (await response.json()) as { hits: { id: string }[] };
    expect(response.status).toBe(200);
    expect(body.hits[0]?.id).toBe("room-214");
  });
});
