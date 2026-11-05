import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { calculateQuote } from "../src/lib/quote.ts";
import { scenarios, base } from "../test/scenarios.mjs";

const origin = process.argv[2] || "http://127.0.0.1:4320";
const results = [];
for (const { id, input } of scenarios) {
  let expected;
  try { expected = calculateQuote(input); } catch { expected = null; }
  const response = await fetch(`${origin}/api/quote`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  const actual = await response.json();
  assert.equal(response.status, expected ? 201 : 422, id);
  if (expected) {
    assert.deepEqual(actual.quote, expected, id);
    assert.equal(actual.state, "quoted");
    assert.ok(Date.parse(actual.expiresAt) > Date.now());
  }
  results.push({ id, status: response.status, passed: true });
}
const created = await (await fetch(`${origin}/api/quote`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(base) })).json();
for (let retry = 0; retry < 2; retry++) {
  const booked = await (await fetch(`${origin}/api/quotes/${created.id}`, { method: "POST" })).json();
  assert.equal(booked.state, "booked"); assert.equal(booked.id, created.id);
}
assert.equal((await (await fetch(`${origin}/api/quotes/${created.id}`)).json()).state, "booked");
for (const [body, contentType, status] of [["{", "application/json", 400], [JSON.stringify({ ...base, totalCents: 1 }), "application/json", 400], ["x".repeat(2049), "application/json", 413], [JSON.stringify(base), "text/plain", 415]]) {
  assert.equal((await fetch(`${origin}/api/quote`, { method: "POST", headers: { "Content-Type": contentType }, body })).status, status);
}
assert.equal((await fetch(`${origin}/api/quotes/not-a-uuid`)).status, 404);
const report = { origin, scenarioCount: results.length, scenarios: results, bookingRetries: 2, savedQuoteRead: true, invalidRequestChecks: 5, passed: true };
if (process.argv[3]) await writeFile(process.argv[3], `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ scenarioCount: results.length, bookingRetries: 2, invalidRequestChecks: 5, passed: true }));
