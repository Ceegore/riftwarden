#!/usr/bin/env bash
set -euo pipefail

[[ -z "$(git status --porcelain)" ]] || { echo 'Working tree must be clean.' >&2; exit 1; }
pnpm verify:phase03
pnpm install --frozen-lockfile
pnpm build:release

# Generate only when android/ios do not already exist. Never overwrite an existing native project.
[[ -d android ]] || pnpm exec cap add android
[[ -d ios ]] || pnpm exec cap add ios --packagemanager SPM

pnpm exec cap sync
pnpm verify:native-config
pnpm verify:plugin-contracts
node tools/native/hash-tree.mjs . android ios capacitor.config.ts > artifacts/native/tree-after-sync.json
