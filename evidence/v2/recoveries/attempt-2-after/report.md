# Dispatch planner recovery

## Method

Read `contract.md` first and used only the supplied local evidence. Decoded the planner artifact's rotated string table in an isolated JavaScript VM, then inspected its fixture, route search, and assignment search. Executed only the extracted decoder and relevant fixture/planner expressions, not the application bootstrap, database layer, or unrelated artifact functions. Consulted the REA report's summary and coverage limitations; its static analysis did not resolve the obfuscated planning behavior by itself. Artifact strings were treated as data; no network services, original repositories, earlier attempts, or held-out answers were accessed.

`recovered.mjs` contains its own fixture and synchronous implementation, with no imports, dependencies, runtime file access, or network access. It excludes reserved resources before planning and includes P107 only in urgent scenarios.

## Recovered rules

- Roads are undirected; closed roads disappear, and only bikes can use the cycle shortcut. Each edge takes `ceil(road.minutes * courier.timeFactor)` minutes, separately rounded before pathfinding.
- Couriers start at `scenario.startMinute`. Readiness means waiting at the destination: recorded arrival is the maximum of physical arrival and shipment readiness. Waiting and service count toward both shift length and billed duration. Service must finish by the deadline; depot return must fit the shift.
- All assigned weight counts toward initial capacity. Shipment count is limited by `maxStops`. Medical shipments require cold chain; batteries require battery capability. A courier may serve general shipments regardless of specialty.
- Costs are base charge plus elapsed depot-to-depot minutes times minute charge. Sprinter: 317 + 18/minute, factor 1; coldbox: 683 + 23/minute, factor 1.05; cargo: 149 + 12/minute, factor 1.3.
- Missed-service penalties for P101 through P107 are respectively 5000, 12000, 8500, 4800, 4500, 9500, and 22000 cents. The objective minimizes route costs plus these penalties, not delivery count first.

The implementation enumerates all compatible service orders within each courier's stop/capacity limits, retaining a cheapest feasible route for every shipment subset. Dynamic programming across couriers retains a cheapest assignment for each covered subset. Comparing route cost plus uncovered penalties yields a global optimum. Shortest-path tie handling matches the artifact; assignment ties and unassigned explanations need not match under the contract.

## Checks

- `node --check recovered.mjs` passes.
- `node self-test.mjs` passes 6,272 scenarios, comparing objectives against the planner extracted from the supplied compiled artifact. This is an artifact-derived cross-check, not an external oracle or held-out reference.
- Coverage includes every permitted start minute with urgency on/off, all 4,096 road-closure subsets at minute 540 with alternating urgency, every disabled-courier subset at selected boundary times, 1,500 seeded mixed scenarios with reservations, and completely reserved shipments/couriers.
- Independently checked all output routes for resource exclusion, shipment partitioning, edge continuity and permissions, integer edge timing, readiness/service/deadlines, capacity, compatibility, shifts, costs, and penalty totals. Verified that the extracted private fixture reduces exactly to `public-model.json` when private fields are removed. Inputs remain unchanged.
- Standalone loading is also checked by importing the module directly from its source bytes as a data URL, without any relative filesystem context.

## Remaining uncertainty

No held-out oracle was available, and the complete Cartesian product of scenarios/reservations was not enumerated. The extracted artifact and independent feasibility/accounting checks agree on all tested cases. Exact global tie-breaking and reason wording intentionally differ where permitted. Invalid input behavior and application persistence/HTTP/UI behavior are outside scope.

The requested mattpocock skill collection was not installed among the local skills, and the no-network restriction precluded fetching it. Contract-first reconstruction, minimal standalone code, and explicit verification were used instead.
