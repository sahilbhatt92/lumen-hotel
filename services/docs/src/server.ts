import { createApp, readJson, sendJson, type RequestHandler } from "@lumen/http";
import type http from "node:http";
import { answerQuestion, type AnswerDeps } from "./answer.js";
import { loadPolicyIndex } from "./corpus.js";

export interface DocsServerOptions {
  searchUrl?: string;
  actionsUrl?: string;
  fetchImpl?: typeof fetch;
}

export function createDocsServer(options: DocsServerOptions = {}): http.Server {
  const deps: AnswerDeps = {
    index: loadPolicyIndex(),
    searchUrl: options.searchUrl ?? process.env.SEARCH_URL ?? "http://127.0.0.1:4001",
    actionsUrl: options.actionsUrl ?? process.env.ACTIONS_URL ?? "http://127.0.0.1:4002",
    fetchImpl: options.fetchImpl,
  };

  const handle: RequestHandler = async (req, res, url) => {
    if (url.pathname === "/health") {
      sendJson(res, 200, { ok: true, service: "docs" });
      return;
    }
    if (url.pathname === "/ask" && req.method === "POST") {
      const body = (await readJson(req)) as { question?: unknown };
      const question = typeof body.question === "string" ? body.question.trim() : "";
      if (!question) {
        sendJson(res, 400, { ok: false, message: "A question is required." });
        return;
      }
      sendJson(res, 200, await answerQuestion(question, deps));
      return;
    }
    sendJson(res, 404, { ok: false, message: "Not found." });
  };

  return createApp(handle);
}
