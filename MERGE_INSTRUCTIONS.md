# Phase-02 starter overlay merge instructions

1. Do not copy this overlay over an unknown repository.
2. Verify real G01 evidence and branch from current green `main`.
3. Diff every Phase-01 file first; preserve root, governance, file-length and branch-protection contracts.
4. Copy `reference/dependency-contract.json` and the Phase-02 tools/configs.
5. Rename `package.phase02.template.json` to the path expected by `tools/toolchain/contracts.mjs` only after review.
6. Run `toolchain:resolve`; manually approve Node/pnpm versions and compatibility decisions.
7. Run `toolchain:apply`; inspect the package diff before any install.
8. Perform first install with scripts disabled, audit licenses and lifecycle scripts, approve only reviewed build scripts, then create/freeze the authoritative lockfile.
9. Never copy `toolchain-freeze.template.json` to a PASS report without real registry and install evidence.
10. Phase 03 may replace temporary bootstrap-CI wiring, but must consume the same package scripts.
