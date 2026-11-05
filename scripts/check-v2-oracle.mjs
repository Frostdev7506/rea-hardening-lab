import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { independentObjective } from "./v2-oracle.mjs";

const raw = await readFile(new URL("../artifacts/v2/reference.json", import.meta.url), "utf8");
const collection = JSON.parse(await readFile(new URL("../evidence/v2/collection.json", import.meta.url), "utf8"));
assert.equal(createHash("sha256").update(raw).digest("hex"), collection.referenceSha256);
const cases = JSON.parse(raw);
for (const item of cases) assert.equal(independentObjective(item.scenario, item.reserved), item.result.objectiveCents, item.id);
const report = { cases: cases.length, passed: cases.length, referenceSha256: collection.referenceSha256, method: "Floyd–Warshall travel, independently enumerated route prefixes, disjoint-mask dynamic programming. Does not call planDispatch. Added as an oracle audit after freezing cases; no reference or attempt inputs changed." };
await writeFile(new URL("../evidence/v2/oracle-check.json", import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report));
