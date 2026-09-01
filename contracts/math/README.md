# GENERATED_DIRECTORY_CONTRACT

This directory contains Phase 12 math contracts imported from the
hash-pinned Phase 12 implementation package. Every file here is an authority
contract (diagnostic codes, formula constants, phase-11 readiness
expectations) whose SHA-256 was verified against `PACKAGE_MANIFEST.json` in
the Phase 12 kit at import time (3/3 matched).

Files in this directory are machine-verified authority inputs, not
human-maintained source. They are exempt from the line-budget gate for that
reason. Never edit them by hand — regenerate or re-import them.

## Documented deviation

- `diagnostic-codes.json` was extended with the five codes the kit's own
  Phase 12 tooling emits but its pinned registry omits:
  `P12_RULE_SNAPSHOTS_UNVERIFIED`, `P12_TRACEABILITY_MISSING`,
  `P12_PUBLISHED_IDS_MISSING` (readiness gate) and `P12_LOCAL_ROUNDING`,
  `P12_LOCAL_BPS_MATH` (callsite audit). The repo contract must cover every
  code the implementation emits, so these entries were added deliberately;
  the kit hash for this one file therefore no longer matches. All other
  files remain byte-identical to the kit.
