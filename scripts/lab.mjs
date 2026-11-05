import { cp, mkdir, readFile, writeFile, readdir, stat } from "node:fs/promises";
import { resolve, join, relative } from "node:path";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { calculateQuote } from "../src/lib/quote.ts";
import { scenarios } from "../test/scenarios.mjs";

const root = resolve(import.meta.dirname, "..");
const artifacts = join(root, "artifacts");
const evidence = join(root, "evidence");
const toolRepo = resolve(process.env.DIREA_REPO || join(root, ".tools/die-a-rea"));
const direa = process.env.DIREA_BIN || join(toolRepo, "target/release/die-a-rea");
const sha = (value) => createHash("sha256").update(value).digest("hex");
await mkdir(evidence, { recursive: true });
async function save(name, data) { await writeFile(join(evidence, `${name}.json`), `${JSON.stringify(data, null, 2).replaceAll(toolRepo, "<die-a-rea>").replaceAll(root, "<repo>")}\n`); }
function run(command, args, cwd = root) {
  const started = performance.now();
  const result = spawnSync(command, args, {
    cwd, encoding: "utf8", timeout: 120000, maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, NODE_PATH: join(root, "node_modules"), DIREA_JS_ADAPTER: join(toolRepo, "adapters/js/direa-js") },
  });
  if (result.error || result.status !== 0) throw new Error(`${command} ${args.join(" ")}\n${result.error || result.stderr || result.stdout}`);
  return { milliseconds: Math.round(performance.now() - started), output: JSON.parse(result.stdout) };
}
async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const groups = await Promise.all(entries.map((entry) => entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]));
  return groups.flat();
}
async function metadata(path) {
  const bytes = await readFile(path);
  return { bytes: bytes.length, gzipBytes: gzipSync(bytes).length, sha256: sha(bytes) };
}

const command = process.argv[2];
if (command === "collect") {
  const browserFiles = (await files(join(root, ".next/static/chunks/app"))).filter((file) => /\/page-[^/]+\.js$/.test(file));
  const browser = [];
  for (const file of browserFiles) if ((await readFile(file, "utf8")).includes("/api/quote")) browser.push(file);
  if (browser.length !== 1) throw new Error(`Expected one page chunk, found ${browser.length}.`);
  const targets = { browser: browser[0], server: join(root, ".next/server/app/api/quote/route.js") };
  const manifest = {};
  for (const [kind, original] of Object.entries(targets)) {
    const target = join(artifacts, "before", kind, kind === "browser" ? "app.js" : "engine.js");
    await mkdir(resolve(target, ".."), { recursive: true });
    await cp(original, target);
    manifest[kind] = { source: relative(root, original), target: relative(artifacts, target), ...await metadata(target) };
  }
  const reference = scenarios.map(({ id, input }) => {
    try { return { id, input, result: calculateQuote(input) }; } catch { return { id, input, rejected: true }; }
  });
  const publicFiles = await files(join(root, ".next/static"));
  const leakedMarkers = [];
  for (const file of publicFiles) {
    const text = await readFile(file, "utf8");
    for (const marker of ["NIGHTOWL17", "BULKLANE", "2026-11-11"]) if (text.includes(marker)) leakedMarkers.push({ path: relative(root, file), marker });
  }
  await save("collection", { node: process.version, next: "16.4.5", rea: "6.8.0", obfuscator: "5.10.0", dieCommit: "0d322552673309372f9937bc5f0c50641ed1514e", scope: "One application browser chunk; one API route chunk representing copied server access. Neither snapshot includes source, tests, node_modules or unrelated Next runtime files.", targets: manifest, scenarioCount: scenarios.length, referenceSha256: sha(JSON.stringify(reference)), publicFilesScanned: publicFiles.length, leakedMarkers });
  await writeFile(join(artifacts, "reference.json"), JSON.stringify(reference, null, 2));
  console.log(JSON.stringify({ targets: manifest, scenarioCount: scenarios.length, leakedMarkers }, null, 2));
} else if (command === "analyze") {
  const stage = process.argv[3];
  if (stage !== "before" && stage !== "after") throw new Error("Use analyze before or analyze after.");
  for (const kind of ["browser", "server"]) {
    const target = stage === "before" ? join(artifacts, "before", kind) : join(artifacts, "hardened/before", kind);
    const result = run(process.execPath, [join(root, "node_modules/rea-agents/scripts/rea.mjs"), "analyze-javascript-application", target, "--max-semantic-nodes", "12000", "--max-semantic-nodes-per-file", "12000", "--max-semantic-unknowns", "4000", "--max-semantic-unknowns-per-file", "4000", "--analysis-timeout-ms", "60000", "--max-heap-mb", "1024", "--format", "json"]);
    const text = JSON.stringify(result, null, 2).replaceAll(root, "<repo>").replaceAll(toolRepo, "<die-a-rea>");
    await writeFile(join(evidence, `rea-${kind}-${stage}.json`), `${text}\n`);
    await writeFile(join(evidence, `rea-${kind}-${stage}.json.gz`), gzipSync(`${text}\n`));
    console.log(`${kind} ${stage}: ${result.milliseconds} ms, ${text.length} report characters`);
  }
} else if (command === "harden") {
  await save("die-plan", run(direa, ["--manifest", "../die-a-rea.toml", "plan", "--json"], artifacts));
  await save("die-build", run(direa, ["--manifest", "../die-a-rea.toml", "build", "--out", "hardened", "--seed", "20261106", "--json"], artifacts));
  const collection = JSON.parse(await readFile(join(evidence, "collection.json"), "utf8"));
  const results = {};
  for (const [kind, target] of Object.entries(collection.targets)) {
    const hardened = join("hardened", target.target);
    results[kind] = { before: await metadata(join(artifacts, target.target)), after: await metadata(join(artifacts, hardened)) };
    await save(`rrs-${kind}`, run(direa, ["verify", "--original", target.target, "--hardened", hardened, "--build-meta", "hardened/die-a-rea.build.json", "--json"], artifacts));
  }
  await save("sizes", results);
  console.log(JSON.stringify(results, null, 2));
} else if (command === "runtime") {
  const collection = JSON.parse(await readFile(join(evidence, "collection.json"), "utf8"));
  const runtime = join(artifacts, "runtime-hardened");
  try { await stat(runtime); throw new Error("The hardened runtime already exists. Use a fresh artifacts directory for another experiment."); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  await cp(join(root, ".next/standalone"), runtime, { recursive: true });
  await cp(join(root, ".next/static"), join(runtime, ".next/static"), { recursive: true });
  for (const target of Object.values(collection.targets)) await cp(join(artifacts, "hardened", target.target), join(runtime, target.source));
  console.log(`Hardened standalone: ${relative(root, runtime)}/server.js`);
} else {
  throw new Error("Use: npm run lab -- collect | analyze before | harden | analyze after | runtime");
}
