import { readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

const root = resolve(import.meta.dirname, ".."); const evidence = join(root, "evidence/v2");
const read = async (name) => JSON.parse(await readFile(join(evidence, name), "utf8"));
const sha = (b) => createHash("sha256").update(b).digest("hex");
const median = (values) => { const s = values.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
const collection = await read("collection.json"); const sizes = await read("sizes.json");
const protocol = await read("recovery-protocol.json"); const trials = [];
for (let i = 0; i < protocol.order.length; i++) {
  const path = `recoveries/attempt-${i + 1}-${protocol.order[i]}`;
  const usage = await read(`${path}/usage.json`); const score = await read(`${path}/score.json`);
  assert.equal(score.referenceSha256, collection.referenceSha256);
  assert.equal(score.candidateSha256, sha(await readFile(join(evidence, path, "recovered.mjs"))));
  trials.push({ ...usage, score, uncachedInputTokens: usage.usage ? usage.usage.input_tokens - usage.usage.cached_input_tokens : null });
}
const variants = {};
for (const variant of ["before", "after"]) {
  const group = trials.filter((t) => t.variant === variant);
  variants[variant] = { attempts: group.length, correctAttempts: group.filter((t) => t.score.passed === t.score.cases).length, correctWithinBudget: group.filter((t) => t.score.passed === t.score.cases && !t.timedOut && t.status.code === 0).length, medianMilliseconds: median(group.map((t) => t.milliseconds)), millisecondsRange: [Math.min(...group.map((t) => t.milliseconds)), Math.max(...group.map((t) => t.milliseconds))], medianInputTokens: median(group.map((t) => t.usage?.input_tokens)), medianCachedInputTokens: median(group.map((t) => t.usage?.cached_input_tokens)), medianUncachedInputTokens: median(group.map((t) => t.uncachedInputTokens)), medianOutputTokens: median(group.map((t) => t.usage?.output_tokens)), medianReasoningOutputTokens: median(group.map((t) => t.usage?.reasoning_output_tokens)), medianCommands: median(group.map((t) => t.commandCount)) };
}
const snapshots = {};
for (const [kind, target] of Object.entries(collection.targets)) for (const stage of ["before", "after"]) {
  const path = join(root, "artifacts/v2", stage === "before" ? target.target : `hardened/${target.target}`);
  const hash = sha(await readFile(path)); assert.equal(hash, sizes[kind][stage].sha256);
  snapshots[`${stage}-${kind}`] = hash;
}
const referenceSha256 = sha(await readFile(join(root, "artifacts/v2/reference.json")));
assert.equal(referenceSha256, collection.referenceSha256);
const inputCopies = [];
if (process.env.V2_RECOVERY_DIR) {
  const threads = new Set();
  for (const trial of trials) {
    const folder = join(process.env.V2_RECOVERY_DIR, `attempt-${trial.attempt}-${trial.variant}`);
    for (const kind of Object.keys(collection.targets)) assert.equal(sha(await readFile(join(folder, `${kind}.js`))), snapshots[`${trial.variant}-${kind}`]);
    const events = (await readFile(join(process.env.V2_RECOVERY_DIR, `events-${trial.attempt}.jsonl`), "utf8")).trim().split("\n").map((line) => JSON.parse(line));
    const thread = events.find((e) => e.type === "thread.started"); assert.ok(thread); threads.add(thread.thread_id);
    const itemTypes = {};
    for (const event of events.filter((e) => e.type === "item.completed" && e.item?.type !== "reasoning")) itemTypes[event.item.type] = (itemTypes[event.item.type] || 0) + 1;
    inputCopies.push({ attempt: trial.attempt, unchangedCompiledInputs: true, completedItemTypes: itemTypes });
  }
  assert.equal(threads.size, trials.length);
}
const integrity = { referenceSha256, snapshots, inputCopies, originalAndHardenedSnapshotsUnchanged: true, copiedTrialInputsUnchanged: inputCopies.length === trials.length, distinctFreshThreadIdsVerified: inputCopies.length === trials.length, limitation: "Listed filesystem reads were denied; writes and all other locations were not fully confined. This post-run hash audit detects modification of the committed reference, retained snapshots and copied trial chunks. Raw logs stay local." };
await writeFile(join(evidence, "integrity.json"), `${JSON.stringify(integrity, null, 2)}\n`);
const summary = { version: 2, recordedAt: new Date().toISOString(), sourceCommit: collection.sourceCommit, cases: collection.cases, caseCoverage: await read("case-coverage.json"), oracleCheck: await read("oracle-check.json"), runtimeBefore: await read("api-reference-before.json"), runtimeAfter: await read("api-reference-after.json"), workflowAfter: await read("functional-after.json"), sizes, variants, trials, medianRatiosAfterOverBefore: { wallTime: variants.after.medianMilliseconds / variants.before.medianMilliseconds, uncachedInputTokens: variants.after.medianUncachedInputTokens / variants.before.medianUncachedInputTokens, outputTokens: variants.after.medianOutputTokens / variants.before.medianOutputTokens }, interpretation: "Copied-build planner recovery; three completed attempts per variant under a 480-second ceiling. Token fields are CLI-reported cumulative usage including repeated context/cache behavior. No dollar-cost or backend-model attestation claim. Static REA preprocessing is recorded separately and not included in agent process wall time. Finite correctness checks and small repeated samples are not a universal reverse-engineering resistance rate." };
await writeFile(join(evidence, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify({ variants, ratios: summary.medianRatiosAfterOverBefore, integrityPassed: true }, null, 2));
