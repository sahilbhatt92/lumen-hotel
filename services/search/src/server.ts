import { searchOperations, type HotelState } from "@lumen/domain";
import { createApp, sendJson, type RequestHandler } from "@lumen/http";
import type http from "node:http";

export interface StateReader {
  read(): HotelState;
}

export function createSearchServer(store: StateReader): http.Server {
  const handle: RequestHandler = (_req, res, url) => {
    if (url.pathname === "/health") {
      const state = store.read();
      sendJson(res, 200, { ok: true, service: "search", businessDate: state.businessDate });
      return;
    }
    if (url.pathname === "/search") {
      const query = url.searchParams.get("q") ?? "";
      sendJson(res, 200, searchOperations(store.read(), query));
      return;
    }
    sendJson(res, 404, { ok: false, message: "Not found." });
  };
  return createApp(handle);
}
