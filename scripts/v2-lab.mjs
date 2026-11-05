import { cp, mkdir, readFile, writeFile, readdir, stat } from "node:fs/promises";
import { resolve, join, relative, dirname } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { spawnSync } from "node:child_process";
import vm from "node:vm";
import { performance } from "node:perf_hooks";
import assert from "node:assert/strict";
import { planDispatch } from "../src/lib/dispatch-engine.ts";
import { dispatchModel, publicDispatchModel } from "../src/lib/dispatch-fixture.ts";
import { validatePlan } from "./v2-grade.mjs";

const root = resolve(import.meta.dirname, "..");
const work = join(root, "artifacts/v2"); const evidence = join(root, "evidence/v2");
const tool = resolve(process.env.DIREA_REPO || join(root, ".tools/die-a-rea"));
const binary = join(tool, "target/release/die-a-rea");
const sha = (b) => createHash("sha256").update(b).digest("hex");
const clean = (s) => s.replaceAll(root, "<repo>").replaceAll(tool, "<die-a-rea>");
await mkdir(work, { recursive: true }); await mkdir(evidence, { recursive: true });
async function json(file) { return JSON.parse(await readFile(file, "utf8")); }
async function save(file, value) { await mkdir(dirname(file), { recursive: true }); await writeFile(file, `${JSON.stringify(value, null, 2)}\n`); }
async function metadata(file) { const b = await readFile(file); return { bytes: b.length, gzipBytes: gzipSync(b).length, sha256: sha(b) }; }
function run(cmd, args, cwd = root) {
  const start = performance.now();
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", timeout: 180000, maxBuffer: 128 * 1024 * 1024, env: { ...process.env, NODE_PATH: join(root, "node_modules"), DIREA_JS_ADAPTER: join(tool, "adapters/js/direa-js") } });
  if (r.error || r.status !== 0) throw new Error(`${cmd}: ${r.error || r.stderr || r.stdout}`);
  return { milliseconds: Math.round(performance.now() - start), output: JSON.parse(r.stdout) };
}
function reduced(reserved) { return { ...dispatchModel, shipments: dispatchModel.shipments.filter((s) => !reserved.shipments.includes(s.id)), couriers: dispatchModel.couriers.filter((c) => !reserved.couriers.includes(c.id)) }; }

const command = process.argv[2];
if (command === "collect") {
  try { await stat(join(evidence, "collection.json")); throw new Error("V2 inputs already frozen. Choose a new experiment rather than overwriting them."); } catch (e) { if (e.code !== "ENOENT") throw e; }
  const browserDir = join(root, ".next/static/chunks/app");
  const candidates = (await readdir(browserDir)).filter((f) => /^page-.*\.js$/.test(f));
  assert.equal(candidates.length, 1);
  const targets = { browser: `.next/static/chunks/app/${candidates[0]}`, planner: ".next/server/app/api/plans/route.js", persistence: ".next/server/app/api/plans/[id]/route.js", page: ".next/server/app/page.js" };
  const files = {};
  for (const [kind, source] of Object.entries(targets)) {
    const target = `before/${kind}/app.js`;
    await mkdir(join(work, `before/${kind}`), { recursive: true });
    await cp(join(root, source), join(work, target));
    assert.ok(!(await readFile(join(work, target), "utf8")).includes("sourceMappingURL="), "Pinned source-map stripping can remove a complete minified line.");
    files[kind] = { source, target, ...await metadata(join(work, target)) };
  }
  const seed = randomBytes(4).readUInt32LE(); let state = seed;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const cases = [];
  for (let i = 0; i < 768; i++) {
    const reserved = { shipments: i < 384 ? [] : dispatchModel.shipments.filter(() => random() < .25).map((s) => s.id), couriers: i < 384 ? [] : dispatchModel.couriers.filter(() => random() < .2).map((c) => c.id) };
    const scenario = { disabledCouriers: dispatchModel.couriers.filter((_, c) => ((i % 8) & (1 << c)) !== 0).map((c) => c.id), closedRoads: i < 128 ? [] : dispatchModel.roads.filter(() => random() < (i % 12 === 0 ? .7 : .18)).map((r) => r.id), startMinute: i < 128 ? [480, 539, 540, 555, 570, 600, 660, 720][Math.floor(i / 16)] : 480 + Math.floor(random() * 241), urgent: Boolean(Math.floor(i / 8) % 2) };
    const model = reduced(reserved); const result = planDispatch(model, scenario);
    validatePlan(result, model, scenario, result.objectiveCents);
    cases.push({ id: `v2-${String(i + 1).padStart(3, "0")}`, scenario, reserved, result });
  }
  const raw = JSON.stringify(cases);
  await writeFile(join(work, "reference.json"), raw);
  await save(join(work, "reference-seed.json"), { seed });
  await save(join(evidence, "collection.json"), { recordedAt: new Date().toISOString(), sourceCommit: spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).stdout.trim(), node: process.version, rea: "6.8.0", obfuscator: "5.10.0", dieCommit: "0d322552673309372f9937bc5f0c50641ed1514e", targets: files, cases: cases.length, referenceSha256: sha(raw), recoveryTarget: "Standalone planDispatch(scenario, reserved) behavior: feasible complete routes and the optimal objective. HTTP parsing, UI and persistence are runtime-preservation checks, not recovery outputs." });
  await save(join(evidence, "public-model.json"), publicDispatchModel());
  console.log(`Frozen ${cases.length} cases and four compiled chunks.`);
} else if (command === "harden") {
  const manifest = join(root, "die-a-rea-v2.toml");
  await save(join(evidence, "die-plan.json"), run(binary, ["--manifest", manifest, "plan", "--json"], work));
  const build = run(binary, ["--manifest", manifest, "build", "--out", "hardened", "--seed", "20261106", "--json"], work);
  await save(join(evidence, "die-build.json"), JSON.parse(clean(JSON.stringify(build))));
  assert.equal((JSON.stringify(build).match(/obfuscated 1 file/g) || []).length, 4, "All four adapter calls must report one transformed file.");
  const collection = await json(join(evidence, "collection.json")); const sizes = {};
  for (const [kind, target] of Object.entries(collection.targets)) {
    const file = join(work, "hardened", target.target);
    sizes[kind] = { before: await metadata(join(work, target.target)), after: await metadata(file) };
    await save(join(evidence, `rrs-${kind}.json`), run(binary, ["verify", "--original", target.target, "--hardened", `hardened/${target.target}`, "--build-meta", "hardened/die-a-rea.build.json", "--json"], work));
  }
  await save(join(evidence, "sizes.json"), sizes);
  console.log(JSON.stringify(sizes, null, 2));
} else if (command === "analyze") {
  const stage = process.argv[3]; assert.ok(["before", "after"].includes(stage));
  const collection = await json(join(evidence, "collection.json"));
  for (const [kind, target] of Object.entries(collection.targets)) {
    const dir = join(work, stage === "before" ? dirname(target.target) : `hardened/${dirname(target.target)}`);
    const result = run(process.execPath, [join(root, "node_modules/rea-agents/scripts/rea.mjs"), "analyze-javascript-application", dir, "--max-semantic-nodes", "12000", "--max-semantic-nodes-per-file", "12000", "--max-semantic-unknowns", "4000", "--max-semantic-unknowns-per-file", "4000", "--analysis-timeout-ms", "60000", "--max-heap-mb", "1024", "--format", "json"]);
    const bytes = clean(JSON.stringify(result));
    await writeFile(join(work, `rea-${kind}-${stage}.json`), bytes);
    await writeFile(join(evidence, `rea-${kind}-${stage}.json.gz`), gzipSync(bytes));
    console.log(`${kind}/${stage}: ${result.milliseconds} ms; ${bytes.length} report bytes`);
  }
} else if (command === "runtime") {
  const destination = join(work, "runtime-hardened");
  try { await stat(destination); throw new Error("Hardened runtime already exists."); } catch (e) { if (e.code !== "ENOENT") throw e; }
  await cp(join(root, ".next/standalone"), destination, { recursive: true });
  const collection = await json(join(evidence, "collection.json"));
  for (const target of Object.values(collection.targets)) await cp(join(work, "hardened", target.target), join(destination, target.source));
  console.log(relative(root, destination));
} else if (command === "score") {
  const candidatePath = resolve(process.argv[3]);
  assert.equal(typeof vm.SourceTextModule, "function", "Run scoring with node --experimental-vm-modules.");
  const context = vm.createContext({});
  const candidate = new vm.SourceTextModule(await readFile(candidatePath, "utf8"), { context });
  await candidate.link(() => { throw new Error("Recovered module must be self-contained: imports are forbidden."); });
  await candidate.evaluate({ timeout: 2000 });
  assert.equal(typeof candidate.namespace.planDispatch, "function", "Candidate must export planDispatch.");
  context.candidate = candidate.namespace.planDispatch;
  const raw = await readFile(join(work, "reference.json"), "utf8");
  assert.equal(sha(raw), (await json(join(evidence, "collection.json"))).referenceSha256);
  const cases = JSON.parse(raw); let passed = 0; const failures = []; const distinctPassed = new Set();
  for (const item of cases) {
    try {
      context.scenarioJson = JSON.stringify(item.scenario); context.reservedJson = JSON.stringify(item.reserved);
      const plan = vm.runInContext("candidate(JSON.parse(scenarioJson), JSON.parse(reservedJson))", context, { timeout: 1000 });
      assert.ok(!plan?.then, "Recovery contract requires a synchronous function.");
      validatePlan(plan, reduced(item.reserved), item.scenario, item.result.objectiveCents); passed++; distinctPassed.add(JSON.stringify([item.scenario, item.reserved]));
    }
    catch (e) { if (failures.length < 8) failures.push({ id: item.id, error: e.message }); }
  }
  const report = { cases: cases.length, distinctInputs: new Set(cases.map((item) => JSON.stringify([item.scenario, item.reserved]))).size, distinctInputsPassed: distinctPassed.size, passed, failed: cases.length - passed, candidateSha256: sha(await readFile(candidatePath)), referenceSha256: sha(raw), failures };
  if (process.argv[4]) await save(resolve(process.argv[4]), report);
  console.log(JSON.stringify(report, null, 2)); if (passed !== cases.length) process.exitCode = 1;
} else if (command === "unpack") {
  const collection = await json(join(evidence, "collection.json"));
  const sizes = await json(join(evidence, "sizes.json"));
  for (const stage of ["before", "after"]) for (const [kind, target] of Object.entries(collection.targets)) {
    const bytes = gunzipSync(await readFile(join(evidence, "artifacts", `${stage}-${kind}.js.gz`)));
    assert.equal(sha(bytes), sizes[kind][stage].sha256);
    const file = join(work, stage === "before" ? target.target : `hardened/${target.target}`);
    await mkdir(dirname(file), { recursive: true }); await writeFile(file, bytes);
  }
  const reference = await readFile(join(evidence, "reference.json"));
  assert.equal(sha(reference), collection.referenceSha256);
  await writeFile(join(work, "reference.json"), reference);
  console.log("Verified and unpacked eight V2 snapshots and the reference commitment.");
} else if (command === "publish") {
  const collection = await json(join(evidence, "collection.json"));
  await mkdir(join(evidence, "artifacts"), { recursive: true });
  for (const stage of ["before", "after"]) for (const [kind, target] of Object.entries(collection.targets)) {
    const bytes = await readFile(join(work, stage === "before" ? target.target : `hardened/${target.target}`));
    await writeFile(join(evidence, "artifacts", `${stage}-${kind}.js.gz`), gzipSync(bytes));
  }
  await cp(join(work, "reference.json"), join(evidence, "reference.json"));
  await save(join(evidence, "reference-seed.json"), await json(join(work, "reference-seed.json")));
  console.log("Published immutable input snapshots and now-disclosed reference cases.");
} else throw new Error("Use collect|harden|analyze before|after|runtime|score CANDIDATE OUTPUT|publish|unpack");
