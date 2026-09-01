# GENERATED_DIRECTORY_CONTRACT

This directory contains Phase 15 geometry/movement/collision/spawn/anti-stuck
contracts imported from the hash-pinned Phase 15 implementation package. Every
file here is an authority contract whose SHA-256 was verified against
`PACKAGE_MANIFEST.json` in the Phase 15 kit at import time.

Files in this directory are machine-verified authority inputs, not
human-maintained source. They are exempt from the line-budget gate for that
reason. Never edit them by hand — regenerate or re-import them.

## Documented deviation

`diagnostic-codes.json` was extended with the five `P15_G14_*` readiness
codes (`P15_G14_NOT_REPRODUCED`, `P15_G14_MASSSIM_MISSING`,
`P15_G14_CROSSRUNTIME_MISSING`, `P15_G14_WEBVIEWS_NOT_RUN`,
`P15_G14_DEVICE_PERF_MISSING`) that the Phase 15 readiness gate
(`tools/sim/validate-phase14-readiness.mjs`) emits but the kit registry omits.
Same gap class as Phases 11–14 (rule, math, random and sim readiness codes);
the extension keeps the emitted-vs-registered scan clean in both directions.

The 26 runtime codes from the kit are imported verbatim and unchanged.
