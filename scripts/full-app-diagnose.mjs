import { readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { validatePlan } from "./v2-grade.mjs";
import { dispatchModel } from "../src/lib/dispatch-fixture.ts";

const root = resolve(import.meta.dirname, "..");
const evidence = join(root, "evidence/full-app");
const original = await readFile(join(root, "recoveries/full-app/trial-b/src/lib/planner.js"), "utf8");
const reference = JSON.parse(await readFile(join(evidence, "reference.json"), "utf8"));
const replacements = [
  ["penalty > best.penalty", "penalty > best.cost + best.penalty"],
  ["cost + penalty < best.penalty", "cost + penalty < best.cost + best.penalty"],
  ["cost + penalty === best.penalty", "cost + penalty === best.cost + best.penalty"],
  ["signature < '~'", "signature < best.signature"],
];
let patched = original;
for (const [before, after] of replacements) {
  assert.equal(patched.split(before).length - 1, 1);
  patched = patched.replace(before, after);
}
const hash = (source) => createHash("sha256").update(source).digest("hex");
const results = {};
for (const [name, source] of [["submitted", original], ["diagnosticOnly", patched]]) {
  const { calculatePlan } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
  let exact = 0; let semantic = 0;
  for (const item of reference) {
    const actual = calculatePlan(dispatchModel, item.scenario);
    try { assert.deepEqual(actual, item.result); exact++; } catch {}
    try { validatePlan(actual, dispatchModel, item.scenario, item.result.objectiveCents); semantic++; } catch {}
  }
  results[name] = { sourceSha256: hash(source), exact, semantic, cases: reference.length };
}
assert.equal(results.submitted.semantic, 258);
assert.equal(results.diagnosticOnly.exact, 312);
assert.equal(results.diagnosticOnly.semantic, 312);
assert.equal(hash(await readFile(join(root, "recoveries/full-app/trial-b/src/lib/planner.js"))), hash(original));
const report = {
  purpose: "Post-submission diagnosis only. Original candidate bytes and official score remain unchanged; the repaired function is never counted as a successful recovery.",
  finding: "The recovered optimizer compares candidate total cost with incumbent penalty alone, over-prunes by incumbent penalty, and ties against a constant. The actual original compares incumbent total and signature.",
  replacements,
  results,
};
await writeFile(join(evidence, "optimizer-diagnosis.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
