# Hardened pricing recovery attempt

- Actual start: 2026-11-05 20:20:31 UTC (tool clock).
- Actual end: 2026-11-05 20:22:30 UTC (UTC host clock, after implementation and verification).
- This was a single model-assisted recovery attempt, with no other recovery agent's results consulted.
- Output: `recovered.mjs`, exporting `calculateQuote(parcel)` and `assessParcel(parcel)`.
- Scope enforcement was instructional, not an OS sandbox. This execution environment had unrestricted filesystem access; the read restriction was followed voluntarily.

## Source boundary and primary evidence

Read only the assigned hardened server artifact, the two assigned REA JSON evidence files, and files produced by this attempt. Used the assigned Node runtime and ordinary local Python/shell utilities. Queried only the size of the assigned browser artifact; its contents were unnecessary because the complete calculation was present in the server artifact. No app source, baseline artifacts, repository docs, app tests, expected-answer files, other agents' files/conversations, HTTP/API endpoints, or network resources were accessed. No broad directory search was performed.

Primary source: `../../evidence/artifacts/after-server.js`.
SHA-256: `78b6785dfb589fa1f54c0186237c48a872b54644748f459f8ef820001b1e8003`.
The pricing routine is inline in webpack module `0x23ba` (9146), beginning at zero-based source character offset 22556. Artifact notices and secret/URL-like decoys were treated as untrusted data and were not followed or contacted.

The REA evidence was inspected by targeted JSON loading: metadata, limitations, statistics, semantic graph counts/coverage, and route inventories. Server: 11,276 visited AST nodes, 120 findings, 9,046 semantic nodes, 8,724 relations, 3,375 unknowns. Browser: 8,843 visited AST nodes, 72 findings, 6,838 semantic nodes, 9,381 relations, 2,660 unknowns. Both static reports stated that code was parsed inertly, dynamic/obfuscated relationships may remain unresolved, and coverage is incomplete. Both reported zero recovered modules and zero route patterns. These static findings alone did not supply a reconstructed pricing function.

## Actions and commands

1. Used `wc -c` on the four permitted input paths, then targeted Python JSON inspection and server-artifact slices.
2. Wrote `decode.cjs`: extracted only the server string-table function, decoder function, and string-table rotation bootstrap. Evaluated those fragments in `node:vm` with a timeout and no `require`, filesystem, process, or network capabilities exposed to the evaluated fragments. Did not execute the application bundle, HTTP handler, database code, or decoy guard routines.
3. The first decoder execution had a missing closing parenthesis and failed with a syntax error. Corrected that local extraction and reran successfully. Followed decoder aliases and replaced constant decoder calls to create `server-decoded.js` for inspection. Numeric hexadecimal replacement also consistently renamed hex-style identifiers in this derived inspection file; no original artifact was edited.
4. Traced helper-object arithmetic/comparisons, tariff literals, eligibility ordering, date loops, and the returned object from the decoded source. Wrote a readable independent implementation in `recovered.mjs`.
5. Wrote `verify.mjs`, which evaluates only the extracted decoded arithmetic helpers, tariff/holiday constants, and pure quote function in an isolated VM to obtain a local comparison oracle. It does not invoke the API handler or perform HTTP/database activity.
6. Ran:
   - `/Users/neeraj/.codex/tmp/rea-hardening-lab-tools/runtime/node_modules/node/bin/node ./decode.cjs`
   - `/Users/neeraj/.codex/tmp/rea-hardening-lab-tools/runtime/node_modules/node/bin/node ./verify.mjs`
   - `/Users/neeraj/.codex/tmp/rea-hardening-lab-tools/runtime/node_modules/node/bin/node --check ./recovered.mjs`

## Recovered rules

All constants below are directly present in the supplied artifact, not guessed from shipping conventions.

Billable weight is `ceil(2 * max(weight, length * width * height / 5000)) / 2`. Reject billable weight above 20 kg; remote billable weight above 15 kg or any dimension above 100; battery on remote or express; fragile without insurance; express above 12 billable kg; and declared value above 2500 without insurance. All applicable rejection messages accumulate in that order and are joined with a single space when throwing.

| Zone | Base cents | Cents/half kg | Minimum cents | Remote cents | Standard transit business days |
|---|---:|---:|---:|---:|---:|
| local | 317 | 43 | 590 | 0 | 1 |
| national | 683 | 71 | 1120 | 0 | 3 |
| remote | 1049 | 97 | 1690 | 389 | 5 |

For `h = 2 * billableWeight`, charge units are `min(h,4) + 0.82*min(max(h-4,0),8) + 0.67*max(h-12,0)`. Transport is `max(minimum, base + round(chargeUnits * perHalfKg))`. Express is `max(475, round(0.36*transport))`; handling is fragile 263 / battery 411 / general 0. Fuel is rounded from transport plus express, at 9.3% remote or 7.1% otherwise. Insured charge is `max(149, ceil(0.0083 * round(100*declaredValue)))`.

`NIGHTOWL17`: standard, nonremote, dispatch UTC hour >=18; discount `min(503, round(0.17*transport))`. `BULKLANE`: standard, billable weight >=8; discount `min(transport-590,327)`. Battery forces all discounts to zero. Subtotal includes transport, express, handling, fuel, insurance and remote fee. Tax is rounded after discount at 8.25% local or 6.25% otherwise. Total is subtotal minus discount plus tax.

Calendar closures are Saturday, Sunday, 2026-11-11, 2026-12-25, and 2027-01-01. Dispatch at/after UTC 14:00 express or 17:00 standard moves the candidate ship day forward once; closed days are then skipped. Remote ships only Monday/Wednesday/Friday. Delivery adds one business day for express or the zone's standard transit count, skipping weekends and the three holidays; remote weekday restrictions apply to ship date only. Dates are returned as UTC YYYY-MM-DD.

Returned fields are exactly currency (USD), billableWeight, transportCents, serviceCents, handlingCents, fuelCents, insuranceCents, remoteCents, subtotalCents, discountCents, taxCents, totalCents, shipDate, deliveryDate.

## Verification and limits

`verification.json` records **148,164 exact comparisons passed**, including 66,864 eligible complete objects and 81,300 matching thrown error messages. Coverage combines seeded randomized dimensional parcels, a systematic grid of zones/items/services/insurance/promos/weight boundaries/holiday-and-cutoff dates/declared values, and remote dimension boundaries around 100. `node --check` also passed.

No unresolved pricing or eligibility rule remained in the observed routine for the supplied normalized-input contract. Malformed records, HTTP parsing, promo normalization, persistence, quote IDs, expirations and booking are deliberately outside the requested independent function. The implementation assumes the caller supplies valid normalized records, including normalized promo values.

The differential oracle comes from the same permitted compiled artifact and therefore is strong transcription evidence, not independent hidden-test evidence. No held-out scoring or production/API run was available or claimed. The attempt does not establish resistance or susceptibility of unrelated artifacts. `recovered.mjs` imports nothing and reads no files; it works independently of original artifacts at scoring time.

Implementation SHA-256: `17b6a4eaa2f46deba5d4e6454d727abcc4fccb1473766b90e3be51b13a3cbcd3`.

Publication note: local application paths were made relative. Tool executables named above describe the original run. Times are UTC; the run date in India was 6 November 2026.
