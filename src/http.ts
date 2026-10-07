import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { createIdentityProvider, createPaymentAndAudit, createStores } from "./simulators.js";
import type { Principal } from "./ports.js";

type Dependencies = ReturnType<typeof createDependencies>;
const createDependencies = () => ({ idp: createIdentityProvider(), stores: createStores(), external: createPaymentAndAudit() });

const json = (res: ServerResponse, status: number, body: unknown, requestId: string, extra: Record<string, string> = {}): void => {
  res.statusCode = status;
  for (const [key, value] of Object.entries({ "content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff", "x-request-id": requestId, ...extra })) res.setHeader(key, value);
  res.end(JSON.stringify(body));
};
const readBody = async (req: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
    if (chunks.reduce((size, item) => size + item.length, 0) > 8_192) throw new Error("payload");
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new Error("json"); }
};
const principal = async (req: IncomingMessage, deps: Dependencies, requestId: string): Promise<Principal> => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ") || !header.slice(7)) throw new Error("unauthorized");
  return deps.idp.authenticate(header.slice(7), requestId);
};

export const createHandler = (deps: Dependencies = createDependencies()) => async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
  const suppliedRequestId = req.headers["x-request-id"];
  const requestId = typeof suppliedRequestId === "string" && /^[A-Za-z0-9._:-]{1,128}$/.test(suppliedRequestId) ? suppliedRequestId : randomUUID();
  try {
    const user = await principal(req, deps, requestId);
    const limited = await deps.stores.redis.consume(user.id, 3, 60_000);
    if (!limited.allowed) return json(res, 429, { error: "rate_limited", message: "Too many requests", requestId }, requestId, { "retry-after": String(limited.retryAfter) });
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (req.method === "GET" && url.pathname.startsWith("/documents/")) {
      const document = await deps.stores.documents.findOwned(url.pathname.slice("/documents/".length), user.id);
      return json(res, document ? 200 : 404, document ?? { error: "not_found", message: "Not found", requestId }, requestId);
    }
    if (req.method === "POST" && url.pathname === "/documents") {
      const body = await readBody(req) as { title?: unknown };
      if (typeof body.title !== "string" || body.title.trim().length === 0 || body.title.length > 200) return json(res, 400, { error: "bad_request", message: "Invalid document", requestId }, requestId);
      const document = await deps.stores.documents.create(user.id, body.title);
      return json(res, 201, document, requestId);
    }
    if (req.method === "POST" && url.pathname === "/payments") {
      const body = await readBody(req) as { amount?: unknown };
      const key = req.headers["idempotency-key"];
      if (typeof key !== "string" || !/^[A-Za-z0-9._:-]{1,128}$/.test(key) || !Number.isInteger(body.amount) || Number(body.amount) <= 0) return json(res, 400, { error: "bad_request", message: "Invalid payment", requestId }, requestId);
      const before = deps.external.payments.chargeCount;
      const payment = await deps.external.payments.charge(user.id, key, Number(body.amount), requestId);
      await deps.external.audit.write({ actor: user.id, action: "payment", requestId, details: { result: "accepted" } });
      return json(res, before === 0 ? 201 : 200, payment, requestId);
    }
    if (req.method === "GET" && url.pathname === "/failure") throw new Error("internal failure database password internal-host");
    return json(res, 404, { error: "not_found", message: "Not found", requestId }, requestId);
  } catch (error) {
    const kind = error instanceof Error ? error.message : "";
    const message = kind === "unauthorized" ? "Authentication required" : kind === "payload" ? "Payload too large" : kind === "json" ? "Malformed JSON" : kind === "conflict" ? "Idempotency key conflict" : "Internal server error";
    const status = message === "Authentication required" ? 401 : message === "Payload too large" ? 413 : message === "Malformed JSON" ? 400 : message === "Idempotency key conflict" ? 409 : 500;
    return json(res, status, { error: status === 401 ? "unauthorized" : status === 400 ? "bad_request" : status === 409 ? "conflict" : status === 413 ? "payload_too_large" : "internal_error", message, requestId }, requestId);
  }
};
