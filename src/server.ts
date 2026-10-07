import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createExpressApp } from "./express/app.js";
import { createNestApp } from "./nest/app.js";

const root = dirname(fileURLToPath(import.meta.url));
const publicDir = join(root, "..", "public");
const headers = {
  "cache-control": "no-store",
  "content-security-policy": "default-src 'self'; connect-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'",
  "referrer-policy": "no-referrer",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "x-content-type-options": "nosniff"
};

const send = (res: ServerResponse, status: number, body: string, contentType: string): void => {
  res.writeHead(status, { ...headers, "content-type": contentType });
  res.end(body);
};
const staticFile = async (res: ServerResponse, path: string): Promise<boolean> => {
  const safeName = path === "/" ? "index.html" : path.slice(1);
  if (!/^[a-z0-9._-]+$/i.test(safeName)) return false;
  const file = join(publicDir, safeName);
  try { await access(file); } catch { return false; }
  const type = safeName.endsWith(".css") ? "text/css; charset=utf-8" : safeName.endsWith(".js") ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8";
  res.writeHead(200, { ...headers, "content-type": type });
  createReadStream(file).pipe(res);
  return true;
};

const json = (res: ServerResponse, status: number, body: unknown): void => {
  send(res, status, JSON.stringify(body), "application/json; charset=utf-8");
};

export type PublicServer = { url: string; fetch(path: string, init?: RequestInit): Promise<Response>; close(): Promise<void>; [Symbol.asyncDispose](): Promise<void> };
export type ServerOptions = { port?: number; host?: string };

export const createPublicServer = async ({ port = Number(process.env.PORT ?? 3000), host = "0.0.0.0" }: ServerOptions = {}): Promise<PublicServer> => {
  const expressApp = createExpressApp();
  const nestApp = await createNestApp();
  const expressHandler = expressApp;
  const nestHandler = nestApp.getHttpAdapter().getInstance();
  const server = createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/health") return json(res, 200, { status: "ok" });
    if (req.method === "GET" && req.url === "/version") return json(res, 200, { service: "api-security-12-ideas", commit: process.env.RENDER_GIT_COMMIT ?? "development" });
    if (req.method === "GET" && !req.url?.startsWith("/api/")) {
      const pathname = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
      if (await staticFile(res, pathname)) return;
      return json(res, 404, { error: "not_found", message: "Not found" });
    }
    const match = req.url?.match(/^\/api\/(express|nest)(\/.*)?$/);
    if (!match) return json(res, req.method === "GET" ? 404 : 405, { error: req.method === "GET" ? "not_found" : "method_not_allowed", message: "Not found" });
    const handler = match[1] === "express" ? expressHandler : nestHandler;
    const originalUrl = req.url;
    req.url = match[2] || "/";
    await new Promise<void>(resolve => {
      res.once("finish", resolve);
      handler(req, res);
    });
    req.url = originalUrl;
  });
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(port, host, resolve); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server address unavailable");
  return {
    url: `http://127.0.0.1:${address.port}`,
    fetch: (path, init) => fetch(`http://127.0.0.1:${address.port}${path}`, init),
    close: () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())),
    [Symbol.asyncDispose]: async () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = await createPublicServer();
  process.once("SIGTERM", () => void server.close().then(() => process.exit(0)));
  process.once("SIGINT", () => void server.close().then(() => process.exit(0)));
}
