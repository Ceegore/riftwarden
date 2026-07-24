$ErrorActionPreference = 'Stop'
if (git status --porcelain) { throw 'Working tree must be clean.' }
pnpm verify:phase03
pnpm install --frozen-lockfile
pnpm build:release
if (-not (Test-Path .\android)) { pnpm exec cap add android }
if (-not (Test-Path .\ios)) { pnpm exec cap add ios --packagemanager SPM }
pnpm exec cap sync
pnpm verify:native-config
pnpm verify:plugin-contracts
New-Item -ItemType Directory -Force .\artifacts\native | Out-Null
node .\tools\native\hash-tree.mjs . android ios capacitor.config.ts | Set-Content -Encoding utf8NoBOM .\artifacts\native\tree-after-sync.json
