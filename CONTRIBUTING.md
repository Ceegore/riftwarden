# Contributing to Riftwarden

## Authority

The approved GDD V5 is product and design authority. The Production-Ready Development Plan V2 controls phase order, ticket size, repository layout, Git process and test timing. Accepted ADRs may choose implementation details only inside those boundaries.

Never infer missing product content. Stop and open a Decision Request when a task needs a new feature, changed limit, dependency, permission, entitlement, endpoint, save/content/simulation reinterpretation or any other design decision.

## Before work

1. Start from a clean, current `main`.
2. Verify the predecessor gate from real reports and evidence. A handbook is not evidence.
3. Record `git rev-parse HEAD`, branch, working-tree status and relevant REQ/TEST IDs.
4. Open a draft PR with scope, stop conditions, file plan, tests and rollback.
5. List expected line counts and split points before implementation.
6. Add failing contract tests or validators before the implementation when applicable.

## Branches

- `main`: protected and always buildable; no direct push or force push.
- `feat/<phase>-<topic>`: one coherent ticket block, created from current `main`.
- `fix/<issue>-<topic>`: reproducing test plus minimal fix.
- `release/<version>` and `hotfix/<version>-<issue>` are introduced by release phases only.
- There is no long-lived `develop` branch.

## Commits

Use Conventional Commits: `feat`, `fix`, `test`, `refactor`, `perf`, `build`, `ci`, `docs`, `chore`. Scope describes the module, not the author. A commit has one reason. Separate mechanical formatting, contract tests and implementation when this improves review.

Phase 01 suggested commits:

1. `chore(repo): initialize single-project repository`
2. `feat(tooling): enforce file-length and root contracts`
3. `docs(governance): add contribution review and ADR templates`

The recommended squash title is `feat(core): complete phase 01 gate`.

## Pull requests

A PR covers at most one coherent ticket block. Around 800 changed human-maintained lines, document and perform a split review. The PR must contain:

- phase/ticket, REQ and TEST/MANUAL IDs;
- changed files with line counts;
- commands, results and evidence paths;
- cross-cutting impact for localization, accessibility, save, security/privacy, performance and store/native;
- open defects by severity;
- rollback target and migration implications;
- a gate decision of PASS or BLOCKED, never an unproved PASS.

Rebase onto current `main` and rerun required checks on the final head before merge. Use squash merge. Do not self-approve critical paths; CODEOWNERS review is required where configured.

## Required Phase-01 checks

```bash
node tools/repo/verify-root.mjs
node tools/check-file-length.mjs
node tools/repo/check-text-normalization.mjs
node --test tests/unit/repo/*.test.mjs
node tools/repo/verify-governance-evidence.mjs
```

Full formatter, ESLint, strict TypeScript, Vite, Vitest and Playwright are frozen in Phase 02. In a clean Phase-01 repository they are not installed and must be reported as `NOT_YET_AVAILABLE_BY_PHASE_DESIGN`, not falsely marked green. Existing migrated tooling must still be run if present.

## File size

- 0–250 physical lines: target range.
- 251–300: inspect for a coherent split.
- 301–500: warning; PR requires a concrete split decision or justification.
- 501 or more: merge blocker.

Only narrowly designated generated directories are exempt. Human source, JSON, localization and native files cannot be allowlisted to hide growth.

## Tests

Never weaken, skip, delete or broaden a tolerance to make a test pass. Fix the cause or stop with a blocker. Every defect fix adds a regression test. Preserve the failing seed or fixture when a generated test finds a defect.

## Sensitive data and artifacts

Do not commit secrets, environment files, keystores, certificates, provisioning profiles, signed AAB/APK/IPA/XCArchive files, local saves, diagnostics, generated atlases or store credentials. If any sensitive material enters Git history, stop and treat it as a security incident; deleting only the working-tree file is insufficient.

## ADR and change control

An ADR is required for public module boundaries, runtime dependencies, native plugins, permissions/entitlements, save/content/simulation versions or renderer paths. An ADR cannot authorize a new feature, changed scope, changed balance principle or weaker product guarantee; those require a new approved product/GDD change.

## Rollback

The rollback target is the last green `main` commit before the branch. Phase 01 adds no published persistence or content version, so a clean Git revert is expected. After merge, observe the full available `main` pipeline. Revert or open a fix branch immediately on regression; never repair silently on `main`.
