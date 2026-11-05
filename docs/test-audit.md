# Review of the first experiment

Reviewed 6 November 2026 after the user questioned the first verdict. The original measurements remain historical evidence; this review does not replace them with a different run.

## Confirmed

Both files were actually obfuscated by the JavaScript adapter. Four retained artifact hashes match the recorded sizes, and both recovered implementation hashes match their score reports. Independent rescoring reproduced 42/42 for both functions. There is no evidence that an omitted adapter or incorrect candidate explains away those matches.

## Harness defects

1. The unanchored `artifacts/` ignore rule also excluded `evidence/artifacts/` from the initial Git commit. The exact input copies existed locally but were absent from the public repository. They are now packaged as `.js.gz`, with a hash-verifying unpack command. Generated plaintext stays local because synthetic decoy strings can trigger secret scanners.
2. The scorer returned success even when a candidate failed cases, and a missing export could receive rejection credit. It now checks the export and returns a failing status on a mismatch. A regression test checks wrong, missing and correct candidates. The old JSON counts were accurate despite the bad exit status.

## Experiment limitations

- The question measured was successful calculation recovery within eight minutes. The tool's stated goal is increased analysis cost; eventual success alone does not measure that goal.
- The `high` policy used reduced noise: 40 functions/80 strings/depth 2/8 KiB/five honeypots, versus upstream defaults of 200/500/depth 3/128 KiB/25. The prompt gate was disabled. This was a customized configuration.
- It was one attempt per variant, with inherited model settings and instruction-based source isolation. No reliable model token/cost comparison was recorded.
- Only the quote calculation was recovered. UI, persistence and HTTP validation were outside that recovery target. Server artifact possession was assumed; this was not an attack on a public URL.
- Switching to `paranoid` alone does not automatically strengthen every JavaScript-obfuscator option. At this revision the adapter uses its own options and does not translate the policy object into all engine settings.

The supported finding is: **both supplied pricing artifacts were recoverable in this exercise.** The first run does not establish that die-a-rea fails to raise recovery cost.

## Version 2

The next application adds coupled route selection, fleet assignment, capacity/deadline constraints, replanning and transactional dispatch. Functional correctness comes first. Future recovery evaluation must separate correctness, actual enabled protections and measured effort, preserve immutable inputs, and allow alternative equally valid optimal plans rather than treating a tie-breaking difference as failed recovery.

The V2 state review found a real defect before publication: a replan could reuse a courier already sent on an overlapping trip, even when shipment reservations did not overlap. The fix reserves each courier once per batch in the same transaction as its shipments. Running-API regression checks and an independent scratch SQLite probe confirmed conflict rejection, rollback, exclusion on replan and idempotent retries. The UI disables already dispatched couriers. This fixes the application model; it is not a hardening result.
