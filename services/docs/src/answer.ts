import type { Command, SearchResponse } from "@lumen/domain";
import { routePaletteQuery } from "@lumen/palette";
import { selectSentences, type Bm25Index } from "@lumen/retrieval";
import { rewriteWithOpenAI, type RewriteInput } from "./rewrite.js";

export interface Citation {
  id: string;
  title: string;
  heading: string;
  excerpt: string;
}

export interface ToolNote {
  service: "search" | "actions";
  name: string;
  ok: boolean;
  detail: string;
}

export interface DocsAnswer {
  question: string;
  text: string;
  citations: Citation[];
  tools: ToolNote[];
}

export interface ActionPayload {
  ok: boolean;
  message: string;
}

export interface AnswerDeps {
  index: Bm25Index;
  searchUrl: string;
  actionsUrl: string;
  fetchImpl?: typeof fetch;
  rewrite?: (input: RewriteInput) => Promise<string | null>;
}

export async function answerQuestion(question: string, deps: AnswerDeps): Promise<DocsAnswer> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const route = routePaletteQuery(question);
  const passages = deps.index.search(question, 3);
  const tools: ToolNote[] = [];
  const citations: Citation[] = passages.map((hit) => ({
    id: hit.chunk.id,
    title: hit.chunk.title,
    heading: hit.chunk.heading,
    excerpt: excerptFor(hit.chunk.text, question),
  }));

  let actionNote = "";
  if (route.action) {
    const command = route.execute ? route.action : assessmentFor(route.action);
    if (command) {
      const result = await postAction(fetchImpl, deps.actionsUrl, command);
      tools.push({
        service: "actions",
        name: command.name,
        ok: result.ok,
        detail: result.message,
      });
      actionNote = result.message;
    }
  }

  let searchNote = "";
  if (needsSearch(question, Boolean(route.action))) {
    const result = await getSearch(fetchImpl, deps.searchUrl, question);
    const top = result.hits[0];
    searchNote = top ? `Desk record: ${top.title}. ${top.subtitle}.` : "No matching desk record.";
    tools.push({
      service: "search",
      name: "search",
      ok: true,
      detail: searchNote,
    });
  }

  const policyBit = passages[0]
    ? `${passages[0].chunk.title} — ${passages[0].chunk.heading}. ${citations[0]?.excerpt ?? ""}`.trim()
    : "Nothing in the Harbor House policy set matches that.";
  const ordered = route.execute ? [actionNote, policyBit, searchNote] : [policyBit, actionNote, searchNote];
  let text = ordered.filter(Boolean).join("\n\n");

  if (process.env.OPENAI_API_KEY) {
    const rewrite = deps.rewrite ?? rewriteWithOpenAI;
    const polished = await rewrite({
      question,
      draft: text,
      passages: citations.map((citation) => `${citation.title} — ${citation.heading}. ${citation.excerpt}`),
      toolNotes: tools.map((tool) => tool.detail),
    }).catch(() => null);
    if (polished) text = polished;
  }

  return { question, text, citations, tools };
}

function needsSearch(question: string, hasAction: boolean): boolean {
  return hasAction || /\b(?:LH-\d+|SR-\d+)\b/i.test(question) || /\broom\s+\d{3}\b/i.test(question);
}

function assessmentFor(command: Command): Command | null {
  if (command.name === "check_in") return { name: "assess_check_in", reservationId: command.reservationId };
  if (command.name === "cancel_reservation") {
    return { name: "assess_cancellation", reservationId: command.reservationId };
  }
  return null;
}

function excerptFor(text: string, question: string): string {
  const selected = selectSentences(text, question, 2);
  return (selected || text).replace(/\s+/g, " ").slice(0, 420);
}

async function postAction(fetchImpl: typeof fetch, actionsUrl: string, command: Command): Promise<ActionPayload> {
  try {
    const response = await fetchImpl(new URL("/actions", actionsUrl), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(command),
    });
    const body = (await response.json()) as Partial<ActionPayload>;
    return { ok: Boolean(body.ok), message: body.message || "The actions service returned no message." };
  } catch {
    return { ok: false, message: "The actions service is not reachable." };
  }
}

async function getSearch(fetchImpl: typeof fetch, searchUrl: string, question: string): Promise<SearchResponse> {
  try {
    const url = new URL("/search", searchUrl);
    url.searchParams.set("q", question);
    const response = await fetchImpl(url);
    return (await response.json()) as SearchResponse;
  } catch {
    return { businessDate: "", query: question, hits: [] };
  }
}
