# Dispatch planner recovery

## Method

Read `contract.md` first, then inspected the supplied compiled JavaScript locally. The planner artifact contains both the complete optimization routine and its private fixture. The same private fixture is present in the page and persistence artifacts; the self-test confirms all three copies agree and that removing private fields reproduces `public-model.json`. No external source, earlier attempt, network service, or held-out reference was used. REA reports were unnecessary because the relevant compiled modules were directly recoverable.

`recovered.mjs` embeds only the necessary fixture data and exports synchronous `planDispatch(scenario, reserved = {shipments:[],couriers:[]})`. It has no imports, dependencies, file access, or network access.

## Recovered rules

- Remove reserved shipments/couriers before planning; disable scenario couriers, close scenario roads, and include P107 only for urgent scenarios.
- Roads are bidirectional. Only bikes use the cycle shortcut. Round each edge's duration upward after applying the courier's time factor, then compute shortest paths.
- Each courier has one depot-to-depot trip. Enforce total initial load, maximum stops, medical cold-chain compatibility, and battery compatibility.
- Begin at `startMinute`; at each destination, service starts at the later of physical arrival and shipment readiness. Report that service-start time as `arrival`. Service must finish by the deadline. Waiting, service, and the return trip all count toward the shift and billed duration. Shift limits are relative to scenario start, not an absolute shift-end clock.
- Trip cost is base cents plus elapsed minutes times minute cents. Sprinter: 317/18, factor 1; coldbox: 683/23, factor 1.05; cargo: 149/12, factor 1.3.
- Miss penalties for P101–P107 respectively: 5000, 12000, 8500, 4800, 4500, 9500, 22000 cents.
- Enumerate feasible stop orders for each courier/subset, cache minimum-cost routes, and exhaustively assign each active shipment to a courier or missed service. Minimize route costs plus penalties, not merely the number missed. Preserve complete edge walks, service timing, and return timing.

## Checks

Run `node --check recovered.mjs` and `node self-test.mjs`.

- 6,503 cases match the locally extracted compiled routine's entire output and independently pass route/timing/accounting invariants.
- Coverage includes every integer start minute from 480 through 720, both urgency settings, and all disabled-courier subsets with open roads; each individual road closure at six representative start times; 2,500 deterministic randomized road/resource/reservation combinations; and explicit fully disconnected, all-shipments-reserved, and all-couriers-reserved cases.
- 855 cases additionally match an independent optimizer using Floyd–Warshall distances, direct route-order enumeration, and disjoint-subset dynamic programming. This check does not use the compiled planner's assignment search or feasibility pruning.
- Checks also confirm input immutability, synchronous output, fixture agreement, and no imports in the deliverable.

## Remaining uncertainty

No known discrepancy for contract-valid inputs. The complete combinatorial input space was not enumerated, and no held-out oracle was available. Invalid-input rejection and application/HTTP/database behavior are intentionally excluded by the contract. The diagnostic self-test imports local evidence and Node built-ins; the delivered `recovered.mjs` does not.
