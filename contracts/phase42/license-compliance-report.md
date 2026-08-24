# Phase 42 License Compliance Report

**Status:** TEMPLATE — requires real audit of `node_modules`.

## Core Direct Dependencies

| Package | Version | License | Allowed? |
|---|---|---|---|
| react | ^19 | MIT | Yes |
| react-dom | ^19 | MIT | Yes |
| pixi.js | ^8 | MIT | Yes |
| @playwright/test | ^1 | Apache-2.0 | Yes |
| vite | ^7 | MIT | Yes |
| vitest | ^4 | MIT | Yes |
| typescript | ^5 | Apache-2.0 | Yes |
| tailwindcss | ^4 | MIT | Yes |
| eslint | ^9 | MIT | Yes |

## Audit Steps

1. Run `pnpm licenses list --json` (or equivalent) to capture every
   dependency's declared license.
2. Cross-reference against `contracts/phase42/phase42-constants.json`
   forbidden license list.
3. Flag any package with GPL, AGPL, or LGPL.
4. Verify every package has a license file in its `node_modules` directory.
5. Confirm no dependency has a missing or unparseable license field.

## Sign-Off

- [ ] Full dependency tree audited (production + dev)
- [ ] Zero GPL/AGPL/LGPL dependencies
- [ ] All dependencies have verifiable license files
- [ ] Production-only tree confirmed clean