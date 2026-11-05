# Dispatch Lab: a behavioral recovery target

Version 2 replaces the quote-only home page with a dispatch operation. The old application remains at `/quote`, and its experiment records remain unchanged.

## What the user does

Start with the full fleet at 09:00. Plan a batch, inspect the colored paths, delivery order, return times and cost. Close the bridge, remove a courier, move the start time or add the urgent medical kit, then replan. Changed constraints clear stale routes and require a new draft before dispatch. Select a shipment to highlight its destination or filter the map by courier.

Dispatch saves the plan and reserves both shipments and couriers. A saved plan URL restores its state after reload. Repeating a successful commit returns the same saved result; a competing draft that uses an already reserved shipment or courier gets a 409 conflict. Replanning the same batch excludes committed resources. “New batch” starts an independent fictional planning scenario; it does not erase saved records.

## What the server computes

The fixture has eight nodes, twelve undirected roads, three couriers and six base shipments plus one optional urgent shipment. Road travel depends on courier speed; one road is bike-only. Every route starts and ends at the depot. Shipments have ready times, service durations, deadlines, weights and medical/battery requirements. Couriers have capacity, stop and shift limits and different certifications.

`planDispatch` solves three connected problems:

1. Dijkstra search finds the shortest usable path between stops for each courier, excluding closures and inaccessible roads. Travel minutes are rounded per road before summing.
2. For each courier and candidate shipment subset, an exact permutation search finds the cheapest feasible delivery order, including waiting, service and the return journey. Results are memoized by courier and subset.
3. An exact assignment search chooses disjoint courier subsets and unassigned shipments to minimize **fleet cost + missed-service penalties**. Deterministic ties make repeat runs reproducible. Penalties can make serving a more urgent shipment preferable to a different feasible delivery.

The fixture's tariff coefficients, speed factors and missed-service penalties remain server-side. The browser receives the public network, fleet capabilities and shipment requirements, plus computed plan results. This reduces direct exposure; it does not prove that API observations cannot reveal the rules.

This target requires more than drawing a familiar dispatch interface. A reconstruction must produce feasible paths, compatible loads, correct timings and costs, appropriate tradeoffs after constraints change, and correct saved-state behavior.

## Persistence and validation

Next.js route handlers accept bounded JSON with validated scenario fields. They compute plans from the server fixture rather than trusting submitted routes or prices. SQLite stores plan payloads and unique shipment/courier reservations per batch. `BEGIN IMMEDIATE` makes conflict checks and inserts atomic; failed commits roll back. Each courier takes at most one trip in a batch. Multi-trip scheduling is outside this model.

There are no accounts, payments or real dispatches. IDs locate fictional local records; they are not authentication. Use loopback and fictional data. The exact solver is deliberately bounded to eight shipments; it is an educational target, not a fleet-scale optimizer. The database needs writable local storage (`DISPATCH_DB_PATH`), so this is not a serverless deployment recipe.

## Evidence and the next recovery test

`npm test` covers constraint boundaries, a greedy-assignment trap, closure effects, validation and the original scorer regression. `npm run test:dispatch -- URL OUTPUT` checks the running HTTP and SQLite workflow, including competing transactions with disjoint shipments but the same courier. Screenshots document desktop, mobile, closure, urgent and committed states.

The completed [V2 evaluation](../evidence/v2/README.md) uses separate frozen snapshots, full-default High protections, three fresh attempts per build, independent feasibility/optimum checks and recorded time/usage. All six candidates passed 768 checks / 767 distinct inputs; median completion time increased 31.5% after hardening. This is copied-server-build recovery of the planner, not a browser-only attack or a full application clone. Dollar cost and independently attested backend model identity are not available. See the records for the exact limits and case composition.
