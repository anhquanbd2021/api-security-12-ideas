import { expect, test } from "./fixtures.js";

const auth = (token = "alice-token") => ({ authorization: `Bearer ${token}` });
const json = (token = "alice-token", extra: Record<string, string> = {}) => ({
  ...auth(token),
  "content-type": "application/json",
  ...extra
});
const frameworks = ["express", "nest"];

test.describe("public HTTP deployment", () => {
  for (const framework of frameworks) {
    test(`${framework} serves the security contract`, async ({ api }) => {
      expect((await api.get(`/api/${framework}/documents/document-1`)).status()).toBe(401);
      expect((await api.get(`/api/${framework}/documents/document-1`, { headers: auth("expired-token") })).status()).toBe(401);
      const owned = await api.get(`/api/${framework}/documents/document-1`, { headers: auth() });
      expect(owned.status()).toBe(200);
      expect((await owned.json()).title).toBe("Alice notes");
      expect((await api.get(`/api/${framework}/documents/document-2`, { headers: auth() })).status()).toBe(404);
      expect((await api.post(`/api/${framework}/documents`, { headers: json(), data: { title: "" } })).status()).toBe(400);
      expect((await api.post(`/api/${framework}/documents`, { headers: json("admin-token"), data: "{" })).status()).toBe(400);
      expect((await api.get(`/api/${framework}/missing`, { headers: auth("bob-token") })).status()).toBe(404);
    });
  }

  test("@smoke serves health, static files, and deployment headers", async ({ api }) => {
    const health = await api.get("/health");
    expect(health.status()).toBe(200);
    expect(await health.json()).toEqual({ status: "ok" });
    const version = await api.get("/version");
    expect(version.status()).toBe(200);
    expect(await version.json()).toEqual({ service: "api-security-12-ideas", commit: expect.any(String) });
    expect(health.headers()["content-security-policy"]).toContain("default-src 'self'");
    expect(health.headers()["x-content-type-options"]).toBe("nosniff");
    expect(health.headers()["referrer-policy"]).toBe("no-referrer");
    expect(health.headers()["permissions-policy"]).toContain("camera=()");
    expect(health.headers()["x-powered-by"]).toBeUndefined();
    expect((await api.get("/")).status()).toBe(200);
    expect((await api.get("/styles.css")).status()).toBe(200);
    expect((await api.get("/app.js")).status()).toBe(200);
    expect((await api.get("/test-cases.js")).status()).toBe(200);

    expect((await api.get("/missing")).status()).toBe(404);
    expect((await api.post("/health")).status()).toBe(405);
  });

  test("preserves safe request IDs and replaces invalid IDs", async ({ api }) => {
    const supplied = await api.get("/api/express/documents/document-1", { headers: { ...auth(), "x-request-id": "e2e-request-1" } });
    expect(supplied.headers()["x-request-id"]).toBe("e2e-request-1");
    const invalid = await api.get("/api/express/documents/document-1", { headers: { ...auth(), "x-request-id": "bad id" } });
    expect(invalid.headers()["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("enforces payload limits, safe failures, rate limits, and payment idempotency", async ({ api }) => {
    expect((await api.post("/api/express/documents", { headers: json("admin-token"), data: { title: "x".repeat(9_000) } })).status()).toBe(413);
    const failure = await api.get("/api/express/failure", { headers: auth("admin-token") });
    expect(failure.status()).toBe(500);
    expect(await failure.text()).not.toMatch(/stack|password|internal-host|src\\/i);

    for (let index = 0; index < 3; index++) expect((await api.get("/api/nest/documents/document-1", { headers: auth("bob-token") })).status()).toBe(404);
    const limited = await api.get("/api/nest/documents/document-1", { headers: auth("bob-token") });
    expect(limited.status()).toBe(429);
    expect(limited.headers()["retry-after"]).toBeTruthy();

    const key = `e2e-payment-${Date.now()}`;
    const headers = json("alice-token", { "idempotency-key": key });
    const first = await api.post("/api/express/payments", { headers, data: { amount: 2500 } });
    expect(first.status()).toBe(201);
    const replay = await api.post("/api/express/payments", { headers, data: { amount: 2500 } });
    expect(replay.status()).toBe(200);
    expect((await replay.json()).id).toBe((await first.json()).id);
    expect((await api.post("/api/express/payments", { headers, data: { amount: 2600 } })).status()).toBe(409);
  });
});
