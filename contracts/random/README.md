# GENERATED_DIRECTORY_CONTRACT

This directory contains Phase 13 random/replay contracts imported from the
hash-pinned Phase 13 implementation package. Every file here is an authority
contract (diagnostic codes, phase-12 readiness expectation, replay version
policy, stream registry) whose SHA-256 was verified against
`PACKAGE_MANIFEST.json` in the Phase 13 kit at import time (4/4 matched).

Files in this directory are machine-verified authority inputs, not
human-maintained source. They are exempt from the line-budget gate for that
reason. Never edit them by hand — regenerate or re-import them.

## Documented deviation

`diagnostic-codes.json` was extended with the six `P13_*` readiness-blocker
codes (`P13_G12_NOT_PROVEN`, `P13_TRACEABILITY_MISSING`,
`P13_CONTENT_IDS_UNVERIFIED`, `P13_SIMULATION_VERSION_UNVERIFIED`,
`P13_ROLL_SLOTS_DEV_ONLY`, `P13_BROWSER_EVIDENCE_MISSING`) that the kit's own
`validate-phase12-readiness.mjs` emits but its registry omits. Same gap class
as Phases 11/12 (rule and math readiness codes); the extension keeps the
emitted-vs-registered scan clean in both directions. `P13_RELEASE_DEV_FIXTURE`
remains registered-but-latent (no tool in this package emits it), matching the
kit.
