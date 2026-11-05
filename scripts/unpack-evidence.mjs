import { readFile, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

const sizes = JSON.parse(await readFile("evidence/sizes.json", "utf8"));
for (const stage of ["before", "after"]) {
  for (const kind of ["browser", "server"]) {
    const file = `evidence/artifacts/${stage}-${kind}.js`;
    const bytes = gunzipSync(await readFile(`${file}.gz`));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), sizes[kind][stage].sha256);
    await writeFile(file, bytes);
    console.log(`Verified and unpacked ${file}`);
  }
}
