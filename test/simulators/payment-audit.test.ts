import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPaymentAndAudit } from "../../src/simulators.js";

describe("payment and audit simulators", () => {
  it("charges once when concurrent retries use same idempotency key", async () => {
    const { payments } = createPaymentAndAudit();
    const calls = await Promise.all([
      payments.charge("alice", "checkout-1", 2500, "req-1"),
      payments.charge("alice", "checkout-1", 2500, "req-2")
    ]);
    assert.equal(calls[0].id, calls[1].id);
    assert.equal(payments.chargeCount, 1);
  });

  it("rejects key reuse with different payload", async () => {
    const { payments } = createPaymentAndAudit();
    await payments.charge("alice", "checkout-1", 2500, "req-1");
    await assert.rejects(payments.charge("alice", "checkout-1", 3000, "req-2"), /conflict/);
  });

  it("redacts secrets from append-only audit events", async () => {
    const { audit } = createPaymentAndAudit();
    await audit.write({ actor: "alice", action: "login", requestId: "req-1", details: { token: "secret", result: "ok" } });
    assert.deepEqual(audit.events[0]?.details, { token: "[REDACTED]", result: "ok" });
    assert.throws(() => (audit.events as unknown as { push(value: unknown): void }).push(audit.events[0]), /read only|not extensible/i);
  });
});
