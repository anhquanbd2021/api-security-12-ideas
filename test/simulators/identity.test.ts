import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createIdentityProvider } from "../../src/simulators.js";

const requestId = "req-auth";

describe("external identity provider", () => {
  it("accepts valid tokens and rejects expired or revoked tokens", async () => {
    const idp = createIdentityProvider();
    assert.equal((await idp.authenticate("alice-token", requestId)).id, "alice");
    await assert.rejects(idp.authenticate("expired-token", requestId), /unauthorized/);
    await assert.rejects(idp.authenticate("revoked-token", requestId), /unauthorized/);
  });

  it("fails closed on timeout and never leaks token values", async () => {
    const idp = createIdentityProvider();
    idp.failWith("timeout");
    await assert.rejects(idp.authenticate("alice-token", requestId), error => {
      assert.doesNotMatch(String(error), /alice-token/);
      return true;
    });
  });
});
