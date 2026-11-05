import { readFile, writeFile, mkdir, cp } from "node:fs/promises";
import { gzipSync } from "node:zlib";

const read = async (name) => JSON.parse(await readFile(`evidence/${name}.json`, "utf8"));
const summary = {
  checkedDate: "2026-11-06",
  scope: "One browser page chunk, one copied server API route chunk, one source-limited recovery attempt per variant. Static REA CLI plus model-assisted artifact inspection; no live API used during recovery. Instructional isolation, not an OS sandbox. Single-run timings are observations, not comparative performance benchmarks.",
  collection: await read("collection"),
  sizes: await read("sizes"),
  variants: {},
};
await mkdir("evidence/artifacts", { recursive: true });
for (const stage of ["before", "after"]) {
  const variant = { api: await read(`api-${stage}`), recovery: await read(`recovery-${stage}`), analysis: {} };
  for (const kind of ["browser", "server"]) {
    const raw = await readFile(`evidence/rea-${kind}-${stage}.json`, "utf8");
    const { milliseconds, output } = JSON.parse(raw);
    const normalized = output.normalized_result;
    const graph = normalized.semantic_graph;
    variant.analysis[kind] = { milliseconds, statistics: normalized.statistics, nodes: graph.nodes.length, relations: graph.relations.length, unknowns: graph.unknowns.length, coverage: graph.coverage, limitations: output.limitations };
    await writeFile(`evidence/rea-${kind}-${stage}.json.gz`, gzipSync(raw));
    const target = kind === "browser" ? "app.js" : "engine.js";
    await cp(`artifacts/${stage === "before" ? "before" : "hardened/before"}/${kind}/${target}`, `evidence/artifacts/${stage}-${kind}.js`);
    await writeFile(`evidence/artifacts/${stage}-${kind}.js.gz`, gzipSync(await readFile(`evidence/artifacts/${stage}-${kind}.js`)));
  }
  summary.variants[stage] = variant;
}
summary.rrs = { browser: (await read("rrs-browser")).output, server: (await read("rrs-server")).output };
await writeFile("evidence/summary.json", `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify({ cases: summary.collection.scenarioCount, beforeMatches: summary.variants.before.recovery.matched, afterMatches: summary.variants.after.recovery.matched, browserGzipMultiplier: +(summary.sizes.browser.after.gzipBytes / summary.sizes.browser.before.gzipBytes).toFixed(2), serverGzipMultiplier: +(summary.sizes.server.after.gzipBytes / summary.sizes.server.before.gzipBytes).toFixed(2) }));
