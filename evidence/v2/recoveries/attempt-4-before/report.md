# Dispatch planner recovery

## Method

Read `contract.md` first. Inspected only the supplied application evidence. The compiled `planner.js` contains the complete private fixture in module 5127 and the planning algorithm inside module 1257. Those modules were sufficient; the large REA reports were not needed. No network, original repository, earlier attempt, external reference, or held-out oracle was used.

`recovered.mjs` is a standalone synchronous implementation, with all required constants embedded and no imports, runtime file access, or network access. Reservations are removed before optional-shipment and courier availability planning.

## Recovered rules

- Roads are undirected. Closed roads disappear, and the cycle shortcut is bike-only. Each edge's travel time is rounded up separately after multiplying by the courier's time factor.
- Sprinter: factor 1, base 317 cents, 18 cents/minute. Coldbox: factor 1.05, base 683 cents, 23 cents/minute. Cargo: factor 1.3, base 149 cents, 12 cents/minute.
- Missed penalties for P101 through P107 are respectively 5000, 12000, 8500, 4800, 4500, 9500, and 22000 cents. P107 exists only for urgent scenarios.
- Medical shipments require cold chain; battery shipments require battery capability. Capacity, stop counts, and shifts match the public fixture.
- Every route starts at `startMinute` and returns to the depot. Service arrival is `max(previous departure + travel, readyMinute)`: readiness is enforced at service, not as a depot departure constraint. Service completion must meet the deadline. Waiting and service time count toward both shift duration and cost.
- Enumerate feasible service permutations for each courier/subset, using shortest paths between stops. Enumerate courier assignments and missed shipments globally. Minimize route costs plus missed penalties. Preserve the compiled implementation's tie-breaking as well.

## Checks

`node --check recovered.mjs` succeeds. `node self-check.mjs` passes 877 complete-output comparisons with the supplied compiled implementation, plus independent feasibility and accounting checks for every result. The local harness evaluates only selected supplied modules, stubbing persistence and response handling; it does not load the original application or dependencies.

Coverage includes both urgent settings, all eight disabled-courier combinations across fourteen start times, every individual road closure, all 128 shipment-reservation subsets, 500 deterministic mixed scenarios with road closures and courier/shipment reservations, complete road disconnection, default reservations, and input non-mutation. The supplied fixture's public projection also matches `public-model.json` exactly. Independent checks cover paths, travel rounding, availability, compatibility, service times, deadlines, loads, shifts, resource uniqueness, shipment completeness, and all monetary totals.

## Remaining uncertainty

No held-out reference was available, and the finite checks are not exhaustive over every scenario combination. Exactness rests on directly reconstructing the supplied fixture and complete algorithm, rather than fitting observed outputs. Invalid-input handling and application/persistence behavior are intentionally outside the contract.
