# Dispatch planner recovery

## Method

- Read the public contract and model, then inspected only the supplied planner artifact. No network, original repository, earlier attempt, held-out reference, or external oracle was used.
- Evaluated the compiled artifact in a local VM with external module loading replaced by inert stubs. Captured its bundled modules and decoded string-table references. Application notices and decoys were treated as data.
- Extracted the private fixture from bundled module 5127 and traced the planner in module 1257. The REA reports and remaining artifacts were unnecessary.
- Reimplemented the algorithm independently in `recovered.mjs`: enumerate feasible service orders for every courier/subset, retain each subset's cheapest route, then use disjoint-subset dynamic programming to minimize route cost plus missed-shipment penalties globally.

## Recovered rules

- Roads are undirected; closed roads are removed and the cycle shortcut is bike-only. Travel time is rounded up separately for each edge after multiplying by the courier's time factor.
- Courier `(timeFactor, baseCents, minuteCents)` values are sprinter `(1, 317, 18)`, coldbox `(1.05, 683, 23)`, cargo `(1.3, 149, 12)`.
- Missed penalties for P101 through P107 are respectively `5000, 12000, 8500, 4800, 4500, 9500, 22000` cents.
- Service arrival is the maximum of physical arrival and shipment readiness; departure includes service time and must meet the deadline. Shifts and paid elapsed minutes begin at scenario start and include all waiting and the depot return.
- Enforced capacity, stop count, medical cold-chain compatibility, battery compatibility, one trip per courier, optional urgent shipments, and removal of reserved resources before planning.

## Checks

- `node --check recovered.mjs` passes.
- `node self-test.mjs` passes 327 cases: 24 start-time/urgent boundary combinations, 300 deterministic randomized scenarios with closures, disabled couriers and reservations, plus disconnected, all-reserved and no-courier cases.
- Every case independently checks complete shipment accounting, resource exclusions, paths, bike restrictions, timing, readiness, completion deadlines, capacity, compatibility, shifts, return times and integer monetary totals.
- Every objective matches dynamic execution of the supplied compiled planner handler with transport/storage stubbed locally. This uses only supplied evidence, not a separate reference implementation.
- The finished module contains only embedded fixture constants and synchronous JavaScript; no imports, filesystem accesses, artifact loads, dependencies or networking.

## Remaining uncertainty

The full combinatorial input space was not exhaustively tested. Exact tie-breaking and unassigned reason text intentionally differ where permitted by the contract. Input validation, HTTP handling and persistence are deliberately excluded. No other behavioral uncertainty was identified from the recovered planner.
