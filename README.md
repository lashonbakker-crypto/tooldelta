<p align="center"><img src="logo.svg" width="54" alt="ToolDelta"></p>
<h1 align="center">ToolDelta</h1>
<p align="center"><strong>Show the exact MCP tool call your upgrade breaks.</strong></p>
<p align="center">Visual contract diff · verified failure examples · dependency-free CLI</p>
<p align="center"><a href="https://lashonbakker-crypto.github.io/tooldelta/">Try the live workbench</a> · <a href="#quick-start">Quick start</a> · <a href="README.zh-CN.md">中文</a> · <a href="DESIGN.md">How it works</a></p>
<p align="center"><a href="https://github.com/lashonbakker-crypto/tooldelta/actions/workflows/ci.yml"><img src="https://github.com/lashonbakker-crypto/tooldelta/actions/workflows/ci.yml/badge.svg" alt="Test ToolDelta"></a></p>

[![ToolDelta live workbench with an old-accepted, new-rejected request](demo.jpg)](https://lashonbakker-crypto.github.io/tooldelta/)

An MCP server upgrade can change one required argument and break an otherwise working agent. ToolDelta compares **two saved tool snapshots** and shows the drift **with concrete arguments that the old input schema accepts and the new one rejects**.

Open the [workbench](https://lashonbakker-crypto.github.io/tooldelta/), try the built-in examples, or choose two local JSON files. No account, API key, model call or server connection is needed. The browser and CLI share the same analysis core.

## See it on a tiny upgrade

```text
search_docs / properties.limit.maximum
old: maximum = 100      new: maximum = 20

{"name":"search_docs","arguments":{"query":"x","limit":100}}
  ✓ old input schema accepts
  × new input schema rejects
```

The included synthetic upgrade reports **5 risk findings, 4 distinct verified requests and 1 manual-review finding**. The same request can demonstrate more than one change. These are schema checks, not live tool calls.

<details>
<summary>See the actual findings view</summary>

![ToolDelta workbench showing five risks, four verified examples and one review item](workbench.jpg)

Actual screenshots of the deployed workbench using the included synthetic snapshots.
</details>

## Why use it

- **Understand a break without reading two JSON blobs.** Required arguments, removed tools, enum narrowing, types, nested properties and bounds get explainable findings.
- **Inspect evidence.** Verified examples must pass the entire supported old schema and fail the entire supported new schema, with the relevant changed constraint demonstrated. Tests also cross-check generated examples using independent Ajv 2020-12 validators.
- **Keep uncertainty visible.** References, patterns, composition, custom dialects and other unsupported keywords suppress verified examples for that tool. Descriptions, output schemas and advisory hints are marked for review.
- **Bring it to a pull request.** Export a standalone HTML report, Markdown or machine-readable JSON. Use explicit CLI exit codes to gate a change.
- **Use it locally.** Runtime code has zero third-party dependencies. The workbench processes snapshots in memory and makes no data-upload or telemetry requests. Hosted assets are served by GitHub Pages.

## Quick start

Requires **Node.js 20+**. No `npm install` is needed to use the CLI:

```bash
git clone https://github.com/lashonbakker-crypto/tooldelta.git
cd tooldelta
node tooldelta.mjs before.json after.json
```

The demo returns **1** because it finds risks. To explore without gating:

```bash
node tooldelta.mjs before.json after.json --fail-on none
node tooldelta.mjs before.json after.json --format html --fail-on none > upgrade-report.html
node tooldelta.mjs before.json after.json --format markdown --fail-on none > upgrade-report.md
node tooldelta.mjs before.json after.json --format json --fail-on review
```

Write reports to a **new path**, not an input snapshot: shells truncate redirected files before the CLI runs. Reports may contain schema values and generated arguments; review them before sharing.

For a local browser workbench, serve this directory over HTTP (ES module workers do not work reliably from `file:`):

```bash
python -m http.server 8080 --bind 127.0.0.1
# open http://127.0.0.1:8080
```

The CLI does not open network connections or launch MCP commands. Capture complete tool lists with your existing trusted client. It accepts an array of tool definitions, `{ "tools": [...] }`, or `{ "result": { "tools": [...] } }`. Merge **all** pages first: a nonempty `nextCursor` is rejected to avoid treating an incomplete page as a removed tool. Both snapshots should describe the **same server and intended tool scope**.

## CLI contract

| Option | Values | Default |
| --- | --- | --- |
| `--format` | `text`, `json`, `markdown`, `html` | `text` |
| `--fail-on` | `risk`, `review`, `none` | `risk` |

| Exit | Meaning |
| --- | --- |
| `0` | No findings selected by the gate; not a compatibility guarantee |
| `1` | Risk findings exist, or review findings with `--fail-on review` |
| `2` | Invalid/incomplete input, resource bound reached, or analysis failure |

Example CI step after checking out your own before/after files:

```yaml
- name: Review MCP tool drift
  run: node tooldelta.mjs contracts/baseline.json contracts/candidate.json --format markdown --fail-on review
```

The default risk gate is conservative and may flag a constraint change for which no counterexample was generated. Use review findings and raw schema evidence alongside the result.

## Supported scope and limits

Input schemas must have root `type: "object"`. Verification supports types (including integer/number widening), properties, required fields, additional properties, enum, const, minimum/maximum/exclusive bounds, Unicode codepoint string length, array items/length/uniqueness, and object property counts.

**This is not a full JSON Schema compatibility solver.** `$ref`, composition (`allOf`, `anyOf`, `oneOf`, conditionals), patterns, formats, custom dialects and unknown validation keywords require manual review. No reference is fetched or regex from a snapshot executed. An unchanged unsupported schema can be reported unchanged; that does not validate the schema. Candidate generation is bounded and incomplete. No witness does not mean no break. Advisory MCP annotations are not enforced permissions or evidence of actual server behavior.

Each snapshot is capped at 2 MiB, 200 tools, JSON depth 40 and schema depth 32. Analysis has a 250,000-operation budget and 1,000-finding cap. The browser worker stops after five seconds. Integer values outside JavaScript's safe range, nonfinite numbers, duplicate keys and duplicate tool names fail clearly. Ordinary numeric values use JavaScript/IEEE-754 semantics.

## Development

```bash
npm ci
npm test
```

Ajv is a pinned **development-only oracle**, not a runtime dependency. Tests cover generated witnesses, a numeric constraint grid, prototype-looking keys, Unicode, ambiguous JSON, incomplete pagination, untrusted HTML and real CLI exits/file preservation. Platform results and browser checks are recorded in [VALIDATION.md](VALIDATION.md); a workflow file alone is not evidence that CI passed.

## Related work and sources

[mcpdiff](https://github.com/samlader/mcpdiff), [mcpdrift](https://github.com/gdworks-studio/mcpdrift) and [Cisco MCP Toolkit Contract](https://github.com/cisco-open/mcptoolkit-contract) also address contract drift. ToolDelta focuses on a lightweight browser workbench, visible counterexamples, shared browser/CLI behavior and static saved-file analysis. It does not implement their live capture, resource/prompt inventories or server testing. This is an independent implementation, not a claim that the problem or approach is unique.

Format references: [MCP tool definitions](https://modelcontextprotocol.io/specification/2025-11-25/server/tools), [JSON Schema objects](https://json-schema.org/understanding-json-schema/reference/object), [Ajv JSON Schema versions](https://ajv.js.org/json-schema.html).

## Contributing

Useful first contributions: a minimal schema pair that exposes a missed change, a smaller counterexample, keyboard/accessibility fixes, or a tested extension of the supported subset. Include the expected finding and old/new validation result. Please use synthetic examples instead of private schemas or traces. See [CONTRIBUTING.md](CONTRIBUTING.md).

If this saves you an upgrade investigation, a Star makes it easier to find again. Real failure cases are even more useful.

MIT · [License](LICENSE)
