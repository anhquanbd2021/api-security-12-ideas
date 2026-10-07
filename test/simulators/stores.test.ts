import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createStores } from "../../src/simulators.js";

describe("database and Redis simulators", () => {
  it("enforces document ownership at repository boundary", async () => {
    const { documents } = createStores();
    assert.equal((await documents.findOwned("document-1", "alice"))?.title, "Alice notes");
    assert.equal(await documents.findOwned("document-1", "bob"), undefined);
  });

  it("atomically permits only configured request count", async () => {
    const { redis } = createStores();
    const results = await Promise.all(Array.from({ length: 4 }, () => redis.consume("alice", 3, 60_000)));
    assert.deepEqual(results.map(result => result.allowed), [true, true, true, false]);
  });

  it("fails explicitly when external storage is unavailable", async () => {
    const { documents, redis } = createStores();
    documents.failWith("unavailable");
    redis.failWith("unavailable");
    await assert.rejects(documents.findOwned("document-1", "alice"), /unavailable/);
    await assert.rejects(redis.consume("alice", 3, 60_000), /unavailable/);
  });
});
