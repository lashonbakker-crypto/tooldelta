# Validation record

## Local implementation — 2026-10-22

The initial 24 Node.js 24.19.0 / Linux behavior tests passed, covering strict JSON, supported constraints, complex-keyword review, prototype-looking names, HTML escaping and real CLI exit codes/file preservation. The built-in synthetic upgrade computes 5 risk findings, 4 distinct verified requests and 1 manual-review finding.

After adding an independent Ajv 8.20.0 / JSON Schema 2020-12 oracle and semantic-equivalence regressions, all **26 tests passed** on Node.js 24.19.0 / Linux. The oracle verifies every emitted example in the synthetic upgrade and a grid of numeric-bound, integer/number, boolean-schema, array-uniqueness and property-count changes: the old validator accepts and the new validator rejects, or the tool is absent. Enum ordering and explicit minimum-count zero do not create drift.

## Remote CI — 2026-10-22

[Run 39697235929](https://github.com/lashonbakker-crypto/tooldelta/actions/runs/39697235929), commit `1e9967855ce0631638e1fd18c2043cbecf20c9c5`, completed successfully. All five jobs ran dependency installation, the 26-test suite, the source demo and HTML report export:

| Runner label | Node major | Result |
| --- | --- | --- |
| ubuntu-latest | 20 | Passed |
| ubuntu-latest | 22 | Passed |
| ubuntu-latest | 24 | Passed |
| windows-latest | 24 | Passed |
| macos-15-intel | 24 | Passed |

These labels describe the tested environments; this is not an Apple Silicon or all-browser claim. CI actions are pinned to commit SHAs. Current runs are available in [Actions](https://github.com/lashonbakker-crypto/tooldelta/actions/workflows/ci.yml).

## Hosted browser checks — 2026-10-22

GitHub Pages [deployment 39697655851](https://github.com/lashonbakker-crypto/tooldelta/actions/runs/39697655851) served the actual [workbench](https://lashonbakker-crypto.github.io/tooldelta/). Checks used desktop Chromium through the ordinary rendered controls:

- Breaking sample: 5 risks, 4 distinct verified examples and 1 review item.
- Additive sample: 0 risks, 0 verified examples and 0 review items.
- Complex-schema sample: 0 risks, 0 verified examples and 2 review items.
- Editing input cleared stale findings/counts and disabled export; malformed JSON produced a visible error; loading a sample recovered normally.
- Risk filtering plus `read_note` search displayed the removed-tool finding; copying returned the corresponding JSON request.
- HTML, JSON and Markdown reports were downloaded and inspected. The JSON retained all 9 findings despite the active display filter. The HTML had a CSP and no script element; Markdown started with the report title.
- Swapping the sample recomputed the reverse comparison (2 risks, 2 verified examples, 1 review item). Clearing removed the report and disabled export.
- Choosing the repository's `before.json` and `after.json` through local file controls restored the expected 5/4/1 analysis with both local filenames shown.

`demo.jpg` and `workbench.jpg` are actual captures of this deployed UI. Mobile devices, other browser engines, live MCP servers and production workloads were not tested.

These are correctness checks on self-authored/synthetic schemas. No live MCP server, model, real private contract, user adoption or production throughput was tested.
