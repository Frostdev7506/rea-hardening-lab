# Reproducing the V2 evaluation

The tested application source is commit `cb1776ef2b232f25133e7ce86155734e5ebb13d8`. Later evaluation commits add scripts/evidence, not application behavior. Use Node 24.22.2 and `npm ci`. Historical references become public after the original six attempts, so replaying them is a reproducibility check rather than a fresh blind recovery test.

## Replay the recorded snapshots and scores

```sh
node scripts/v2-lab.mjs unpack
node scripts/check-v2-oracle.mjs
node --experimental-vm-modules scripts/v2-lab.mjs score \
  evidence/v2/recoveries/attempt-1-before/recovered.mjs
```

`unpack` restores eight `.js.gz` snapshots and the byte-identical reference into ignored `artifacts/v2/`, checking every SHA-256 commitment first. Substitute another candidate path to replay the other five. Recovery candidates have no imports or runtime file dependencies. The scorer evaluates them in a VM without Node process/filesystem/network globals, rejects imports, and bounds initialization and each function call. These are contract/timeout checks, not a claim that Node's VM is an adversarial security boundary.

`check-v2-oracle.mjs` independently certifies every frozen optimal objective using Floyd–Warshall, route-prefix enumeration and disjoint-assignment dynamic programming. The independent feasibility grader checks complete returned walks/timings, resource use and recomputed cost. Alternative tied optima are accepted. The second solver and VM execution checks were added during method review after case freezing; original reference bytes and candidate submissions were not changed or fed back to the analysts.

## Run a new experiment

Use a separate checkout/output directory. The scripts refuse to recollect over an existing `evidence/v2/collection.json` or overwrite an existing hardened runtime. Preserve the historical evidence before starting a new run.

Build the tool at the exact recorded revision, following the main README's Rust setup. Point `DIREA_REPO` at that checkout; the JavaScript adapter uses this application's installed obfuscator. The required policy is in `die-a-rea-v2.toml`: High, full upstream defaults, default notice and prompt gate. No compatibility patch or custom engine-strength override was applied.

```sh
npm ci
npm test
npm run build
node scripts/v2-lab.mjs collect
node scripts/v2-lab.mjs analyze before
DIREA_REPO=/absolute/path/to/die-a-rea node scripts/v2-lab.mjs harden
node scripts/v2-lab.mjs analyze after
node scripts/v2-lab.mjs runtime
```

Start the original standalone app on port 4330 and the hardened standalone copy on 4331, with separate `DISPATCH_DB_PATH` values. Use the `PORT` and `HOSTNAME=127.0.0.1` environment variables.

```sh
PORT=4331 HOSTNAME=127.0.0.1 DISPATCH_DB_PATH=/tmp/dispatch-hardened.sqlite \
  node artifacts/v2/runtime-hardened/server.js
```

Against each server, run the frozen no-reservation subset and the stateful workflow checks. Use new output filenames for a new run.

```sh
node scripts/check-v2-reference-api.mjs http://127.0.0.1:4331 /tmp/reference-after.json
npm run test:dispatch -- http://127.0.0.1:4331 /tmp/workflow-after.json
```

Also exercise the hardened browser UI: plan, change a constraint, replan, dispatch and reload. Syntax/adapter completion is insufficient to prove that the transformed Next.js exports and hydration still work.

## Recorded recovery runner

The original recovery runner uses macOS Seatbelt and the already authenticated local Codex CLI. It does not install credentials or read credential contents. Pass the intended configured model/effort explicitly, and retain provider/model-attestation limitations rather than assuming the requested alias proves the backend identity.

```sh
V2_RECOVERY_DIR=/absolute/path/to/a/new/empty-run-directory \
V2_CODEX_BIN=/absolute/path/to/codex \
V2_MODEL=your-configured-model V2_REASONING=your-configured-effort \
  node scripts/v2-recover.mjs
```

The script freezes the order and prompt before attempts, runs six fresh contexts serially with 480-second ceilings, verifies source/reference/peer read-denial probes, and records process wall time and CLI usage. The same original or hardened snapshots and complete REA reports are copied to each corresponding attempt. The finished candidate is copied only after the session ends, with no score feedback or revision. Standard OpenAI API credential variables are excluded from generated shell commands' environment.

The outer Seatbelt policy denies listed reads, including the source repositories, hidden reference, parent sessions/memories, other attempt directories and their private logs. It does not confine all writes or all filesystem locations. Codex's own command sandbox is disabled within that outer policy because nested Seatbelt prevented command execution in the infrastructure probe. Network avoidance is instructed, not firewalled. This is a cooperative artifact-analysis experiment, not an adversarial sandbox evaluation. Integrity is checked against the frozen hashes after the attempts.

Raw JSONL streams and diagnostics remain local; public evidence retains per-attempt usage, candidate code, method reports and independent scores. Token counts include repeated input and cache effects. Report uncached input and output separately; no dollar cost or backend-model identity is inferred from the counts. The fixed host seed does not seed the external obfuscator, so retain the final bytes rather than promising byte-identical rebuilds.
