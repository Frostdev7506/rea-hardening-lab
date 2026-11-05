# Dispatch planner recovery

## Evidence and method

Read `contract.md` first. Used only the supplied `public-model.json` and compiled
JavaScript evidence. The planner artifact contains both the private fixture
(module 5127) and the complete planning routine. Inspected that module in a local
VM with a minimal export adapter, selecting only operational fixture fields.
No network, original repository, earlier attempt, held-out reference, credentials,
or external oracle was used. The REA reports were unnecessary.

`recovered.mjs` is a standalone synchronous implementation with embedded constants,
no imports, no filesystem access, and no network access. It exports `planDispatch`.

## Recovered rules

- Missed-service penalties for P101–P107 are respectively 5000, 12000, 8500,
  4800, 4500, 9500, and 22000 cents.
- Courier base/minute prices are sprinter 317/18, coldbox 683/23, and cargo
  149/12 cents. Travel factors are respectively 1, 1.05, and 1.3.
- Roads are bidirectional. Each edge's travel time is independently rounded up
  after multiplication by the courier factor. Only bikes use the cycle shortcut.
- Stop arrival is the maximum of physical arrival and shipment readiness;
  departure includes service. Departure must meet the deadline. The complete
  depot-to-depot duration, including waiting and service, must fit the shift.
- Medical shipments require cold chain; batteries require battery permission.
  Total initial load and stop count must fit the courier. Each courier takes
  at most one trip. Unused couriers incur no base charge.
- Reserved shipments and couriers are excluded before planning; optional P107
  exists only in urgent scenarios. Excluded shipments incur no penalty.

For each courier, enumerate feasible shipment service permutations and keep the
cheapest route for every shipment subset. Positive edge costs make shortest paths
sufficient. Combine disjoint subsets using dynamic programming, then minimize
route costs plus penalties for all remaining active shipments. This exhaustively
covers the feasible assignments without relying on a heuristic.

## Verification

`node --check recovered.mjs` succeeds. `node self-test.mjs` passes 5602 scenarios:

- Every integer start minute 480–720, with urgent both off and on: 482 cases.
- Every one of the 4096 road-closure subsets, with varied start times, courier
  availability, and urgent setting.
- Every one of the 1024 shipment/courier reservation subsets, with varied starts.

Each case compares the objective against the routine extracted from the supplied
compiled evidence. Independent checks use Floyd–Warshall distances and validate
every returned edge, stop time, deadline, return, load, compatibility, resource
exclusion, shipment partition, cost, and penalty. Tests also check input immutability
and equivalence of omitted versus explicit empty reservations.

## Remaining uncertainty

No held-out reference was available. The checks cover individual exhaustive axes,
not their full Cartesian product. Tie-breaking and unassigned reason wording can
differ from the compiled routine, as explicitly permitted by the contract.
