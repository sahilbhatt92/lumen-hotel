import { isCommand, perform, type DomainEvent, type HotelStore } from "@lumen/domain";
import { createApp, readJson, sendJson, type RequestHandler } from "@lumen/http";
import type http from "node:http";

export function createActionsServer(store: HotelStore): http.Server {
  const clients = new Set<http.ServerResponse>();

  const publish = (event: DomainEvent) => {
    const frame = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of clients) client.write(frame);
  };

  const handle: RequestHandler = async (req, res, url) => {
    if (url.pathname === "/health") {
      sendJson(res, 200, { ok: true, service: "actions", businessDate: store.read().businessDate });
      return;
    }
    if (url.pathname === "/state" && req.method === "GET") {
      sendJson(res, 200, store.read());
      return;
    }
    if (url.pathname === "/events" && req.method === "GET") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write(": connected\n\n");
      clients.add(res);
      req.on("close", () => clients.delete(res));
      return;
    }
    if (url.pathname === "/actions" && req.method === "POST") {
      const body = await readJson(req);
      if (!isCommand(body)) {
        sendJson(res, 400, { ok: false, message: "Unknown operation." });
        return;
      }
      const outcome = store.transact((state) => perform(state, body));
      if (outcome.ok && outcome.changed) {
        for (const event of outcome.events) publish(event);
      }
      const status = outcome.ok ? 200 : outcome.code === "not_found" ? 404 : 422;
      sendJson(res, status, {
        ok: outcome.ok,
        changed: outcome.ok ? outcome.changed : false,
        message: outcome.message,
        code: outcome.ok ? undefined : outcome.code,
        events: outcome.ok ? outcome.events : [],
      });
      return;
    }
    sendJson(res, 404, { ok: false, message: "Not found." });
  };

  return createApp(handle);
}
