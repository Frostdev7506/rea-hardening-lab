# REA + die-a-rea: full-application follow-up

Run on 6 November 2026. **One fresh complete-app reconstruction per variant**, separate from the six [planner-only V2 attempts](../v2/README.md). Same generic Next.js scaffold, dependencies, prompt and 900-second budget. Only four primary dispatch chunks changed. Quote chunks, CSS and screenshots were identical. Neither session received source, expected outputs, earlier recoveries or grading feedback.

| First final submission | Original artifacts (A) | Hardened artifacts (B) |
| --- | ---: | ---: |
| Exact dispatch response | 312/312 | 258/312 |
| Feasible, optimal plan | 312/312 | 258/312 |
| Other selected HTTP/state checks | 84/84 | 84/84 |
| Complete check total | 396/396 | 342/396 |
| Attempt time | 433.560 seconds | 531.348 seconds |
| Uncached input tokens | 114,504 | 142,512 |
| Output tokens | 33,591 | 37,934 |

The protected reconstruction launched and persisted records, but **54 plans were suboptimal**. This is not just wording or tied-optimum selection. It took 22.555% longer and used 24.460% more uncached input, while still incorrect when it stopped. These are two attempts, not 312 reconstruction experiments; no general success rate, statistical slowdown or dollar cost follows.

At 09:30 with full fleet, open roads and no urgent kit, original and actual hardened original return **$260.87**. A agrees; B returns **$261.11** with different assignments. At 08:00, original **$140.85** becomes B **$160.22**, including a different missed shipment. See [four-way API comparison](counterexamples.json), [failure coverage](trial-b/failure-coverage.json) and [browser comparison](late-start-comparison.png). Four frozen failures are reachable through visible controls; the API accepts additional minute/closure combinations.

B compares candidate total against incumbent penalty alone and uses wrong pruning/tie bounds. Its report misidentifies this as an original bug. A separate in-memory correction matches 312/312, showing the defect is recoverable. **Submitted B remains unchanged at 258/312**. [Exact diagnosis/hashes](optimizer-diagnosis.json).

## Evidence

- [Frozen protocol/prompt](protocol.json), [raw frozen reference](reference.json), [generation seed](seed.json), [result summary](summary.json), [SHA-256 manifest](integrity.json).
- First-final source: [A](../../recoveries/full-app/trial-a), [B](../../recoveries/full-app/trial-b). Hashes match the private submissions; `.next`, `node_modules`, `.data` and Git internals excluded. Grading added runtime clock/data only under `.data`.
- Each trial retains usage, analyst report, actual REA JSON (`rea-analysis.json.gz`), command/build audit, scan summary, complete HTTP/state results and browser evidence. `inputs/*.gz` retains **every supplied input byte**, including brief/CSS/screenshots. Decompress and verify against `integrity.json`.
- [Original-vs-original control](control/app-check.json): 396/396; deliberately wrong objective rejected by exact and independent graders.
- [Actual hardened original](actual-hardened-check.json): 312/312, ruling out hardening damage to the original behavior.
- [Independent source/method audit](../../docs/full-app-method-audit.md), performed without access to either trial's results. Closeout notes appended separately.

Private raw reasoning logs are not published. `execution-audit.json` retains actual REA command events, build completion evidence and fresh session IDs.

## Checks and limits

The 312 distinct fresh-batch scenarios were frozen before reconstruction: 192 start/fleet/urgency combinations, 24 single-road/urgency combinations and 96 mixed cases. An independent objective oracle validated them at generation. The HTTP grader also checks every original result against the frozen reference before scoring the clone.

Exact checks retain costs, routes, stops, assignments, classifications, status and cache headers. Only validated random IDs/times are normalized, with creation/expiry/event-time assertions. Semantic checks independently validate roads, service timing, load, compatibility, shifts, arithmetic, penalties and optimum, accepting tied alternatives.

Other categories: dispatch validation 23; quote calculations 42; dispatch workflows 7; quote workflows 3; restart/SQLite durability 3; quote validation 6. Workflow passes establish selected invariants, not complete response parity for every transition or arbitrary reservation combination. Quote chunks were outside the hardening treatment.

Restart checks restore records/reservations from the same databases and verify IDs inside physical SQLite. A shared eleven-minute clock advance rejects unbooked expired quotes and preserves booked retries. An initial Date-hook issue was corrected in the harness before final grading; its initial control JSON/log remain as history. No candidate source changed. A port guard rejects existing listeners; final checks were replayed after adding it.

Parent Chrome checks exercise default/bridge/urgent planning, commit, saved-query reload, new batch and quote booking. A has a verified 390px capture. The viewport override did not apply to B's tab (1470px observed), so B has no claimed narrow-layout pass. Minor title/anchor wording differences are recorded. This is not exhaustive pixel or cross-browser certification.

## REA environment issue

Both analysts **actually invoked REA 6.8.0**, using limits of 12,000 semantic nodes, 4,000 unknowns and a 60-second analysis timeout. Both in-trial reports parsed all eight JavaScript files with zero parse failures. A read 130,114 bytes / visited 33,298 AST nodes; B read 861,111 bytes / visited 132,766. Both full-directory semantic graphs hit their limits. Incomplete route inventory does not establish absence of application routes. Direct inspection/decoding was allowed and used: this measures the combined analyst workflow, not REA-alone app generation or REA's incremental benefit.

**Both in-trial scans exited during cleanup after emitting valid JSON.** The shell resolved Node 24.13.1, below REA's supported patch requirement; Seatbelt also denied process-table inspection (`spawn EPERM`). Separate `sandbox-cleanup-probe.json` files reproduce the shared restriction without retaining process-list data. This is not evidence of a die-a-rea-specific failure.

After both submissions were frozen, identical scans of unchanged inputs with **explicit Node 24.22.2 outside Seatbelt exited zero for both**. Outputs and environment records use `rea-supported-node*` names. They supplied no feedback or revised candidates and do not replace trial timing. The unsupported in-trial patch and common cleanup issue limit claims about a clean supported-environment comparison. Whole-attempt effort also includes builds, self-tests and other mistakes.

Requested settings matched (`gpt-6.1-sol`, high), but CLI model metadata was missing, so resolved backend identity is not independently attested. Reconstruction filesystem policy denied owner repositories, hidden reference, peer trial, logs, sessions and memories; it was not an exclusive allowlist. Network avoidance was instructional. Production grading adds outbound restriction to the clone's own localhost port and source/peer/session/log read denials. Frozen source review found no original-artifact execution, original API proxy or reference access. Input/reference/submission hashes match.

## Reproduce retained checks

Use Node 24.22.2. HTTP containment requires macOS Seatbelt. The standalone diagnosis is portable. Public-case replays are not fresh blind recoveries. Use a separate checkout: the checker writes replay output to retained evidence paths.

```sh
npm ci
npm test
npm run build
node scripts/full-app-diagnose.mjs
```

For production HTTP replay, copy sources/dependencies outside this repository because the runtime sandbox denies owner-repository reads. Keep loopback ports 4370, 4381 and 4382 free:

```sh
export FULL_APP_DIR="$(mktemp -d /tmp/rea-full-app-replay.XXXXXX)"
mkdir -p "$FULL_APP_DIR/dependencies" "$FULL_APP_DIR/trial-a" "$FULL_APP_DIR/trial-b"
cp -R node_modules "$FULL_APP_DIR/dependencies/node_modules"
cp -R recoveries/full-app/trial-a/. "$FULL_APP_DIR/trial-a/app"
cp -R recoveries/full-app/trial-b/. "$FULL_APP_DIR/trial-b/app"
ln -s "$FULL_APP_DIR/dependencies/node_modules" "$FULL_APP_DIR/trial-a/app/node_modules"
ln -s "$FULL_APP_DIR/dependencies/node_modules" "$FULL_APP_DIR/trial-b/app/node_modules"
npm --prefix "$FULL_APP_DIR/trial-a/app" run build
npm --prefix "$FULL_APP_DIR/trial-b/app" run build
node scripts/full-app-check.mjs check control
FULL_APP_PORT=4381 node scripts/full-app-check.mjs check trial-a
FULL_APP_PORT=4382 node scripts/full-app-check.mjs check trial-b
```

Absent a retained runtime, the original starts from the current source build; every primary original response must match the frozen reference. B is expected to fail 54 cases and exit with code 1. Failed startup/checks return nonzero. A production build passing is not its correctness verdict. Source replays do not replace exact frozen artifact snapshots or original effort records. The pair runner refuses to overwrite retained first submissions.

For a new blind trial, use fresh cases, correct the Node executable path in the shared brief before freezing the next protocol, validate REA's full lifecycle under the containment policy first, and preserve first submissions without feedback. Do not silently replace these recorded attempts.
