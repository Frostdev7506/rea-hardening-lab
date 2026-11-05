import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { validatePlan } from "./v2-grade.mjs";
import { dispatchModel } from "../src/lib/dispatch-fixture.ts";
import { createHash } from "node:crypto";

const origin = process.argv[2];
const raw = await readFile(new URL("../artifacts/v2/reference.json", import.meta.url), "utf8");
const collection = JSON.parse(await readFile(new URL("../evidence/v2/collection.json", import.meta.url), "utf8"));
assert.equal(createHash("sha256").update(raw).digest("hex"), collection.referenceSha256);
const cases = JSON.parse(raw).filter((item) => item.reserved.shipments.length === 0 && item.reserved.couriers.length === 0);
let passed = 0;
for (const item of cases) {
  const response = await fetch(`${origin}/api/plans`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ batchId: null, scenario: item.scenario }) });
  assert.equal(response.status, 201);
  const actual = await response.json();
  validatePlan(actual.plan, dispatchModel, item.scenario, item.result.objectiveCents);
  assert.deepEqual(actual.plan, item.result, "The actual hardened application must preserve its own deterministic result, not just the optimum.");
  passed++;
}
const report = { origin, passed, cases: cases.length, referenceSha256: collection.referenceSha256, scope: "Every frozen case without pre-reserved resources, checked against the running API. Stateful resource reservation is checked separately by check-dispatch-api.mjs." };
if (process.argv[3]) await writeFile(process.argv[3], `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report));
