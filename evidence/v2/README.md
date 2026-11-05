# V2 evaluation evidence

The production standalone app was exercised at `http://127.0.0.1:4330` with a dedicated local SQLite database. All data is fictional.

**Completed result:** three of three original and three of three hardened recoveries passed every check (768 rows / 767 distinct inputs). Median attempt time: 120.787 → 158.864 seconds; median uncached input: 29,820 → 47,242 tokens; median output: 8,330 → 10,821 tokens. Every attempt finished within 480 seconds. [Machine-readable summary](summary.json) · [Post-run integrity checks](integrity.json).

- `functional-checks.json`: nine running-API checks, including replanning, strict request validation, persistence, idempotent retry, shipment conflicts and a courier conflict between drafts with disjoint shipments.
- `dispatch-desktop.png`: the normal six-shipment draft, real computed paths and $54.83 objective.
- `dispatch-overview.png`: a crop of the same desktop capture for the repository overview.
- `dispatch-bridge-closed.png`: all six delivered after a detour, at $62.03.
- `dispatch-urgent.png`: urgent medical shipment changes assignment; P106 is unassigned, with $149.37 objective including penalty.
- `dispatch-committed.png`: committed state restored after reload, used couriers disabled and one persisted reservation event.
- `dispatch-mobile.png`: the same committed state at a 390 × 844 viewport. The wide shipment table scrolls horizontally.

Browser checks also confirmed stale routes disappear when constraints change, saved draft URLs restore the selected scenario, and a new batch resets the planning controls. The viewport override was reset after testing.

## Analysis and recovery records

- `collection.json`: application commit, exact compiled input paths/hashes and the pre-attempt reference commitment.
- `sizes.json`, `die-plan.json`, `die-build.json`, `rrs-*.json`: actual full-default High build and final file sizes; all four JavaScript adapter calls succeeded. RRS is a static proxy, not a recovery percentage. Generated noise counters precede engine processing and can overstate retained noise.
- `rea-*.json.gz`: complete static reports for four original and four hardened chunks. `rea-summary.json` records parse success, timings and semantic truncation. All hardened graphs hit the matched 12,000-node/4,000-unknown limits; original graphs did not.
- `api-reference-before.json`, `api-reference-after.json`: all 417 frozen cases with no reserved resources passed complete-plan comparison against both real servers.
- `functional-after.json`: the separate nine workflow checks against the hardened runtime. `hardened-dispatched.png` shows a committed urgent plan restored after reload in Chrome.
- `recovery-protocol.json`: prompt, contract, requested model/settings, order, scope and ceilings recorded before attempt one. Same frozen artifacts and reports were supplied to each matching variant.
- `recoveries/attempt-*/`: each first-final standalone candidate, analyst method report, CLI usage/time record and independent score. Agent self-check counts in reports are supplementary and are not the parent-held-out score.
- `oracle-check.json`: independent exact-solver certification of all frozen objectives, added after freezing without changing references or recovery inputs.
- `case-coverage.json`: 768 rows / 767 distinct inputs, including 458 empty/no-delivery plans, 310 with deliveries and 116 with multiple couriers. One duplicate was retained rather than changing the frozen commitment; scoring reports distinct-input matches too.

Original and hardened recovery are a **copied-server-build** access condition. A website visitor was not given these server files. Recovery targets the planner and reserved-resource exclusions, not an entire application clone. Browser/HTTP/persistence behavior is checked for preservation separately.

The macOS policy denied reads of source/reference/session and peer-attempt locations, but did not confine all writes or all locations; network avoidance was instructional. Retained hash checks audit integrity. Raw model JSONL/diagnostics remain local; public records do not expose credentials or model reasoning transcripts. Requested `gpt-6.1-sol`/high settings were matched; CLI missing-metadata warnings mean resolved backend model identity is not independently attested. Tokens, cache effects and wall times are measurements, not a dollar-cost calculation or model-wide benchmark.

The original feasibility scorer was strengthened during review with bounded, import-free VM candidate execution; all six final submissions are evaluated under the same resulting scorer. Independent optimum certification and duplicate auditing were also added after freezing; no original cases or submitted candidates changed, and no score feedback reached any analyst. VM checks enforce the finished-module contract and time limits; they are not an adversarial JavaScript security boundary.

## Replay

After publication, `artifacts/*.js.gz` contains the eight immutable snapshots and `reference.json` preserves the byte-identical pre-attempt commitment. Run:

```sh
node scripts/v2-lab.mjs unpack
node scripts/check-v2-oracle.mjs
node --experimental-vm-modules scripts/v2-lab.mjs score \
  evidence/v2/recoveries/attempt-1-before/recovered.mjs
```

The references are now disclosed, so this replay is not a fresh blind attempt. [Full setup, protection and recovery commands](../../docs/v2-reproduction.md) · [Method review](../../docs/v2-method-review.md). Historical V1 scores and bundle sizes remain separate.
