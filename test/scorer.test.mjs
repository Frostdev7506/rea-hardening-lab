import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

test("recovery scoring fails wrong or missing implementations and accepts exact behavior", async () => {
  const directory = await mkdtemp(join(tmpdir(), "rea-scoring-"));
  try {
    await mkdir(join(directory, "artifacts"));
    await mkdir(join(directory, "evidence"));
    const reference = [{ id: "valid", input: { valid: true }, result: { totalCents: 17 } }, { id: "invalid", input: { valid: false }, rejected: true }];
    await writeFile(join(directory, "artifacts/reference.json"), JSON.stringify(reference));
    await writeFile(join(directory, "evidence/collection.json"), JSON.stringify({ referenceSha256: createHash("sha256").update(JSON.stringify(reference)).digest("hex") }));
    await writeFile(join(directory, "score.mjs"), await readFile(new URL("../scripts/score-recovery.mjs", import.meta.url)));
    const run = async (source) => {
      await writeFile(join(directory, "candidate.mjs"), source);
      return spawnSync(process.execPath, ["score.mjs", "before", "candidate.mjs"], { cwd: directory, encoding: "utf8" });
    };
    assert.equal((await run("export function calculateQuote() { throw new Error('wrong'); }")).status, 1);
    const missing = await run("export const unrelated = true;");
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /must export calculateQuote/);
    assert.equal((await run("export function calculateQuote(input) { if (!input.valid) throw new Error('rejected'); return {totalCents:17}; }")).status, 0);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
