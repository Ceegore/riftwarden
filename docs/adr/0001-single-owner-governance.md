# ADR-0001: Single-Owner Project Governance

**Status:** Accepted
**Date:** 2026-07-22
**Decided by:** CM (project owner)

## Context
Riftwarden is a single-owner project (CM, @ceephone333). GitHub branch protection
requires at least one approving review and codeowner review, but GitHub prohibits
self-approval of one's own PRs. This creates a deadlock: the sole contributor
cannot satisfy the "independent review" requirement.

The Phase 01 handbook (§8.2, §13.3) explicitly identifies this: "Einpersonenprojekt
kann nicht unabhängig reviewen. Publisher muss eine reale zweite Reviewinstanz,
Providerregel oder ausdrücklich akzeptierte Governancealternative festlegen."

## Decision
For the single-owner development phase, merges to `main` will use GitHub's admin
merge after all automated checks (verify-repo, file-length-check, text-normalization,
repo-tests) pass green on CI. The automated checks serve as the "review" gate.

Branch protection remains active: PR required, 4 required status checks (strict),
linear history, force-push/delete disabled, conversation resolution required.

## Consequences
- `require_code_owner_reviews` and `require_last_push_approval` are relaxed for the
  single-owner phase; all other protection rules remain enforced.
- When a second contributor joins, full review requirements will be re-enabled.
- Every merge is evidenced by green CI + the squash commit + this ADR.

## Alternatives considered
- Disable branch protection entirely: rejected (loses all automated gates).
- Create a bot reviewer: rejected (adds complexity, not a real independent review).
- Wait for a second human reviewer: deferred until team growth warrants it.
