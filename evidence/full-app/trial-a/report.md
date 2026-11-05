# Reconstruction report

## Result and running

The runnable application is in `app/`. Dispatch is the primary `/` page, and the older parcel quote demo is at `/quote`.

```sh
cd app
npm run build
DISPATCH_DB_PATH=/absolute/writable/dispatch.sqlite \
DEMO_DB_PATH=/absolute/writable/quotes.sqlite \
npm start -- --port 3000
```

The start script binds to `127.0.0.1`. Without environment overrides, separate databases are created under `app/.data/`. No packages were installed or shared dependency files edited. Node 24 provides `node:sqlite`.

## Evidence used

- Read `inputs/brief.md` first and inspected only this trial's supplied artifacts. No original repository, earlier trial, original running application, backend oracle, or external service was queried.
- The four dispatch chunks supplied the form state, network rendering, exact fixture, request contracts, route optimizer, saved-page restoration, and persistence behavior. The compiled JavaScript was formatted into `analysis/` for inspection using the already-installed Babel parser/generator.
- `analysis/fixtures.cjs` evaluates only the inert fixture object literal in an isolated VM and embeds the resulting data as `app/src/lib/fixture.json`. The application contains independently written named source modules, React components, and routes, and never loads any supplied compiled chunk. Compiled inspection copies remain outside the app in `analysis/`.
- Both public CSS files are retained in `app/src/app/globals.css`. The desktop, urgent, mobile, and quote screenshots were presentation references. Rebuilt desktop and mobile screenshots were visually inspected.
- The legacy `quote-*` chunks were inspected separately for quote input validation, eligibility, integer-cent pricing, service calendars, browser validation, expiration, booking, and retry behavior.
- No local `mattpocock/skills` installation was available among the provided skills. Fetching skills would violate the no-external-services constraint. Applied explicit boundary validation, separated calculation/storage/HTTP/UI modules, evidence-led implementation, and executable checks rather than inventing business rules. Available ponytail and verification-before-completion guidance was applied.

## Recovered dispatch behavior

- `/api/plans` accepts JSON with exactly `batchId` and `scenario`; validates lower-case UUIDv4 batch IDs or explicit null; rejects unknown fields, duplicate or unknown courier/road IDs, invalid booleans, and noninteger starts outside 480–720 inclusive. Streaming body size is bounded at 2 KiB. Media type, malformed body, validation, and size failures preserve their distinct 415/400/413 statuses and error messages.
- The exact planner searches allocations and per-courier stop permutations. It respects capacities, stop counts, cold chain, battery authorization, ready times, completion deadlines, return-to-depot shifts, disabled couriers, road closures, and bike-only roads. Each road's scaled travel time is rounded upward separately. Waiting contributes to shift duration and cost.
- The objective is fleet cost plus missed-service penalties, not simply maximum deliveries or shortest distance. Shortest paths, stop orders, and fleet allocations retain the observed tie-break rules. Unassigned reasons distinguish individual infeasibility from the chosen lowest-cost allocation.
- Drafts have separate plan and batch UUIDs, snapshots, timestamps, reserved courier lists, and activity events. Plans are durable, and `/?plan=UUID` restores a saved draft or committed snapshot. Invalid/missing saved IDs show the observed page message.
- Dispatch uses `BEGIN IMMEDIATE`, checks shipment conflicts before courier conflicts, atomically reserves both resources, records one commit event, and rolls back on conflict. Empty dispatches are rejected with 409. Repeated commits return the existing snapshot without extra reservations or events. Replanning a batch excludes reserved shipments and couriers, while stale draft GETs retain their original snapshot.
- The UI includes fleet toggles, bridge closure, urgent kit, three visible start-time choices, route filtering, selected shipment highlighting, stale-scenario invalidation, plan history, dispatch confirmation, plan-remaining, and new-batch reset. Tables are semantic and horizontally scrollable on narrow screens, with visible focus styles.

## Legacy quote parity

Implemented independently from the legacy chunks, outside the primary dispatch reconstruction:

- `/api/quote` preserves separate validation and eligibility statuses, strict field/date rules, 2 KiB limits, and the legacy media-type prefix check.
- Pricing preserves half-kilogram billable weights, tiered transport, minimums, express/contents/fuel/insurance/remote charges, exact promo restrictions and caps, integer-cent rounding, and tax.
- Shipping uses the recovered cutoffs, weekends, three fixture holidays, remote pickup weekdays, and business-day transit calculations.
- `/api/quotes/[id]` returns persisted records, supports conditional booking, treats booked retries as successful, and rejects unbooked expired quotes with 410. Quote and dispatch storage honor different environment variables and database files.
- `/quote` reproduces the supplied form defaults, labels, parcel illustration, receipt, client eligibility checks, booking state, and saved JSON link. The compiled quote page had no saved-page query restoration, so none was invented.

## REA command, output, and contribution

Ran the required real REA CLI on all supplied JavaScript, using Node v24.13.1:

```sh
node /Users/neeraj/.codex/tmp/rea-hardening-lab-tools/runtime/node_modules/rea-agents/scripts/rea.mjs analyze-javascript-application inputs --max-semantic-nodes 12000 --max-semantic-nodes-per-file 12000 --max-semantic-unknowns 4000 --max-semantic-unknowns-per-file 4000 --analysis-timeout-ms 60000 --max-heap-mb 1024 --format json > rea-analysis.json
```

Repeated the same command with `2> rea-stderr.log` to retain the complete progress and cleanup diagnostics as well as the complete JSON stdout. `rea-analysis.json` parses successfully. `rea-exit.txt` records exit 1: analysis reached its terminal completion event and emitted its evidence, but cleanup raised `ProviderCleanupError` because process-table inspection returned `spawn EPERM`. This is not represented as a clean CLI exit.

Actual retained coverage:

- 8 relevant/parsed JavaScript files, 130,114 text bytes, zero skipped JavaScript files, zero parse failures.
- 33,298 visited AST nodes, 344 findings, 5 reported modules.
- Semantic graph: 12,000 nodes, 15,096 relations, 4,000 unknowns; coverage explicitly `partial` and `truncated` at the requested ceilings.
- Application graph: `partial`, not marked truncated. The route inventory identifies `/quote` but does not enumerate the complete Next route surface.

REA helped corroborate the browser fetch boundaries for `/api/plans`, `/api/quote`, and dynamic plan/quote record URLs, JSON response consumers, and the external SQLite module dependency. It also separated inert syntax findings from runtime claims. Some endpoint-like findings are ordinary form/header/framework strings, not actual routes. Its limited route inventory and truncated semantic flow do not establish planner arithmetic, full route methods, SQL transaction semantics, or exact error contracts. Those remained unresolved by REA and were recovered through direct compiled inspection and checked against the reconstructed app. No supplied bootstrap or server route was executed as an oracle.

## Verification performed

- `cd app && npm run build`: exit 0. `analysis/build.log` records the final production build and all seven app routes: `/`, `/_not-found`, `/api/plans`, `/api/plans/[id]`, `/api/quote`, `/api/quotes/[id]`, `/quote`.
- Production execution used the required `npm start -- --port 3217` interface with both database overrides pointing to trial-local files.
- `node analysis/self-check.mjs`: **73 HTTP checks passed**, plus assertions on calculation details and SQLite reservation counts. Evidence: `analysis/self-check.log`.
- Exact observed scenarios matched: default fleet objective 5,483 cents and all six deliveries, bridge-closed objective 6,203 cents, urgent objective 14,937 cents with P106 unassigned. Default route shipment order and return times also match.
- Checked malformed and oversized bodies, unsupported media types, unknown fields, duplicate identifiers, time bounds, missing records, empty dispatch, shipment conflicts, disjoint-shipment/same-courier conflicts, concurrent competing commits, idempotent retries, excluded resources on remaining plans, and empty remaining batches.
- Quote checks cover baseline cents/calendar, invalid fields, eligibility failures, promo normalization and discount, holiday skipping, persisted booking, booking retry, and expired quote rejection. Expiry was tested by changing only the reconstructed app's own test database.
- `node analysis/browser-check.cjs`: **15 browser flows passed** in local headless Chrome, with zero uncaught page errors. Evidence: `analysis/browser-check.log`, `analysis/browser-result.json`, and four `*-rebuilt.png` screenshots. Tested planning, filtering, selection, staleness, bridge and urgent replans, query restoration, dispatch, reload, reset, 390px responsive overflow, quote calculation, booking, client validation, and missing saved-plan handling.
- Stopped the first production process and started a new production process against the same two files. Committed plan state, exactly two events, booked quote state, saved-page restoration, and identical retry responses survived restart. Evidence: `analysis/restart-check.log`.
- All local app servers and browser sessions were stopped after checks. Test data resides only in `analysis/`, not in the app's default databases.

## Known limits

No known functional mismatch was observed in the exercised behavior. The finite fixture's full power set of road closures and every possible valid request combination were not exhaustively tested. Visual inspection and screenshots were performed, not automated pixel-diff certification, and browser testing covered local Chrome rather than every browser. REA's truncation and cleanup failure are explicit above; its output is supporting evidence, not proof of complete semantic recovery.
