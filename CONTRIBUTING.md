# Contributing

Start with a real, small before/after schema pair. Use synthetic or redistributable values. State the expected finding and whether a JSON request should be accepted by the old and new schemas.

Run `npm ci` and `npm test`. Changes to witness verification must include an independent Ajv check, not only an assertion against ToolDelta's own validator. Preserve the distinction between potential risks, manual review and verified examples. Test CLI exits and report escaping when affected.

UI changes should be tested with all three demo scenarios, invalid JSON, edits after a successful comparison, filtering, exports, keyboard focus and narrow layouts. Record actual browser/platform evidence in VALIDATION.md. Do not claim unrun checks or production scale.

Useful issues: a minimal missed narrowing, an incorrect witness, a smaller reproducible request, or an accessibility problem. Do not post private contracts, tokens or session logs. No automatic outreach or manufactured stars.
