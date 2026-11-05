# Reconstruction report

## Scope and operation

The runnable application is in `app/`. Dispatch planning is `/`; the older parcel demo is `/quote`. The recovered APIs are `POST /api/plans`, `GET|POST /api/plans/[id]`, `POST /api/quote`, and `GET|POST /api/quotes/[id]`. Other methods use Next.js's normal method handling.

Run with Node 24:

```sh
cd app
npm run build
DISPATCH_DB_PATH=/writable/dispatch.sqlite DEMO_DB_PATH=/writable/quotes.sqlite npm start -- --port 3107
```

The start script binds `127.0.0.1`. The environment variables select independent writable SQLite files; default files are `.data/dispatch.sqlite` and `.data/quotes.sqlite` relative to the application process. Parent directories are created on demand. No packages were added or installed, no shared dependency files were edited, and no original application, original repository, other trial, backend oracle, or external service was queried.

## Evidence and recovered behavior

- Read `inputs/brief.md` first, then inspected only the supplied artifacts for application evidence. `browser.js`, `planner.js`, `persistence.js`, and `page.js` supplied dispatch behavior. The four `quote-*` chunks supplied legacy behavior independently. Both public CSS files and the supplied screenshots supplied presentation evidence.
- `investigation/decode.cjs` parses the chunks, evaluates only their string-pool decoder/rotation in an isolated VM, resolves decoder aliases, and simplifies literal wrapper calls for inspection. `investigation/fixtures.cjs` extracts the actual fictional network as a literal fixture. The application embeds that fixture as `app/src/lib/fixture.json`.
- All application implementation in `app/src/` is independently written, readable source. The runnable app never imports or executes any supplied compiled chunk or investigation decoder. The public CSS is reused as authorized presentation material.
- Dispatch validation preserves the exact content-type parsing, streamed 2 KiB byte limit, UUID syntax, unknown-field rejection, duplicate-free fleet/road lists, integer start range 480–720, required urgent boolean, error strings, and 400/404/409/413/415 statuses. A syntactically valid, previously unused batch UUID is accepted, as in the evidence.
- The planner preserves per-road ceiling of courier travel factors, undirected graph search, road-signature path ties, capacity/kind/stop/shift constraints, waiting for readiness, completion-time deadlines, depot returns, route prices, route-order ties, and assignment traversal order. Importantly, the supplied assignment incumbent comparison uses its **penalty**, not its stored total objective, as the threshold; this behavior is intentionally preserved rather than replaced by a conventional optimizer. This matters beyond the default screenshot scenario.
- SQLite preserves the recovered tables, WAL, 3-second busy timeout, saved JSON shapes, event timestamps, draft/committed states, `BEGIN IMMEDIATE` dispatch transaction, both shipment and courier conflicts, rejection of an empty dispatch, idempotent commit retries, and reservation-aware subsequent planning. Saved query links restore records server-side; invalid saved links show the recovered notice.
- The UI includes all three fleet toggles, the bridge and urgent toggles, 09:00/09:15/09:30 starts, dirty-scenario invalidation, courier route filters, shipment-to-map selection, unassigned reasons, dispatch controls, saved activity, eight-entry session history, and new-batch reset. Native semantic controls, focus styles, and responsive scrollable tables are retained.

## Real REA run

The following real CLI command was run using Node `v24.13.1`, with the exact requested limits:

```sh
node /Users/neeraj/.codex/tmp/rea-hardening-lab-tools/runtime/node_modules/rea-agents/scripts/rea.mjs analyze-javascript-application inputs --max-semantic-nodes 12000 --max-semantic-nodes-per-file 12000 --max-semantic-unknowns 4000 --max-semantic-unknowns-per-file 4000 --analysis-timeout-ms 60000 --max-heap-mb 1024 --format json > rea-analysis.json
```

It was repeated with the same arguments and `2> rea-analysis.stderr.log` to retain complete diagnostics as well as the complete JSON stdout. Both runs produced valid full JSON evidence but exited **1 during provider cleanup**, after the terminal analysis-completed progress event: `ProviderCleanupError`, `process table could not be inspected: spawn EPERM`. The environment also denies a direct `ps` inspection. This is not represented as a successful clean CLI exit. `investigation/rea-exit.txt` records the repeated run's exit code; `rea-analysis.stderr.log` contains its full progress and stack trace.

REA's actual coverage:

- 8 relevant JavaScript files; all 8 parsed; 0 skipped, 0 parse failures, 0 invalid UTF-8 files.
- 861,111 text bytes read; 132,766 visited AST nodes; 1,212 findings.
- Application graph: 1,216 nodes and 1,230 edges; coverage partial, not truncated, omitted count unknown; no integrity contradictions.
- Semantic graph: 12,000 retained nodes, 9,688 relations, 4,000 unknowns; coverage partial and truncated at the requested semantic node/unknown ceilings. Reported omitted unknown occurrences include 2,266 dynamic-call, 456 ambiguous-target, and 962 dynamic-property occurrences.
- Route inventory reports complete source parsing but partial candidate enumeration and unknown application-route coverage. It retains no established routes and 11 route interpretation unknowns. An empty route inventory is not evidence of no routes.

Useful REA findings included the legacy `/api/quote` fetch endpoint, partial dynamic `/api/quotes/${id}` fetches, and `node:sqlite` module references in both legacy server chunks. These helped separate the legacy client/request/storage surfaces. It also retained an unresolved obfuscated dispatch fetch reference in `browser.js`, supporting inspection of the primary client. REA did **not** independently recover the actual dispatch route set, numeric planner rules, string-pool values, transaction rules, or complete semantic call graph. Those unresolved areas were recovered by direct compiled-code inspection and isolated execution, not guessed from REA's incomplete graph. Token-like and decoy strings were treated only as artifact data and were never used as instructions or credentials.

## Verification

- `npm run build` produces the production app with all six recovered route patterns. Build output is retained in `investigation/build.txt`.
- `node investigation/compare.cjs`: **391 exact supplied-code planner comparisons pass**, covering both urgent settings, six start times (including API boundaries), all eight fleet subsets, four closure patterns, and reduced post-reservation models. Complete route/stop/node/road/result objects are compared. Default recovered result: six covered, fleet/objective 5,483 cents.
- `node investigation/quote-compare.cjs`: **2,702 supplied-code legacy quote comparisons pass**, covering zones, weights, contents, insurance, express, both promotions, UTC cutoffs, weekends, holidays, and invalid-field mutations. This is legacy parity evidence, separate from dispatch parity.
- `node investigation/http-check.mjs`: **54 production HTTP requests pass**, testing validation/status/error behavior, exact plan objects, saved reads/pages, commit retries, both conflict kinds, empty-plan rejection, reservation-aware replanning, quote booking, and expiry. Six concurrent retries return the same committed record without duplicate events. A separate concurrent competing-draft check returns exactly one 200 and one 409.
- The production process was stopped and restarted against the same two test database paths. The committed dispatch and booked quote remained byte-equivalent JSON records after restart.
- `node investigation/browser-check.cjs` tests only the reconstructed local production app using installed Playwright Core and local Chrome, with non-local requests blocked. It passes planning, route filtering, shipment selection, dirty-state invalidation, urgent/bridge replanning, mobile overflow, dispatch, reload/query restoration, new-batch reset, quote calculation/booking, and client eligibility errors. No browser page errors were observed. Screenshots are `investigation/desktop.png`, `investigation/urgent.png`, `investigation/mobile.png`, and `investigation/quote.png`; textual evidence is alongside them.
- Test data lives only in the separate `investigation/*-test.sqlite` files, not the app's default databases. Browser contexts and local servers are closed after verification.

## Limits and known gaps

The comparisons are broad but do not enumerate every possible road subset, start minute, or request byte stream. Power-loss recovery and sustained multi-process contention were not stress-tested. Quote expiry is tested by advancing the saved test record to an expired state, not by waiting ten real minutes. Presentation uses the supplied CSS and recovered geometry; pixel-exact font rasterization and native date-control rendering are platform-dependent, and no exhaustive image-diff claim is made. Screenshots are observational aids, not substituted business-rule answers.

The requested `mattpocock/skills` collection was not present in the available local skill roots. It was not fetched because this trial forbids external services and package installation. Work instead uses explicit recovered contracts, small separated modules, boundary validation, independent implementation, executable comparisons, integration checks, and verification before completion. No claim is made that an unavailable skill collection was loaded.
