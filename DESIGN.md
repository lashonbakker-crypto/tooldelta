# Design and compatibility scope

ToolDelta's output is evidence about saved tool definitions. It makes no tool calls. `parseSnapshot` reads bounded strict JSON, `compareSnapshots` normalizes complete tool lists and classifies changes, and the same module is imported by a CLI and a browser worker. There is no service backend, telemetry, account or model dependency.

## Verification

The comparator records conservative risk candidates. For a risk, a bounded generator searches old-schema examples and changed-path values. A request receives a verified flag only when the complete supported old schema accepts it, the complete supported new schema rejects it, and the affected constraint is demonstrated. For a deleted tool, the new snapshot must omit it. Unknown keywords anywhere in either input schema suppress all witness verification for that tool. Counterexamples may trigger multiple changes; the headline count deduplicates requests by tool name and canonical arguments.

The subset validator is deliberately small. It never evaluates patterns or dereferences URLs. The independent pinned Ajv test oracle validates generated witnesses using draft 2020-12 and own JSON properties. The oracle is a development dependency; it is not bundled into the workbench or needed by the CLI.

## Conservative versus proven

Risk findings and verified requests are distinct. A bound can change without reducing the actual accepted set because another constraint dominates it, or a schema can be unsatisfiable. The generator may fail to find a witness. A risk without a witness remains potential. A verified request proves only that this particular JSON value is accepted/rejected by the supported static schemas. It does not establish runtime behavior, loss of authorization, or exhaustive compatibility.

Optional property additions on an open object can narrow previously unconstrained extras; on a closed object, allowing a new optional property widens the accepted set. Removing a required condition is a relaxation. Integer inputs are accepted by the `number` type, so integer-to-number widening is not classified as narrowing. Enum/type order changes and explicit minimum-count zero are ignored as equivalent. Required-list order is also irrelevant.

Output-schema, description and annotation changes are review findings. Tool behavior may change without any metadata changing; ToolDelta cannot detect that. Snapshots from different authorization scopes can create apparent removals: callers must compare the same intended tool scope and merge every page.

## Input and rendering boundaries

Local snapshots may contain untrusted names and values. The parser rejects duplicate keys, unsafe integer values, nonfinite numeric values and excessive bytes/depth/nodes. Tool names are deduplicated in Maps. Prototype-looking keys stay data. Browser elements use textContent; HTML exports escape data and prohibit scripts. No reference, icon or URL found in a snapshot is fetched.

Each snapshot: at most 2 MiB, 200 tools, JSON depth 40, schema depth 32. Core work is limited to 250000 checked operations and 1000 findings. Candidate generation caps strings at 64 codepoints and arrays at 16 items; it may produce no candidate for larger minima. Browser analysis happens in a worker that terminates after five seconds. Resource-bound failures return an error rather than a partial successful report. The CLI reads only explicit file paths and never intentionally modifies snapshots. Redirected output is controlled by the shell; never redirect into an input path.

## Next contributions

- More independently verified counterexample strategies, including minimal requests and array uniqueness.
- Explicit version adapters for newly observed complete MCP snapshot envelopes, with public/synthetic fixtures.
- A full JSON Schema validation/solver extension behind a clearly separate mode and resource boundary.
- A comparison view for output-schema consumer guarantees.

Live server capture, server execution, credentials, LLM interpretation, hosted storage and automatic comments are outside v0.1.
