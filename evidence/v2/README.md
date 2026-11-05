# V2 functional evidence

The production standalone app was exercised at `http://127.0.0.1:4330` with a dedicated local SQLite database. All data is fictional.

- `functional-checks.json`: nine running-API checks, including replanning, strict request validation, persistence, idempotent retry, shipment conflicts and a courier conflict between drafts with disjoint shipments.
- `dispatch-desktop.png`: the normal six-shipment draft, real computed paths and $54.83 objective.
- `dispatch-overview.png`: a crop of the same desktop capture for the repository overview.
- `dispatch-bridge-closed.png`: all six delivered after a detour, at $62.03.
- `dispatch-urgent.png`: urgent medical shipment changes assignment; P106 is unassigned, with $149.37 objective including penalty.
- `dispatch-committed.png`: committed state restored after reload, used couriers disabled and one persisted reservation event.
- `dispatch-mobile.png`: the same committed state at a 390 × 844 viewport. The wide shipment table scrolls horizontally.

Browser checks also confirmed stale routes disappear when constraints change, saved draft URLs restore the selected scenario, and a new batch resets the planning controls. The viewport override was reset after testing.

These are application correctness checks. **REA and die-a-rea have not yet been evaluated against V2.** Historical V1 recovery scores and bundle sizes must not be reported as V2 results.
