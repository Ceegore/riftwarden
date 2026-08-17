# GENERATED_DIRECTORY_CONTRACT

This directory contains Phase 14 sim-kernel contracts imported from the
hash-pinned Phase 14 implementation package. Every file here is an authority
contract (diagnostic codes, A–M pipeline stages, scheduler event priorities,
phase-13 readiness expectation) whose SHA-256 was verified against
`PACKAGE_MANIFEST.json` in the Phase 14 kit at import time (4/4 matched).

Files in this directory are machine-verified authority inputs, not
human-maintained source. They are exempt from the line-budget gate for that
reason. Never edit them by hand — regenerate or re-import them.

## Documented deviation

`diagnostic-codes.json` was extended with the six `P14_*` readiness-blocker
codes (`P14_G13_NOT_PROVEN`, `P14_RULES_API_UNVERIFIED`,
`P14_PRNG_REPLAY_API_UNVERIFIED`, `P14_CONTENT_TYPES_UNVERIFIED`,
`P14_TRACEABILITY_MISSING`, `P14_CROSSRUNTIME_EVIDENCE_MISSING`) that the
kit's own `validate-phase13-readiness.mjs` emits but its registry omits. Same
gap class as Phases 11/12/13 (rule, math and random readiness codes); the
extension keeps the emitted-vs-registered scan clean in both directions.

The 18 runtime codes from handbook §13 are imported verbatim and unchanged.
