import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateQuote } from "../src/lib/quote.ts";
import { parseParcel, assessParcel } from "../src/lib/parcel.ts";
import { base, scenarios } from "./scenarios.mjs";

test("dimensional weight rounds up to the next half kilogram", () => {
  assert.equal(assessParcel({ ...base, length: 41, width: 31, height: 21 }).billableWeight, 5.5);
});
test("negotiated floor, fuel and tax produce exact cents", () => {
  const quote = calculateQuote(parseParcel(base));
  assert.equal(quote.transportCents, 1120); assert.equal(quote.fuelCents, 80); assert.equal(quote.taxCents, 75); assert.equal(quote.totalCents, 1275);
  assert.equal(quote.shipDate, "2026-11-06"); assert.equal(quote.deliveryDate, "2026-11-12");
});
test("cutoff and holiday interactions affect service dates", () => {
  assert.equal(calculateQuote({ ...base, express: true, dispatchAt: "2026-11-10T14:00:00Z" }).shipDate, "2026-11-12");
  assert.equal(calculateQuote({ ...base, zone: "remote", dispatchAt: "2026-11-10T11:00:00Z" }).shipDate, "2026-11-13");
});
test("night promo combines time, service, route and item eligibility", () => {
  const late = { ...base, promo: "NIGHTOWL17", dispatchAt: "2026-11-06T18:00:00Z" };
  assert.equal(calculateQuote(late).discountCents, 190);
  for (const patch of [{ express: true }, { zone: "remote" }, { dispatchAt: "2026-11-06T17:59:00Z" }, { item: "battery" }]) assert.equal(calculateQuote({ ...late, ...patch }).discountCents, 0);
});
test("bulk discount threshold and insurance rounding", () => {
  const quote = calculateQuote({ ...base, weight: 9, insured: true, declaredValue: 400, promo: "BULKLANE" });
  assert.equal(quote.discountCents, 327); assert.equal(quote.insuranceCents, 332);
  assert.equal(calculateQuote({ ...base, weight: 7.5, promo: "BULKLANE" }).discountCents, 0);
});
test("reject malformed, oversized, invalid-date and forged input", () => {
  for (const input of [null, [], {}, { ...base, weight: 0 }, { ...base, weight: 20.1 }, { ...base, weight: NaN }, { ...base, weight: "2" }, { ...base, zone: "moon" }, { ...base, express: "false" }, { ...base, promo: "x".repeat(41) }, { ...base, totalCents: 1 }, { ...base, dispatchAt: "2026-02-30T10:00:00Z" }]) assert.throws(() => parseParcel(input));
  assert.equal(parseParcel({ ...base, promo: " nightowl17 " }).promo, "NIGHTOWL17");
});
test("all frozen cases have finite cent values or reject eligibility", () => {
  for (const { input } of scenarios) {
    if (!assessParcel(input).eligible) { assert.throws(() => calculateQuote(input)); continue; }
    const quote = calculateQuote(input);
    for (const [key, value] of Object.entries(quote)) if (key.endsWith("Cents")) assert.ok(Number.isSafeInteger(value) && value >= 0, key);
    assert.ok(quote.deliveryDate > quote.shipDate);
  }
});
