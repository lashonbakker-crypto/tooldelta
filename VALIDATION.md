# Validation record

## Local implementation — 2026-10-22

The initial 24 Node.js 24.19.0 / Linux behavior tests passed, covering strict JSON, supported constraints, complex-keyword review, prototype-looking names, HTML escaping and real CLI exit codes/file preservation. The built-in synthetic upgrade computes 5 risk findings, 4 distinct verified requests and 1 manual-review finding.

After adding an independent Ajv 8.20.0 / JSON Schema 2020-12 oracle and semantic-equivalence regressions, all **26 tests passed** on Node.js 24.19.0 / Linux. The oracle verifies every emitted example in the synthetic upgrade and a grid of numeric-bound, integer/number, boolean-schema, array-uniqueness and property-count changes: the old validator accepts and the new validator rejects, or the tool is absent. Enum ordering and explicit minimum-count zero do not create drift.

Remote platform CI and browser checks will be recorded after execution. Configuration alone is not evidence of a successful run.

These are correctness checks on self-authored/synthetic schemas. No live MCP server, model, real private contract, user adoption or production throughput was tested.
