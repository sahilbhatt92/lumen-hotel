import http from "node:http";

export type RequestHandler = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
) => Promise<void> | void;

export function createApp(handle: RequestHandler): http.Server {
  return http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
    res.setHeader("Cache-Control", "no-store");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    try {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      await handle(req, res, url);
    } catch (error) {
      const syntax = error instanceof SyntaxError;
      sendJson(res, syntax ? 400 : 500, {
        ok: false,
        message: syntax ? "The request body was not valid JSON." : "Unexpected error.",
      });
    }
  });
}

export function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  if (res.headersSent) return;
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

export async function readJson(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > 1_000_000) throw new Error("Body too large");
    chunks.push(buffer);
  }
  if (total === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function listen(server: http.Server, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "0.0.0.0", () => {
      const address = server.address();
      resolve(address && typeof address === "object" ? address.port : port);
    });
  });
}

export function close(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
