import type { DomainEvent, SearchResponse } from "@lumen/domain";
import { routePaletteQuery, type PaletteRoute } from "./route.js";

export interface Endpoints {
  searchUrl: string;
  actionsUrl: string;
  docsUrl: string;
}

export interface ActionView {
  ok: boolean;
  changed?: boolean;
  message: string;
  code?: string;
  events?: DomainEvent[];
}

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

export type PaletteSuccess =
  | { ok: true; route: PaletteRoute; kind: "search"; response: SearchResponse }
  | { ok: true; route: PaletteRoute; kind: "actions"; response: ActionView }
  | { ok: true; route: PaletteRoute; kind: "docs"; response: DocsAnswer };

export type PaletteResult = PaletteSuccess | { ok: false; route: PaletteRoute; message: string };

export async function dispatchPalette(
  query: string,
  endpoints: Endpoints,
  fetchImpl: typeof fetch = fetch,
): Promise<PaletteResult> {
  const route = routePaletteQuery(query);
  try {
    if (route.target === "search") {
      const url = new URL("/search", endpoints.searchUrl);
      url.searchParams.set("q", query);
      const response = await readJson<SearchResponse>(fetchImpl, url);
      return { ok: true, route, kind: "search", response };
    }
    if (route.target === "actions") {
      if (!route.action) {
        return { ok: false, route, message: "That operation could not be read." };
      }
      const response = await readJson<ActionView>(fetchImpl, new URL("/actions", endpoints.actionsUrl), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(route.action),
      });
      return { ok: true, route, kind: "actions", response };
    }
    const response = await readJson<DocsAnswer>(fetchImpl, new URL("/ask", endpoints.docsUrl), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: query }),
    });
    return { ok: true, route, kind: "docs", response };
  } catch (error) {
    const message = error instanceof Error ? error.message : "The desk could not reach a service.";
    return { ok: false, route, message };
  }
}

async function readJson<T>(fetchImpl: typeof fetch, url: URL, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetchImpl(url, init);
  } catch {
    throw new Error(`Could not reach ${url.origin}.`);
  }
  const body = (await response.json()) as T & { message?: string };
  if (!response.ok && response.status >= 500) {
    throw new Error(body.message || `Service error from ${url.origin}.`);
  }
  return body;
}
