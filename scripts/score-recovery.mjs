import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const stage = process.argv[2];
if (stage !== "before" && stage !== "after") throw new Error("Use score-recovery.mjs before|after <candidate.mjs>");
const file = resolve(process.argv[3]);
const recovered = await import(pathToFileURL(file).href);
assert.equal(typeof recovered.calculateQuote, "function", "The candidate must export calculateQuote.");
const reference = JSON.parse(await readFile("artifacts/reference.json", "utf8"));
const commitment = JSON.parse(await readFile("evidence/collection.json", "utf8"));
const hash = (value) => createHash("sha256").update(value).digest("hex");
assert.equal(hash(JSON.stringify(reference)), commitment.referenceSha256, "The held-out reference changed.");
const results = reference.map(({ id, input, result, rejected }) => {
  let actual;
  let threw = false;
  try { actual = recovered.calculateQuote(structuredClone(input)); } catch { threw = true; }
  let passed = false;
  try { if (rejected) assert.ok(threw); else { assert.equal(threw, false); assert.deepEqual(actual, result); } passed = true; } catch { /* Keep each mismatch visible. */ }
  return { id, rejected: Boolean(rejected), passed, ...(!passed ? { expected: result || { rejected: true }, actual: threw ? { rejected: true } : actual ?? null } : {}) };
});
const report = { stage, scope: "One source-limited agent attempt; artifact possession, no API queries. Instructional source isolation, not an OS sandbox. Whole returned JSON compared on accepted cases; only rejection compared on ineligible cases.", referenceSha256: commitment.referenceSha256, candidateSha256: hash(await readFile(file)), cases: results.length, matched: results.filter((x) => x.passed).length, accepted: results.filter((x) => !x.rejected).length, rejected: results.filter((x) => x.rejected).length, results };
await mkdir("evidence", { recursive: true });
await writeFile(`evidence/recovery-${stage}.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ stage, cases: report.cases, matched: report.matched, accepted: report.accepted, rejected: report.rejected }));
if (report.matched !== report.cases) process.exitCode = 1;
