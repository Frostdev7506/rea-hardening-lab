# Dispatch planner recovery

## Method

Read `contract.md` first, then `public-model.json`. Decoded the supplied `planner.js` string table and rotation in an isolated Node VM. Inspected the planner and fixture expressions rather than running application startup, HTTP handling, database code, or decoy functions. Selectively inspected REA report structure; the compiled planner itself supplied the decisive evidence. No network services, original repositories, earlier attempts, or held-out references were used.

Recovered private courier parameters `(timeFactor, baseCents, minuteCents)`:

- sprinter: `(1, 317, 18)`
- coldbox: `(1.05, 683, 23)`
- cargo: `(1.3, 149, 12)`

Shipment penalties P101–P107 are respectively `5000, 12000, 8500, 4800, 4500, 9500, 22000` cents. Extracted fixture fields were checked against the public model.

Roads are undirected. Travel time rounds **each edge** upward after multiplying by the courier's time factor; the cycle shortcut is bike-only. A stop's reported arrival is `max(previous departure + shortest-path travel, readyMinute)`, not necessarily physical arrival. Readiness waiting occurs at the destination and counts toward elapsed route cost and shift length. Service must finish by its deadline. Return to the depot must fit the shift measured from `scenario.startMinute`. Medical and battery compatibility, total initial load, stop limits, urgent activation, disabled couriers, road closures, and reserved IDs are enforced.

## Implementation

`recovered.mjs` embeds all required data and exports synchronous `planDispatch`. It enumerates feasible service orders, retains the cheapest route for every courier/shipment subset, then combines disjoint subsets with exact dynamic programming. The final selection minimizes route costs plus penalties, including the option to leave any shipment unassigned. This exhausts the feasible assignments; shortest paths suffice because travel costs are positive and earlier arrival can wait.

The finished module has no imports, dependencies, runtime file access, network operations, or application evaluation. `inspect.cjs` and `verify.mjs` are development-only diagnostics and are not needed to use it.

## Checks

- `node --check recovered.mjs` passes.
- `node verify.mjs` passes **2,651 scenarios**. Objectives match an isolated function extracted from the supplied compiled planner, not a held-out oracle.
- Coverage includes every integer start minute 480–720 with urgent both off/on; every disabled-courier subset; each individual road closure and all roads closed at selected times; 600 seeded combinations of closures, disabled couriers, and reservations; and an empty active shipment set.
- Independent output checks replay full walks and verify road permissions, depot endpoints, service timing, deadlines, shifts, compatibility, loads, stop counts, shipment coverage, reservation exclusion, integer cost formulas, aggregate costs, and input immutability.
- Baseline at minute 540: normal objective `5483`; urgent objective `14937`.

## Remaining uncertainty

No held-out reference was available, and all possible road/reservation combinations were not enumerated. Verification therefore establishes agreement with the supplied artifact on the generated cases, not empirical agreement on every input. Tie-breaking and unassigned reason wording may differ, as explicitly permitted by the contract. Invalid-input rejection and application/HTTP/database behavior are intentionally excluded.
