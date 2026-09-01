# GENERATED_DIRECTORY_CONTRACT

This directory contains Phase 11 rule contracts imported from the
hash-pinned Phase 11 implementation package. Every file here is an authority
contract (snapshots, registries, enum/id namespaces, diagnostic codes) whose
SHA-256 was verified against `PACKAGE_MANIFEST.json` in the Phase 11 kit at
import time (12/12 matched).

Files in this directory are machine-verified authority inputs, not
human-maintained source. They are exempt from the line-budget gate for that
reason. Never edit them by hand — regenerate or re-import them.

## Documented deviation

- `diagnostic-codes.json` was extended once with `P11_ASSERT_NEVER` (QA
  commit, Phase 11 audit). The kit's pinned registry omits this code even
  though the shipped `assertNever` helper throws it on exhaustive-switch
  violations. The repo contract must cover every code the implementation
  emits, so the entry was added deliberately; the kit hash for this one file
  therefore no longer matches. All other files remain byte-identical to the
  kit.
