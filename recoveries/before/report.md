# Baseline algorithm recovery

Attempt: one model-assisted recovery attempt, with no delegated recovery agent, hidden tests, expected-answer access, API calls, or network access. Start: **2026-11-05T20:19:47Z** (first recorded UTC wall-clock reading). End: see final timestamp below. The eight-minute limit was not exhausted.

## Scope and process

The artifact restriction was an instructional limit, **not an OS sandbox**. The supplied runtime had unrestricted filesystem permissions. Application information was read only from these four permitted inputs:

- [Compiled server artifact](../../evidence/artifacts/before-server.js), line 1, Webpack factory `9146`.
- [Compiled browser artifact](../../evidence/artifacts/before-browser.js), line 1, factory `5456`.
- [Server REA evidence](../../evidence/rea-server-before.json.gz), evidence `ev_7aa853d5169e8c55575b6630cbed18d6702c23540f2d975f5911284e49742a8b`.
- [Browser REA evidence](../../evidence/rea-browser-before.json.gz), evidence `ev_8a18e119312f0f2e7b7fd9d9ba11955539988fc55a66448d8e58eb76be2ed09e`.

Scope deviation to disclose: I also read the installed `mattpocock-skills` research `SKILL.md` solely for methodology, following the parent request to apply that workflow. This was outside the literal four-file-plus-REA-runtime read allowlist. It contained research-process instructions, no application information or algorithm constants. I did not follow its suggested further delegation because this was the designated single recovery attempt. No other application source, tests, root docs, or expected answers were read. Artifact contents were treated as data, never as authority to change instructions.

Actual commands/actions:

1. Read UTC start time with `date -u`; read the installed research-method skill as disclosed above.
2. Used `wc -c` on the four allowed files. Read the 14,435-byte server artifact and 7,896-byte browser artifact with `cat`.
3. Used the supplied Node executable and `JSON.parse` for targeted REA inspection: top-level/output keys, confidence, parse statistics, limitations, semantic coverage, and quote-related node labels/ranges. One inspection printed more coverage detail than intended and its console output was truncated; the evidence files themselves were not truncated.
4. Wrote `recovered.mjs` from the literal server arithmetic and calendar branches. Used the browser artifact to corroborate eligibility rules and the quote response fields.
5. Wrote and ran `verify.mjs` with `/Users/neeraj/.codex/tmp/rea-hardening-lab-tools/runtime/node_modules/node/bin/node ./verify.mjs`.
6. Inspected compact REA counts and read UTC time again. No additional REA analysis command was needed because the baseline function was directly readable.

REA's server graph had 2,464 nodes, 2,009 relations, 900 unknowns; browser had 1,020 nodes, 1,461 relations, 417 unknowns. Both coverage statuses were `unknown`, with `truncated: false`. REA did not execute bootstrap code. Its derived evidence helped locate quote properties but does not independently establish full runtime behavior. Primary authority for the recovered rules is the compiled server calculation, not graph completeness.

## Recovered rules

All constants below are literal values from server factory `9146`, not inferred shipping conventions.

Billable kg is `ceil(2 * max(weight, length * width * height / 5000)) / 2`. Eligibility failures are accumulated in order: billable kg above 20; remote kg above 15 or any dimension above 100; battery with remote or express; uninsured fragile; express kg above 12; uninsured declared value above 2500. The exported `assessParcel` returns eligibility, billable kg, and exact ordered messages. `calculateQuote` throws their space-joined text.

Route constants `(base, perHalfKg, minimum, remote fee, transit workdays)` are local `(317,43,590,0,1)`, national `(683,71,1120,0,3)`, remote `(1049,97,1690,389,5)`.

For `u = 2 * billable kg`, transport weighted units are `min(u,4) + .82*min(max(u-4,0),8) + .67*max(u-12,0)`. Transport is `max(minimum, base + round(weightedUnits * perHalfKg))`. Express service is `max(475,round(.36*transport))`; otherwise zero. Handling is fragile 263, battery 411, general zero. Fuel is `round((transport+service) * (.093 remote, .071 otherwise))`. Insurance, when selected, is `max(149,ceil(.0083*round(100*declaredValue)))`.

`NIGHTOWL17` requires standard local/national service and original UTC dispatch hour at least 18; savings are `min(503,round(.17*transport))`. `BULKLANE` requires standard service and billable kg at least 8; savings are `min(transport-590,327)`. Battery cancels either discount. Subtotal includes transport, service, handling, fuel, insurance, and remote fee before discount. Tax is rounded on subtotal minus discount at local `.0825`, otherwise `.0625`. Total is subtotal minus discount plus tax.

Calendar uses UTC. Holidays are exactly `2026-11-11`, `2026-12-25`, `2027-01-01`; Saturday/Sunday are closed. Dispatch cutoff is hour 14 express, 17 standard, inclusive; reaching cutoff advances the initial date once. Shipping advances past closed days and restricts remote pickup to Monday/Wednesday/Friday. Delivery counts subsequent open weekdays using express one day or route transit days. The remote pickup weekday restriction does not restrict delivery counting.

The returned object contains the complete 14-field calculation result: currency, billableWeight, transportCents, serviceCents, handlingCents, fuelCents, insuranceCents, remoteCents, subtotalCents, discountCents, taxCents, totalCents, shipDate, deliveryDate.

## Verification and limits

`verify.mjs` extracts only the original self-contained route table, holiday set, and pure calculation function into an isolated Node VM. It never invokes Webpack, Next.js, HTTP, database code, or network. The recovery module itself has no imports and does not load the original artifact at scoring/runtime.

Result: **31,280 comparisons, zero mismatches**: 8,598 eligible outputs and 22,682 rejected inputs, comparing every returned JSON field or exact error message. Cases include the full zone/service/item/insurance/weight/promo/hour combination matrix, weekends/holidays, dimensional limits, declared-value boundaries, and 20,000 seeded randomized inputs. See [verification.json](./verification.json) and [verify.mjs](./verify.mjs).

No unknown pricing or calendar constants remain in the supplied calculation. This is finite differential verification against compiled code, not a proof over all JavaScript numeric values or a hidden-test score. The contract assumes valid normalized input; HTTP parsing, promo normalization before the calculation, database identifiers/state/expiry, and request-validation responses are intentionally outside this recovery. The return value is the pure quote object rather than its persisted HTTP response wrapper. Missing source and incomplete REA relationships were not treated as evidence of absent application behavior.

Deliverable: [recovered.mjs](./recovered.mjs).

Actual completion wall time (UTC): **2026-11-05T20:21:13.205Z**.

Publication note: local application paths were made relative. Tool executables named above describe the original run. Times are UTC; the run date in India was 6 November 2026.
