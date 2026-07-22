# Branch protection setup for Gate G01

Apply these requirements to the default branch `main` using the hosting provider's branch rule or ruleset UI/API:

1. Require a pull request before merging.
2. Require at least one approving review.
3. Dismiss stale approvals after new commits.
4. Require approval from Code Owners for owned paths.
5. Require approval of the most recent reviewable push by someone else where the provider supports it.
6. Require the checks `verify-repo`, `file-length-check`, `text-normalization`, and `repo-tests` in strict/up-to-date mode.
7. Require conversation resolution.
8. Require linear history and use squash merge.
9. Block force pushes and branch deletion.
10. Do not permit routine admin bypass. Emergency bypass must be separately evidenced and reviewed.

## Evidence procedure

- Let the bootstrap workflow run once so the check names exist.
- Configure the branch rule.
- Export the provider rule as JSON when possible and save it under `docs/reports/generated/hosting/`.
- Capture screenshots showing the repository name, branch pattern and every required toggle.
- Hash each evidence file and list it in `docs/governance/branch-protection-evidence.json`.
- Replace all placeholders in `.github/CODEOWNERS` with real resolvable users or teams.
- Run `node tools/repo/verify-governance-evidence.mjs`.

A local JSON file cannot prove the remote rule by itself. Reviewer identity, export/screenshot and a negative push/merge attempt are required for final Gate G01 evidence.
