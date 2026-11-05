import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import { calculateQuote, assessParcel } from "./recovered.mjs";

const artifact = fs.readFileSync(new URL("../../evidence/artifacts/before-server.js", import.meta.url), "utf8");
const tableStart = artifact.indexOf("let d={local:");
const tableEnd = artifact.indexOf(";var f=c(3526)", tableStart);
const functionStart = artifact.indexOf("try{c=function(a)") + "try{c=".length;
const functionEnd = artifact.indexOf("}(b)}catch(a)", functionStart) + 1;
assert.ok(tableStart >= 0 && tableEnd > tableStart && functionEnd > functionStart);
// Execute only the self-contained table/holiday definitions and quote function.
// The Webpack bootstrap, module imports, HTTP handler, and database never run.
const oracle = vm.runInNewContext(`${artifact.slice(tableStart, tableEnd)};(${artifact.slice(functionStart, functionEnd)})`, {}, { timeout: 1000 });

let checked = 0;
let accepted = 0;
let rejected = 0;
function outcome(fn, parcel) {
  try { return { value: JSON.parse(JSON.stringify(fn(parcel))) }; }
  catch (error) { return { error: error.message }; }
}
function check(parcel) {
  const expected = outcome(oracle, parcel);
  assert.deepEqual(outcome(calculateQuote, parcel), expected, JSON.stringify(parcel));
  const assessment = assessParcel(parcel);
  assert.equal(assessment.eligible, !expected.error);
  checked++;
  if (expected.error) rejected++; else accepted++;
}

const base = { weight: 2, length: 30, width: 20, height: 15, zone: "national", express: false, item: "general", insured: false, declaredValue: 100, promo: "", dispatchAt: "2026-11-06T11:00:00Z" };
const dates = ["2026-11-06", "2026-11-07", "2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-12-24", "2026-12-25", "2026-12-31", "2027-01-01"];
for (const zone of ["local", "national", "remote"])
for (const express of [false, true])
for (const item of ["general", "fragile", "battery"])
for (const insured of [false, true])
for (const weight of [0.1, 0.5, 2, 2.01, 6, 6.01, 7.99, 8, 12, 12.01, 15, 15.01, 20])
for (const promo of ["", "NIGHTOWL17", "BULKLANE", "UNKNOWN"])
for (const hour of [13, 14, 16, 17, 18, 23]) {
  const date = dates[checked % dates.length];
  check({ ...base, zone, express, item, insured, weight, promo, dispatchAt: `${date}T${hour}:00:00Z` });
}

let seed = 714203;
const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
for (let i = 0; i < 20000; i++) {
  const parcel = { ...base,
    weight: 0.01 + random() * 19.99,
    length: 1 + random() * 119,
    width: 1 + random() * 119,
    height: 1 + random() * 119,
    zone: ["local", "national", "remote"][Math.floor(random() * 3)],
    express: random() < 0.5,
    item: ["general", "fragile", "battery"][Math.floor(random() * 3)],
    insured: random() < 0.5,
    declaredValue: 0.01 + random() * 9999.99,
    promo: ["", "NIGHTOWL17", "BULKLANE"][Math.floor(random() * 3)],
    dispatchAt: new Date(Date.UTC(2026, 10, 1) + Math.floor(random() * 100 * 86400) * 1000).toISOString().replace(".000Z", "Z"),
  };
  check(parcel);
}

for (const declaredValue of [0.01, 179.51, 179.52, 2500, 2500.01, 10000])
for (const length of [99.999, 100, 100.001, 120])
for (const insured of [false, true]) check({ ...base, length, width: 1, height: 1, zone: "remote", insured, declaredValue });

const result = { checked, accepted, rejected, mismatches: 0, example: calculateQuote(base), finishedAt: new Date().toISOString() };
fs.writeFileSync(new URL("./verification.json", import.meta.url), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
