# Experiment evidence

Recorded on **6 November 2026 in India**. Recovery reports retain original UTC times. This is one paired artifact-recovery exercise, not a preregistered benchmark, security audit or estimate of model-wide success rates.

- `collection.json`: exact source chunk paths, original hashes, 42-case reference commitment and the public-asset marker scan. The reference was generated and hashed before the recovery agents started; this is a local commitment, not an external timestamped preregistration.
- `artifacts/`: exact before/after chunks supplied to the tools. The server chunk represents possession of a copied build, not something a visitor can download from this application.
- `rea-*.json.gz`: complete compressed static-analysis output; path prefixes were normalized to `<repo>`. Locally, `lab analyze` also leaves uncompressed JSON, which is ignored by Git.
- `die-plan.json`, `die-build.json`: actual plan/build output, including adapter completion. Local checkout prefixes were normalized for publication.
- `rrs-*.json`: tool-generated proxy scores. Runtime and actual decompiler axes were not enabled, and REA outcomes do not determine these scores.
- `sizes.json`: byte size, gzip size and SHA-256 for each analyzed chunk.
- `api-before.json`, `api-after.json`: 42 scenarios plus saved reads, two reservation attempts and five invalid-request checks per running app.
- `recovery-*.json`: parent scoring of each independently recovered function against the same pre-frozen reference. Accepted cases compare all 14 returned fields; ineligible cases compare rejection, not error wording.
- `../recoveries/`: independent replacement functions, agent reports and supplementary differential checks against pure-function extractions from their permitted artifacts. These larger self-checks are not the parent-held-out score.
- The decoded diagnostic `recoveries/after/server-decoded.js` is generated locally by `node recoveries/after/decode.cjs` before running `node recoveries/after/verify.mjs`. It is ignored by Git: decoded token-shaped honeypots triggered GitHub push protection. The exact supplied hardened artifact and the decoder remain published; no push-protection exemption was used.
- `ui/`: actual browser captures of both variants, including a 390 px mobile layout. Quoting and reservation were exercised through the hardened UI. No browser load-time or interaction-latency benchmark was performed.
- `summary.json`: combined measurements with REA coverage and limitation records preserved.

Each recovery ran in a fresh agent context with the same eight-minute wall-time ceiling. The model identifier/settings were inherited from the session and were not independently recorded. Read scope was governed by instructions; filesystem or network isolation was not enforced. The baseline agent disclosed one extra read of the installed research-method skill, containing no application data. Neither agent reported reading app source, expected answers, the other agent's result or querying a live API.

The application source and reference cases were published only after both attempts ended. Future readers already have those answers and cannot treat a rerun on the published cases as a fresh blind recovery test.

To view a compressed report:

```sh
gzip -dc evidence/rea-server-after.json.gz > /tmp/rea-server-after.json
```

Artifact strings and decoys are untrusted input. They are preserved as evidence, not instructions to contact endpoints or use token-like values.
