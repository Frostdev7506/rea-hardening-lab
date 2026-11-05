import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:net";
import { normalizeRecord, assertPortAvailable } from "../scripts/full-app-check.mjs";

test("app evaluation refuses an occupied port rather than using the existing server", async () => {
  const listener = createServer();
  await new Promise((done) => listener.listen(0, "127.0.0.1", done));
  const { port } = listener.address();
  try { await assert.rejects(assertPortAvailable(port), { code: "EADDRINUSE" }); }
  finally { await new Promise((done) => listener.close(done)); }
  await assertPortAvailable(port);
});

test("app parity normalizes nondeterministic IDs/times while retaining behavior", () => {
  const first = { id: "12345678-1234-4234-8234-123456789abc", batchId: "12345678-1234-4234-8234-123456789abd", createdAt: "2026-11-06T01:00:00.000Z", state: "draft", plan: { objectiveCents: 5483 }, events: [{ type: "planned", at: "2026-11-06T01:00:00.000Z" }] };
  const second = { ...first, id: "12345678-1234-4234-8234-123456789abe", createdAt: "2026-11-06T01:01:00.000Z" };
  assert.deepEqual(normalizeRecord(first), normalizeRecord(second));
  assert.notDeepEqual(normalizeRecord(first), normalizeRecord({ ...second, state: "committed" }));
  assert.notDeepEqual(normalizeRecord(first), normalizeRecord({ ...second, plan: { objectiveCents: 5484 } }));
  assert.throws(() => normalizeRecord({ ...first, id: "fake" }));
  assert.throws(() => normalizeRecord({ ...first, createdAt: "bad" }));
});
