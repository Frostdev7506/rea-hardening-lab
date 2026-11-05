import { readFile, writeFile, mkdir, cp, stat } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { homedir } from "node:os";
import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { validatePlan } from "./v2-grade.mjs";
import { dispatchModel } from "../src/lib/dispatch-fixture.ts";
import { calculateQuote } from "../src/lib/quote.ts";
import { scenarios as quoteCases, base as quoteBase } from "../test/scenarios.mjs";

const root = resolve(import.meta.dirname, "..");
const work = join(root, "artifacts/full-app"); const evidence = join(root, "evidence/full-app");
const control = resolve(process.env.FULL_APP_DIR || join(homedir(), ".codex/tmp/rea-full-app-pair-20261106"));
const sha = (b) => createHash("sha256").update(b).digest("hex");
const uuid = (v) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const baseScenario = { disabledCouriers: [], closedRoads: [], startMinute: 540, urgent: false };
async function save(file, value) { await mkdir(dirname(file), { recursive: true }); await writeFile(file, `${JSON.stringify(value, null, 2)}\n`); }
const pause = (ms) => new Promise((done) => setTimeout(done, ms));

export function normalizeRecord(body) {
  const copy = structuredClone(body);
  if (copy && typeof copy === "object" && !Array.isArray(copy)) {
    for (const name of ["id", "batchId"]) if (name in copy) { assert.ok(uuid(copy[name]), `Invalid ${name}`); copy[name] = `<${name}>`; }
    for (const name of ["createdAt", "expiresAt"]) if (name in copy) { assert.ok(Number.isFinite(Date.parse(copy[name])), `Invalid ${name}`); copy[name] = `<${name}>`; }
    if (Array.isArray(copy.events)) for (const event of copy.events) { assert.ok(Number.isFinite(Date.parse(event.at)), "Invalid event timestamp"); event.at = "<event-time>"; }
  }
  return copy;
}
async function request(origin, path, { method = "GET", json, body, contentType = "application/json" } = {}) {
  const started = Date.now();
  const response = await fetch(`${origin}${path}`, { method, headers: method === "GET" ? undefined : { "Content-Type": contentType }, body: json === undefined ? body : JSON.stringify(json), signal: AbortSignal.timeout(5000) });
  const text = await response.text(); let value; try { value = JSON.parse(text); } catch { value = text; }
  return { status: response.status, contentType: response.headers.get("content-type"), cacheControl: response.headers.get("cache-control"), body: value, started, ended: Date.now() };
}
function compare(a, b) {
  assert.equal(b.status, a.status, "HTTP status mismatch");
  if (a.contentType?.includes("application/json")) assert.ok(b.contentType?.includes("application/json"), "Response must be JSON");
  assert.equal(b.cacheControl, a.cacheControl, "Cache-Control mismatch");
  assert.deepEqual(normalizeRecord(b.body), normalizeRecord(a.body));
}
function created(record, type) {
  assert.ok(uuid(record.body.id));
  if (type === "plan") {
    assert.ok(uuid(record.body.batchId)); assert.equal(record.body.state, "draft");
    assert.ok(Date.parse(record.body.createdAt) >= record.started - 2000 && Date.parse(record.body.createdAt) <= record.ended + 2000, "createdAt must reflect this request");
    assert.equal(record.body.events[0].type, "planned");
    assert.ok(Math.abs(Date.parse(record.body.events[0].at) - Date.parse(record.body.createdAt)) <= 5, "Planned event must correspond to creation");
  } else {
    assert.equal(record.body.state, "quoted");
    assert.ok(Math.abs(Date.parse(record.body.expiresAt) - record.started - 600000) < 5000, "Quote must have a ten-minute expiry");
  }
}
export async function assertPortAvailable(port) {
  await new Promise((done, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen({ host: "127.0.0.1", port, exclusive: true }, () => probe.close(done));
  });
}
async function serve(directory, port, env, sandbox = false) {
  // Refuse an existing listener so readiness cannot accidentally test another app.
  await assertPortAvailable(port);
  const args = [...(env.EVAL_CLOCK_MODULE ? ["--require", env.EVAL_CLOCK_MODULE] : []), ...(directory.endsWith("runtime-original") ? [join(directory, "server.js")] : [join(directory, "node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(port)])];
  let cmd = process.execPath; let parameters = args;
  if (sandbox) {
    const denied = [root, resolve(root, "../Porfolio_blog_Site"), join(homedir(), ".codex/tmp/rea-v2-eval-control"), join(homedir(), ".codex/sessions"), join(homedir(), ".codex/memories"), join(control, directory.includes("trial-a") ? "trial-b" : "trial-a")];
    const logs = ["trial-a", "trial-b"].flatMap((name) => [join(control, `${name}.jsonl`), join(control, `${name}.stderr`), join(control, `${name}.result.json`)]);
    const profile = `(version 1)\n(allow default)\n(deny file-read* ${denied.map((p) => `(subpath ${JSON.stringify(p)})`).join(" ")} ${logs.map((p) => `(literal ${JSON.stringify(p)})`).join(" ")} (literal ${JSON.stringify(join(homedir(), ".codex/history.jsonl"))}))\n(deny file-write* ${[...denied, join(control, "dependencies")].map((p) => `(subpath ${JSON.stringify(p)})`).join(" ")})\n(deny network-outbound (require-not (remote ip "localhost:${port}")))\n`;
    const file = join(control, `serve-${port}.sb`); await writeFile(file, profile);
    cmd = "/usr/bin/sandbox-exec"; parameters = ["-f", file, process.execPath, ...args];
  }
  const child = spawn(cmd, parameters, { cwd: directory, detached: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, ...env, PORT: String(port), HOSTNAME: "127.0.0.1", NEXT_TELEMETRY_DISABLED: "1", OPENAI_API_KEY: "", CODEX_API_KEY: "" } });
  let log = ""; child.stdout.on("data", (b) => { log += b; }); child.stderr.on("data", (b) => { log += b; });
  const origin = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 80; i++) {
    if (child.exitCode !== null) throw Error(`Server exited: ${log.slice(-1800)}`);
    try { const r = await fetch(origin, { signal: AbortSignal.timeout(500) }); if (r.status === 200) return { child, origin, directory, port, env, sandbox, log: () => log }; } catch {}
    if (child.exitCode !== null) throw Error(`Server exited: ${log.slice(-1800)}`);
    await pause(150);
  }
  try { process.kill(-child.pid, "SIGTERM"); } catch {}
  throw Error(`Server did not become ready: ${log.slice(-1800)}`);
}
async function stop(server) {
  try { process.kill(-server.child.pid, "SIGTERM"); } catch {}
  await Promise.race([new Promise((done) => server.child.once("exit", done)), pause(1500)]);
}
async function originalRuntime() {
  const directory = join(work, "runtime-original");
  try { await stat(join(directory, "server.js")); }
  catch {
    let frozenRuntime = false;
    try { await stat(join(root, "artifacts/v2/runtime-hardened/server.js")); frozenRuntime = true; } catch {}
    await cp(join(root, frozenRuntime ? "artifacts/v2/runtime-hardened" : ".next/standalone"), directory, { recursive: true });
    if (frozenRuntime) {
      const collection = JSON.parse(await readFile(join(root, "evidence/v2/collection.json"), "utf8"));
      for (const target of Object.values(collection.targets)) await cp(join(root, "artifacts/v2", target.target), join(directory, target.source));
    }
  }
  return directory;
}

async function check(trial) {
  const protocol = JSON.parse(await readFile(join(evidence, "protocol.json"), "utf8"));
  const controlRun = trial === "control";
  assert.ok(controlRun || protocol.trialNames.includes(trial));
  const raw = await readFile(join(evidence, "reference.json"), "utf8"); assert.equal(sha(raw), protocol.referenceSha256);
  const reference = JSON.parse(raw); const results = [];
  const candidateDirectory = controlRun ? await originalRuntime() : join(control, trial, "app");
  const paths = { baselineDispatch: join(work, `${trial}-original-dispatch.sqlite`), baselineQuote: join(work, `${trial}-original-quotes.sqlite`), cloneDispatch: join(candidateDirectory, ".data/evaluation-dispatch.sqlite"), cloneQuote: join(candidateDirectory, ".data/evaluation-quotes.sqlite") };
  let original = await serve(await originalRuntime(), 4370, { DISPATCH_DB_PATH: paths.baselineDispatch, DEMO_DB_PATH: paths.baselineQuote });
  let clone;
  try { clone = await serve(candidateDirectory, Number(process.env.FULL_APP_PORT || (controlRun ? 4373 : trial === "trial-a" ? 4371 : 4372)), { DISPATCH_DB_PATH: paths.cloneDispatch, DEMO_DB_PATH: paths.cloneQuote }, !controlRun); }
  catch (e) { await save(join(evidence, trial, "app-check.json"), { trial, ready: false, error: e.message, cases: reference.length }); await stop(original); process.exitCode = 1; return; }
  async function record(category, name, fn) {
    try { await fn(); results.push({ category, name, passed: true }); }
    catch (e) { results.push({ category, name, passed: false, error: String(e.message).slice(0, 1800) }); }
  }
  const semantic = [];
  try {
    for (const item of reference) {
      const [a, b] = await Promise.all([request(original.origin, "/api/plans", { method: "POST", json: { batchId: null, scenario: item.scenario } }), request(clone.origin, "/api/plans", { method: "POST", json: { batchId: null, scenario: item.scenario } })]);
      assert.equal(a.status, 201); assert.deepEqual(a.body.plan, item.result, "Original runtime must match the frozen reference"); created(a, "plan");
      if (controlRun && item.id === reference[0].id) {
        const wrong = structuredClone(b); wrong.body.plan.objectiveCents++;
        assert.throws(() => compare(a, wrong));
        assert.throws(() => validatePlan(wrong.body.plan, dispatchModel, item.scenario, item.result.objectiveCents));
      }
      await record("dispatch-exact", item.id, async () => { created(b, "plan"); compare(a, b); });
      try { assert.equal(b.status, 201); validatePlan(b.body.plan, dispatchModel, item.scenario, item.result.objectiveCents); semantic.push({ id: item.id, passed: true }); }
      catch (e) { semantic.push({ id: item.id, passed: false, error: String(e.message).slice(0, 800) }); }
    }
    const invalid = [
      ["malformed-json", "{", "application/json"], ["null", "null", "application/json"], ["array", "[]", "application/json"], ["empty", "{}", "application/json"],
      ["bad-batch", JSON.stringify({ batchId: "bad", scenario: baseScenario }), "application/json"],
      ["forged-price", JSON.stringify({ batchId: null, scenario: baseScenario, objectiveCents: 1 }), "application/json"],
      ["unknown-road", JSON.stringify({ batchId: null, scenario: { ...baseScenario, closedRoads: ["invented"] } }), "application/json"],
      ["duplicate-courier", JSON.stringify({ batchId: null, scenario: { ...baseScenario, disabledCouriers: ["cargo", "cargo"] } }), "application/json"],
      ["unknown-courier", JSON.stringify({ batchId: null, scenario: { ...baseScenario, disabledCouriers: ["invented"] } }), "application/json"],
      ["float-time", JSON.stringify({ batchId: null, scenario: { ...baseScenario, startMinute: 540.5 } }), "application/json"],
      ["early-time", JSON.stringify({ batchId: null, scenario: { ...baseScenario, startMinute: 479 } }), "application/json"],
      ["late-time", JSON.stringify({ batchId: null, scenario: { ...baseScenario, startMinute: 721 } }), "application/json"],
      ["string-urgent", JSON.stringify({ batchId: null, scenario: { ...baseScenario, urgent: "true" } }), "application/json"],
      ["unknown-scenario-field", JSON.stringify({ batchId: null, scenario: { ...baseScenario, extra: 1 } }), "application/json"],
      ["oversized", "x".repeat(2049), "application/json"], ["unicode-byte-limit", JSON.stringify({ note: "é".repeat(1100) }), "application/json"],
      ["wrong-content-type", "{}", "text/plain"],
    ];
    for (const [name, body, contentType] of invalid) await record("dispatch-validation", name, async () => {
      const [a, b] = await Promise.all([request(original.origin, "/api/plans", { method: "POST", body, contentType }), request(clone.origin, "/api/plans", { method: "POST", body, contentType })]); compare(a, b);
    });
    for (const id of ["not-an-id", randomUUID(), randomUUID().toUpperCase()]) for (const method of ["GET", "POST"]) await record("dispatch-validation", `missing-${method}-${id === "not-an-id" ? "invalid" : "uuid"}`, async () => compare(await request(original.origin, `/api/plans/${id}`, { method }), await request(clone.origin, `/api/plans/${id}`, { method })));
    for (const item of quoteCases) await record("legacy-quote", item.id, async () => {
      const [a, b] = await Promise.all([request(original.origin, "/api/quote", { method: "POST", json: item.input }), request(clone.origin, "/api/quote", { method: "POST", json: item.input })]);
      if (a.status === 201) { created(a, "quote"); created(b, "quote"); assert.deepEqual(a.body.quote, calculateQuote(item.input)); }
      compare(a, b);
    });
    const createBoth = async (scenario = baseScenario, batchIds = [null, null]) => {
      const pair = await Promise.all([original, clone].map((server, i) => request(server.origin, "/api/plans", { method: "POST", json: { batchId: batchIds[i], scenario } })));
      assert.equal(pair[0].status, 201); assert.equal(pair[1].status, 201);
      for (const r of pair) { assert.ok(uuid(r.body.id)); assert.ok(uuid(r.body.batchId)); }
      return pair.map((r) => r.body);
    };
    let durablePlans; let durableQuotes; let expiringQuotes;
    await record("dispatch-workflow", "save-read-commit-idempotent", async () => {
      const pair = await createBoth(); const committed = [];
      for (let i = 0; i < 2; i++) {
        const server = [original, clone][i]; const path = `/api/plans/${pair[i].id}`;
        assert.deepEqual((await request(server.origin, path)).body, pair[i]);
        const saved = await request(server.origin, path, { method: "POST" }); assert.equal(saved.status, 200); assert.equal(saved.body.state, "committed"); assert.equal(saved.body.events.length, 2);
        assert.equal(saved.body.events[1].type, "committed");
        assert.ok(Date.parse(saved.body.events[1].at) >= Date.parse(saved.body.events[0].at));
        assert.ok(Date.parse(saved.body.events[1].at) >= saved.started - 2000 && Date.parse(saved.body.events[1].at) <= saved.ended + 2000);
        assert.deepEqual((await request(server.origin, path, { method: "POST" })).body, saved.body);
        assert.deepEqual((await request(server.origin, path)).body, saved.body);
        committed.push(saved.body);
      }
      durablePlans = committed; compare({ status: 200, body: committed[0] }, { status: 200, body: committed[1] });
    });
    await record("dispatch-workflow", "saved-query-restores-server-rendered-plan", async () => {
      assert.ok(durablePlans, "Save workflow must establish the durable records first.");
      for (let i = 0; i < 2; i++) {
        const html = await request([original, clone][i].origin, `/?plan=${durablePlans[i].id}`);
        assert.equal(html.status, 200); assert.ok(html.body.includes(durablePlans[i].id)); assert.ok(/Dispatch confirmed|Dispatched/.test(html.body));
      }
    });
    await record("dispatch-workflow", "replan-excludes-reservations-and-new-urgent-cannot-reuse-courier", async () => {
      assert.ok(durablePlans); const remaining = await createBoth({ ...baseScenario, urgent: true }, durablePlans.map((p) => p.batchId));
      assert.equal(remaining[0].plan.delivered, 0); assert.equal(remaining[1].plan.delivered, 0); assert.equal(remaining[1].plan.totalShipments, 1);
      for (let i = 0; i < 2; i++) assert.equal((await request([original, clone][i].origin, `/api/plans/${remaining[i].id}`, { method: "POST" })).status, 409);
    });
    await record("dispatch-workflow", "competing-drafts-conflict-and-loser-is-unchanged", async () => {
      const first = await createBoth(); const second = await createBoth(baseScenario, first.map((p) => p.batchId));
      for (let i = 0; i < 2; i++) {
        const server = [original, clone][i]; const drafts = [first[i], second[i]];
        const outcomes = await Promise.all(drafts.map((d) => request(server.origin, `/api/plans/${d.id}`, { method: "POST" })));
        assert.deepEqual(outcomes.map((r) => r.status).sort(), [200, 409]);
        const loser = drafts[outcomes.findIndex((r) => r.status === 409)]; assert.deepEqual((await request(server.origin, `/api/plans/${loser.id}`)).body, loser);
        const winner = outcomes.find((r) => r.status === 200).body; assert.deepEqual((await request(server.origin, `/api/plans/${winner.id}`, { method: "POST" })).body, winner);
      }
    });
    await record("dispatch-workflow", "disjoint-shipments-same-courier-conflict", async () => {
      const first = await createBoth({ ...baseScenario, disabledCouriers: ["sprinter", "cargo"], startMinute: 570 });
      const second = await createBoth({ ...baseScenario, disabledCouriers: ["sprinter", "cargo"], urgent: true, closedRoads: ["central-east", "ridge-east", "north-east-trail"] }, first.map((p) => p.batchId));
      const conflicts = [];
      for (let i = 0; i < 2; i++) {
        assert.equal((await request([original, clone][i].origin, `/api/plans/${first[i].id}`, { method: "POST" })).status, 200);
        conflicts.push(await request([original, clone][i].origin, `/api/plans/${second[i].id}`, { method: "POST" }));
        assert.equal(conflicts[i].status, 409); assert.deepEqual((await request([original, clone][i].origin, `/api/plans/${second[i].id}`)).body, second[i]);
      }
      compare(...conflicts);
    });
    await record("dispatch-workflow", "empty-plan-cannot-commit", async () => {
      const pair = await createBoth({ ...baseScenario, disabledCouriers: ["sprinter", "coldbox", "cargo"] });
      const errors = await Promise.all([original, clone].map((server, i) => request(server.origin, `/api/plans/${pair[i].id}`, { method: "POST" })));
      assert.equal(errors[0].status, 409); compare(...errors);
    });
    await record("dispatch-workflow", "simultaneous-retries-create-one-event", async () => {
      const pair = await createBoth();
      for (let i = 0; i < 2; i++) {
        const replies = await Promise.all([1, 2, 3].map(() => request([original, clone][i].origin, `/api/plans/${pair[i].id}`, { method: "POST" })));
        assert.ok(replies.every((r) => r.status === 200)); assert.equal(replies[0].body.events.length, 2);
        assert.deepEqual(replies[0].body, replies[1].body); assert.deepEqual(replies[1].body, replies[2].body);
      }
    });
    await record("legacy-workflow", "quote-save-read-book-retry", async () => {
      const pair = await Promise.all([original, clone].map((s) => request(s.origin, "/api/quote", { method: "POST", json: quoteBase })));
      compare(...pair); durableQuotes = [];
      for (let i = 0; i < 2; i++) {
        const server = [original, clone][i]; const path = `/api/quotes/${pair[i].body.id}`;
        assert.deepEqual((await request(server.origin, path)).body, pair[i].body);
        const booked = await request(server.origin, path, { method: "POST" }); assert.equal(booked.body.state, "booked");
        assert.deepEqual((await request(server.origin, path, { method: "POST" })).body, booked.body); durableQuotes.push(booked.body);
      }
      expiringQuotes = (await Promise.all([original, clone].map((s) => request(s.origin, "/api/quote", { method: "POST", json: quoteBase })))).map((r) => r.body);
    });
    await record("durability", "both-apps-restart-with-same-database", async () => {
      const prior = [original, clone]; await Promise.all(prior.map(stop));
      original = await serve(prior[0].directory, prior[0].port, prior[0].env, false); clone = await serve(prior[1].directory, prior[1].port, prior[1].env, !controlRun);
    });
    await record("durability", "dispatch-record-survives-restart-in-sqlite", async () => {
      assert.ok(durablePlans);
      for (let i = 0; i < 2; i++) {
        assert.deepEqual((await request([original, clone][i].origin, `/api/plans/${durablePlans[i].id}`)).body, durablePlans[i]);
      }
      assert.equal((await readFile(paths.cloneDispatch)).subarray(0, 16).toString(), "SQLite format 3\u0000");
      const db = new DatabaseSync(paths.cloneDispatch, { readOnly: true });
      try {
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
        assert.ok(tables.some((t) => JSON.stringify(db.prepare(`SELECT * FROM "${String(t.name).replaceAll('"', '""')}"`).all()).includes(durablePlans[1].id)), "The plan must actually be stored in SQLite, not just a header-shaped file");
      } finally { db.close(); }
    });
    await record("legacy-workflow", "quote-record-survives-restart-in-sqlite", async () => {
      assert.ok(durableQuotes);
      for (let i = 0; i < 2; i++) {
        assert.deepEqual((await request([original, clone][i].origin, `/api/quotes/${durableQuotes[i].id}`)).body, durableQuotes[i]);
      }
      assert.equal((await readFile(paths.cloneQuote)).subarray(0, 16).toString(), "SQLite format 3\u0000");
    });
    await record("durability", "restart-preserves-reservations-and-commit-idempotency", async () => {
      assert.ok(durablePlans);
      const remaining = await createBoth({ ...baseScenario, urgent: true }, durablePlans.map((p) => p.batchId));
      for (let i = 0; i < 2; i++) {
        assert.equal(remaining[i].plan.delivered, 0); assert.equal(remaining[i].plan.totalShipments, 1);
        assert.deepEqual((await request([original, clone][i].origin, `/api/plans/${durablePlans[i].id}`, { method: "POST" })).body, durablePlans[i]);
      }
    });
    for (const [name, body, contentType] of [["malformed", "{", "application/json"], ["forged-price", JSON.stringify({ ...quoteBase, totalCents: 1 }), "application/json"], ["oversized", "x".repeat(2049), "application/json"], ["wrong-media", "{}", "text/plain"]]) await record("legacy-validation", name, async () => {
      compare(await request(original.origin, "/api/quote", { method: "POST", body, contentType }), await request(clone.origin, "/api/quote", { method: "POST", body, contentType }));
    });
    for (const method of ["GET", "POST"]) await record("legacy-validation", `missing-${method}`, async () => {
      const id = randomUUID(); compare(await request(original.origin, `/api/quotes/${id}`, { method }), await request(clone.origin, `/api/quotes/${id}`, { method }));
    });
    await record("legacy-workflow", "expiry-rejects-unbooked-and-preserves-booked-retries", async () => {
      assert.ok(expiringQuotes && durableQuotes);
      const prior = [original, clone]; await Promise.all(prior.map(stop));
      const next = [];
      for (const server of prior) {
        const clock = join(server.directory, ".data/evaluation-clock.cjs"); await mkdir(dirname(clock), { recursive: true });
        await writeFile(clock, 'const RealDate=Date; const offset=Number(process.env.EVAL_CLOCK_OFFSET_MS||0); function ShiftedDate(...args){if(!new.target)return new RealDate(RealDate.now()+offset).toString();return new RealDate(...(args.length?args:[RealDate.now()+offset]));} Object.setPrototypeOf(ShiftedDate,RealDate); ShiftedDate.prototype=RealDate.prototype; ShiftedDate.parse=RealDate.parse; ShiftedDate.UTC=RealDate.UTC; ShiftedDate.now=()=>RealDate.now()+offset; global.Date=ShiftedDate;\n');
        next.push(await serve(server.directory, server.port, { ...server.env, EVAL_CLOCK_MODULE: clock, EVAL_CLOCK_OFFSET_MS: "660000" }, server.sandbox));
      }
      [original, clone] = next;
      const errors = [];
      for (let i = 0; i < 2; i++) {
        const server = [original, clone][i];
        errors.push(await request(server.origin, `/api/quotes/${expiringQuotes[i].id}`, { method: "POST" })); assert.equal(errors[i].status, 410);
        assert.deepEqual((await request(server.origin, `/api/quotes/${durableQuotes[i].id}`, { method: "POST" })).body, durableQuotes[i]);
      }
      compare(...errors);
    });
    const categories = {};
    for (const item of results) { categories[item.category] ||= { total: 0, passed: 0 }; categories[item.category].total++; categories[item.category].passed += Number(item.passed); }
    const report = { trial, variant: controlRun ? "original-vs-original control" : protocol.inputSets[trial].variant, ready: true, referenceSha256: sha(raw), categories, negativeControlWrongObjectiveRejected: controlRun || undefined, dispatchSemantic: { total: semantic.length, passed: semantic.filter((r) => r.passed).length }, results, semanticFailures: semantic.filter((r) => !r.passed).slice(0, 16), scope: "Live reconstructed production server compared against original. Exact checks normalize only validated random IDs/timestamps; semantic planner checks separately accept tied optima. Browser checks recorded separately. One reconstruction attempt per variant; no feedback/repairs." };
    if (results.some((r) => !r.passed)) await writeFile(join(evidence, trial, "server-log-tail.txt"), `ORIGINAL\n${original.log().slice(-6000)}\nRECONSTRUCTION\n${clone.log().slice(-6000)}`.replaceAll(root, "<repo>").replaceAll(control, "<trial-root>"));
    await save(join(evidence, trial, "app-check.json"), report);
    if (results.some((r) => !r.passed)) process.exitCode = 1;
    console.log(JSON.stringify({ trial, categories, dispatchSemantic: report.dispatchSemantic, failures: results.filter((r) => !r.passed).slice(0, 6) }, null, 2));
    if (process.env.FULL_APP_KEEP_SERVERS !== "1") { await stop(original); await stop(clone); }
    else console.log(`Kept original ${original.origin} and reconstruction ${clone.origin} running.`);
  } catch (e) { await stop(original); await stop(clone); throw e; }
}

if (process.argv[1] && resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  if (process.argv[2] === "check") await check(process.argv[3]);
  else if (process.argv[2] === "original") {
    const s = await serve(await originalRuntime(), 4370, { DISPATCH_DB_PATH: join(work, "browser-original-dispatch.sqlite"), DEMO_DB_PATH: join(work, "browser-original-quotes.sqlite") }); console.log(s.origin);
  } else if (process.argv[2] === "view") {
    const trial = process.argv[3]; assert.ok(["trial-a", "trial-b"].includes(trial));
    const directory = join(control, trial, "app");
    const s = await serve(directory, trial === "trial-a" ? 4371 : 4372, { DISPATCH_DB_PATH: join(directory, ".data/browser-dispatch.sqlite"), DEMO_DB_PATH: join(directory, ".data/browser-quotes.sqlite") }, true); console.log(s.origin);
  } else throw Error("Use check trial-a|trial-b, view trial-a|trial-b or original");
}
