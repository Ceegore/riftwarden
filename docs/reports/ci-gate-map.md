# CI gate map — Phase 03 baseline

| Check | Current state in Phase 03 | Owner/activation | Required branch context |
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
| Localization parity | Not enabled before Phase 06 | Phase 06 | aggregate expects skipped |
| Content validation | Not enabled before Phase 09 | Phase 09 | aggregate expects skipped |
| Content reproducibility | Not enabled before Phase 10 | Phase 10 | aggregate expects skipped |
| Native config/Android debug | Not enabled before Phase 04 | Phase 04 | aggregate expects skipped |
| Asset manifest | Not enabled before Phase 38 | Phase 38 | aggregate expects skipped |
| Signed release | Not enabled; protected manual skeleton only | Phase 47 | never a Phase-03 PASS |

Every later activation changes both `ci/phase-gates.json` and the aggregate-result contract in the same reviewed PR. A skipped job is never described as a successful platform test.
