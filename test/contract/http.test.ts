import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { testImplementations } from "../support/contract.js";

for (const implementation of testImplementations) {
  describe(`${implementation.name} security contract`, () => {
    it("requires authentication and hides foreign resources", async () => {
      await using app = await implementation.start();
      assert.equal((await app.fetch("/documents/document-1")).status, 401);
      assert.equal((await app.fetch("/documents/document-1", { headers: { authorization: "Bearer bob-token" } })).status, 404);
      const response = await app.fetch("/documents/document-1", { headers: { authorization: "Bearer alice-token" } });
      assert.equal(response.status, 200);
      assert.equal((await response.json() as { title: string }).title, "Alice notes");
    });

    it("validates writes and ignores client authority claims", async () => {
      await using app = await implementation.start();
      const headers = { authorization: "Bearer alice-token", "content-type": "application/json" };
      assert.equal((await app.fetch("/documents", { method: "POST", headers, body: JSON.stringify({ title: "" }) })).status, 400);
      const response = await app.fetch("/documents", { method: "POST", headers, body: JSON.stringify({ title: "Safe title", ownerId: "bob" }) });
      assert.equal(response.status, 201);
      assert.equal((await response.json() as { ownerId: string }).ownerId, "alice");
    });

    it("rate limits, returns secure headers, and hides internal errors", async () => {
      await using app = await implementation.start();
      const headers = { authorization: "Bearer alice-token" };
      for (let index = 0; index < 3; index++) assert.equal((await app.fetch("/documents/document-1", { headers })).status, 200);
      const limited = await app.fetch("/documents/document-1", { headers });
      assert.equal(limited.status, 429);
      assert.ok(limited.headers.get("retry-after"));
      assert.ok(limited.headers.get("x-content-type-options"));
      const failure = await app.fetch("/failure", { headers: { authorization: "Bearer admin-token" } });
      const text = await failure.text();
      assert.equal(failure.status, 500);
      assert.doesNotMatch(text, /stack|database password|internal-host/i);
      assert.match(text, /requestId/);
    });

    it("makes payment retries idempotent", async () => {
      await using app = await implementation.start();
      const options = { method: "POST", headers: { authorization: "Bearer alice-token", "content-type": "application/json", "idempotency-key": "order-1" }, body: JSON.stringify({ amount: 2500 }) };
      const first = await app.fetch("/payments", options);
      const second = await app.fetch("/payments", options);
      assert.equal(first.status, 201);
      assert.equal(second.status, 200);
      const firstBody = await first.json() as { id: string };
      assert.equal(firstBody.id, (await second.json() as { id: string }).id);
      const conflict = await app.fetch("/payments", { ...options, body: JSON.stringify({ amount: 2600 }) });
      assert.equal(conflict.status, 409);
      assert.equal((await conflict.json() as { error: string }).error, "conflict");
    });
  });
}
