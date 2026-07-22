# Pull Request

## Scope
- Phase/Ticket IDs:
- Canonical REQ IDs:
- Canonical TEST/MANUAL IDs:
- SourceRevision before work:
- Branch:

## Contract change
- [ ] No product/design decision was invented.
- [ ] No dependency, permission, entitlement, endpoint, schema, save, simulation or content-version change.
- [ ] Any required ADR/Decision Request is linked below.

ADR/Decision Request:

## Changed files and line report
| File | Lines | Generated? | Split/reason when >300 |
|---|---:|---|---|

## Verification
| Command/test | Result | Evidence path |
|---|---|---|

- [ ] `node tools/repo/verify-root.mjs`
- [ ] `node tools/check-file-length.mjs`
- [ ] `node tools/repo/check-text-normalization.mjs`
- [ ] `node --test tests/unit/repo/*.test.mjs`
- [ ] Relevant negative tests were executed.
- [ ] No test was weakened, skipped or deleted to obtain green.

## Cross-cutting impact
| Dimension | Impact and evidence |
|---|---|
| Localization | None / details |
| Accessibility | None / details |
| Save/Recovery | None / details |
| Security/Privacy | None / details |
| Performance | None / details |
| Store/Native | None / details |

## Risk and rollback
- Last known green main commit:
- Revert safety:
- Migration/forward-fix requirement:
- Open P0/P1/P2 defects:

## Gate decision
- [ ] READY FOR REVIEW — evidence is attached.
- [ ] BLOCKED — blocker is described; no unproved PASS.
