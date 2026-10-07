import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPublicServer } from "../../src/server.js";

const start = async () => createPublicServer({ port: 0, host: "127.0.0.1" });

describe("public deployment", () => {
  it("serves health and interactive site", async () => {
    await using app = await start();
    const health = await app.fetch("/health");
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: "ok" });
    const version = await app.fetch("/version");
    assert.equal(version.status, 200);
    assert.deepEqual(await version.json(), { service: "api-security-12-ideas", commit: "development" });
    const page = await app.fetch("/");
    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-type") ?? "", /text\/html/);
    assert.match(await page.text(), /Educational simulator/);
  });

  it("routes same behavior through both public framework paths", async () => {
    await using app = await start();
    for (const framework of ["express", "nest"]) {
      const response = await app.fetch(`/api/${framework}/documents/document-1`, { headers: { authorization: "Bearer alice-token" } });
      assert.equal(response.status, 200);
      assert.equal((await response.json() as { ownerId: string }).ownerId, "alice");
    }
  });

  it("sets public security headers and rejects unsupported methods", async () => {
    await using app = await start();
    const page = await app.fetch("/");
    assert.match(page.headers.get("content-security-policy") ?? "", /default-src 'self'/);
    assert.equal(page.headers.get("x-content-type-options"), "nosniff");
    const response = await app.fetch("/health", { method: "POST" });
    assert.equal(response.status, 405);
  });

  it("maps malformed JSON to 400 without internal details", async () => {
    await using app = await start();
    const response = await app.fetch("/api/express/documents", {
      method: "POST",
      headers: { authorization: "Bearer alice-token", "content-type": "application/json" },
      body: "{"
    });
    assert.equal(response.status, 400);
    assert.doesNotMatch(await response.text(), /SyntaxError|stack|src\\/);
  });
});
