# V2 blog fact-check

Reviewed 6 November 2026 against the completed public evidence and pinned tool source. Reviewed draft: the portfolio's `content/posts/rea-die-a-rea-nextjs-experiment.md`. The fact-checker made no article or application edits.

## Finding

**No blocking factual or arithmetic error found.** One small metric clarification would help: explicitly state that the recovery completion times exclude the separately recorded REA preprocessing. The article explains process startup and self-checks, but this exclusion is explicit only in the evidence. Suggested sentence near the results table: “These completion times exclude the separate REA static-analysis runs, whose timings are reported above.” This keeps the 31.5% figure clearly scoped to analyst process time rather than end-to-end preprocessing plus recovery. [Summary interpretation](../evidence/v2/summary.json) [Recovery timing implementation](../scripts/v2-recover.mjs#L58-L70)

## Numbers verified

Resolution: the article now explicitly excludes the separately prepared REA scans from recovery completion times. Its results table also combines attempt/build into one column for readability; measured values are unchanged.

Recomputed from per-attempt usage/time records and file sizes, rather than rounded display times:

| Article claim | Exact evidence/calculation | Verdict |
| --- | --- | --- |
| Median 2:01 versus 2:39 | 120.787 s versus 158.864 s, rounded to nearest second | Correct |
| About 38 seconds / 31.5% longer | 38.077 s; `(158864 / 120787 - 1) × 100 = 31.5241%` | Correct |
| 58.4% more median uncached input | 29,820 → 47,242; 58.4239% | Correct |
| 29.9% more median output | 8,330 → 10,821; 29.9040% | Correct |
| Browser gzip 14.34× | 67,850 / 4,733 = 14.3355 | Correct |
| Planner gzip 9.63× | 75,830 / 7,872 = 9.6329 | Correct |

The individual attempt durations/token columns and all four artifact-size rows match the records. The summary calculates uncached input per attempt before taking its median. These are cumulative CLI counters and observed process times; the article appropriately avoids dollar cost, backend-model attestation and a general performance claim. [Summary](../evidence/v2/summary.json) [Summary calculation](../scripts/summarize-v2.mjs)

Freshly rescored all **six public candidates** with the revised VM grader: each passed **768/768 rows and 767/767 distinct inputs**, with zero failures. Candidate hashes match the individual score records and summary. The recorded runs all exited successfully without timeout. [Public submissions and scores](../evidence/v2/recoveries) [Scorer](../scripts/v2-lab.mjs#L94-L117) [Summary](../evidence/v2/summary.json)

Case composition matches: 768 rows, 767 distinct inputs, 458 zero-delivery cases, 310 delivery cases, 116 multi-courier cases and 417 cases without reservations. Both API preservation records report 417/417. The article discloses the duplicate, easy-case prevalence, post-freeze optimum audit and small attempt count without presenting the sample as exhaustive. [Coverage](../evidence/v2/case-coverage.json) [Before API](../evidence/v2/api-reference-before.json) [After API](../evidence/v2/api-reference-after.json) [Oracle audit](../evidence/v2/oracle-check.json)

REA's planner times are 2.701 s and 9.452 s; its original planner graph has 3,360 nodes/1,179 unknowns. Every hardened graph is marked truncated at 12,000/4,000, while no original graph is truncated; all eight parse-failure counts are zero. The article's distinction between a saturated static report and successful behavioral recovery is supported. [REA summary](../evidence/v2/rea-summary.json)

The normal, bridge-closed and urgent examples were also recomputed from the source: $54.83, $62.03, and $54.37 + $95 = $149.37 respectively, with the stated courier orders/return times and urgent omission P106. Fleet capacities, certification limits and the combined 11 kg medical load agree with the fixture. [Fixture](../src/lib/dispatch-fixture.ts) [Planner](../src/lib/dispatch-engine.ts)

## Protection and scope claims

The High/full-default configuration, generated counts, single-file decoy-file exception, fixed JavaScript-engine settings, unforwarded seed, potentially removed comment padding and observational guard agree with [the retained configuration](../die-a-rea-v2.toml) and [the pinned-source review](v2-method-review.md). In particular, the article correctly calls base64 a representation change and avoids presenting runtime detection or the prompt gate as an enforcement barrier. [Pinned adapter](https://github.com/danihelenterprises/die-a-rea/blob/0d322552673309372f9937bc5f0c50641ed1514e/adapters/js/direa-js) [Pinned JS guard](https://github.com/danihelenterprises/die-a-rea/blob/0d322552673309372f9937bc5f0c50641ed1514e/crates/direa-core/src/guard.rs#L28-L57)

The analyst reports support the described decoder/VM extraction methods and the qualification that compiled files supplied the decisive evidence; REA's incremental benefit was not isolated. Copied-server access, planner-only recovery, public source, instructional network avoidance, read-only path exclusions, unrestricted writes and requested-model limits are disclosed. Keep these qualifications with the verdict. [Reports](../evidence/v2/recoveries) [Protocol](../evidence/v2/recovery-protocol.json) [Integrity limits](../evidence/v2/integrity.json)

Fresh read-only checks verified the published reference commitment and all **eight decompressed artifact hashes** against the final integrity record. The final audit additionally reports unchanged private trial chunks and six distinct thread IDs; those private locations were not independently accessed in this review. This evidence supports the article's completed integrity-check statement. [Integrity record](../evidence/v2/integrity.json)
