# CI gate map — Phase 17 baseline

| Check | Current state in Phase 17 | Owner/activation | Required branch context |
|---|---|---|---|
| Bootstrap/tool versions | Active | Phase 02 | via `PR / required` |
| Format + file length | Active | Phase 01/02 | via `PR / required` |
| Lint + strict typecheck | Active | Phase 02 | via `PR / required` |
| Requirements validation | Active | Phase 00 | via `PR / required` |
| Unit/simulation/integration smoke | Active | Phase 02 | via `PR / required` |
| Release-mode Web build | Active | Phase 02 | via `PR / required` |
| E2E smoke | Active | Phase 02 | via `PR / required` |
| Workflow security | Active | Phase 03 | `PR / workflow-security` |
| Dependency/license/SBOM/audit | Active | Phase 03 | `PR / dependency-security` |
| Localization parity | Active | Phase 06 | aggregate expects success |
| Content validation | Active | Phase 09 | aggregate expects success |
| Content reproducibility | Not enabled before Phase 10 | Phase 10 | aggregate expects skipped |
| Rules gates (tests, magic audit, snapshots) | Not enabled before Phase 11 | Phase 11 | aggregate expects skipped |
| Math gates (tests, callsite audit, readiness) | Not enabled before Phase 12 | Phase 12 | aggregate expects skipped |
| Random gates (PRNG/replay tests, callsite audit, slots, golden seeds, readiness) | Not enabled before Phase 13 | Phase 13 | aggregate expects skipped |
| Sim kernel gates (tick/state/event tests, kernel import audit, G13 readiness) | Not enabled before Phase 14 | Phase 14 | aggregate expects skipped |
| Phase 15 movement gates (geometry/movement/lane-change tests, G14 readiness) | Active | Phase 15 | aggregate expects success |
| Phase 16 targeting gates (query/score/lock/attack-prep tests, G15 readiness) | Active | Phase 16 | aggregate expects success |
| Phase 17 combat gates (attack/projectile/damage/defeat/battle-end tests, G16 readiness) | Active | Phase 17 | aggregate expects success |
| Native config/Android debug | Active | Phase 04 | aggregate expects success |
| Asset manifest | Not enabled before Phase 38 | Phase 38 | aggregate expects skipped |
| Signed release | Not enabled; protected manual skeleton only | Phase 47 | never a PASS |

Every later activation changes both `ci/phase-gates.json` and the aggregate-result contract in the same reviewed PR. A skipped job is never described as a successful platform test.
