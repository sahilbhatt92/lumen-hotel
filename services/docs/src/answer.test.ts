import { MemoryStore } from "@lumen/domain/server";
import { close, listen } from "@lumen/http";
import type http from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createActionsServer } from "../../actions/src/server.js";
import { createSearchServer } from "../../search/src/server.js";
import { answerQuestion } from "./answer.js";
import { loadPolicyIndex } from "./corpus.js";
import { createDocsServer } from "./server.js";

let servers: http.Server[] = [];

afterEach(async () => {
  await Promise.all(servers.map((server) => close(server)));
  servers = [];
  delete process.env.OPENAI_API_KEY;
});

describe("docs retrieval and tools", () => {
  it("answers a policy question from the local index and does not call a model", async () => {
    let modelCalled = false;
    const answer = await answerQuestion("what is the fee-free cancellation window?", {
      index: loadPolicyIndex(),
      searchUrl: "http://127.0.0.1:9",
      actionsUrl: "http://127.0.0.1:9",
      fetchImpl: async () => {
        throw new Error("no service");
      },
      rewrite: async () => {
        modelCalled = true;
        return "should not be used";
      },
    });
    expect(modelCalled).toBe(false);
    expect(answer.tools).toEqual([]);
    expect(answer.citations[0]?.heading).toBe("Fee-free window");
    expect(answer.text).toMatch(/without a fee/i);
  });

  it("assesses a cancellation without changing the stay", async () => {
    const store = new MemoryStore();
    const urls = await boot(store);
    const answer = await ask(urls.docs, "can I cancel LH-1871 without a fee?");
    expect(answer.tools.some((tool) => tool.name === "assess_cancellation" && tool.ok)).toBe(true);
    expect(answer.tools.some((tool) => tool.service === "search")).toBe(true);
    expect(answer.text).toMatch(/no fee/i);
    expect(store.read().reservations.find((item) => item.id === "LH-1871")?.status).toBe("confirmed");
  });

  it("checks a guest in when the question is an order and cites identification", async () => {
    const store = new MemoryStore();
    const urls = await boot(store);
    const answer = await ask(urls.docs, "check in LH-1842 and quote the identification rule");
    expect(answer.tools.some((tool) => tool.name === "check_in" && tool.ok)).toBe(true);
    expect(answer.citations.some((citation) => /identification/i.test(`${citation.heading} ${citation.excerpt}`))).toBe(
      true,
    );
    expect(answer.text).toMatch(/in house/i);
    expect(store.read().reservations.find((item) => item.id === "LH-1842")?.status).toBe("in_house");
    expect(store.read().rooms.find((room) => room.number === "214")?.status).toBe("occupied");
  });
});

async function boot(store: MemoryStore): Promise<{ docs: number }> {
  const search = createSearchServer(store);
  const actions = createActionsServer(store);
  const searchPort = await listen(search, 0);
  const actionsPort = await listen(actions, 0);
  const docs = createDocsServer({
    searchUrl: `http://127.0.0.1:${searchPort}`,
    actionsUrl: `http://127.0.0.1:${actionsPort}`,
  });
  const docsPort = await listen(docs, 0);
  servers = [search, actions, docs];
  return { docs: docsPort };
}

async function ask(port: number, question: string): Promise<{
  text: string;
  citations: { heading: string; excerpt: string }[];
  tools: { service: string; name: string; ok: boolean }[];
}> {
  const response = await fetch(`http://127.0.0.1:${port}/ask`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question }),
  });
  expect(response.status).toBe(200);
  return response.json() as Promise<{
    text: string;
    citations: { heading: string; excerpt: string }[];
    tools: { service: string; name: string; ok: boolean }[];
  }>;
}
