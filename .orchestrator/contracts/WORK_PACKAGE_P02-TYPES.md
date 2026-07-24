# WP P02-TYPES — Fix TypeScript strict errors in .mjs tool files

## Goal
The tsconfig.node.json runs checkJs with strict typing on tools/**/*.mjs. There are ~126 TypeScript errors (implicit any params, unused vars, noUncheckedIndexedAccess). Fix ALL of them so `npx tsc -p tsconfig.node.json --noEmit` passes with 0 errors.

## Method
1. Run: `npx tsc -p tsconfig.node.json --noEmit` to see all errors.
2. For each error: add JSDoc type annotations (@param {string} name), fix unused vars (remove or prefix with _), add type guards for index access, etc.
3. Do NOT change runtime behavior. Do NOT weaken tsconfig (skipLibCheck is already true). Do NOT add @ts-ignore or @ts-nocheck.
4. Re-run tsc until 0 errors.

## Files affected
tools/repo/*.mjs, tools/toolchain/*.mjs, tools/file-length/*.mjs, tools/format/*.mjs, tools/env/*.mjs, tools/build/*.mjs, tools/check-file-length.mjs, tools/lint/*.mjs

## Write paths: tools/, tsconfig.node.json
## Commands: run_command('node-validate-types', []), run_command('git-add',['tools/']), run_command('git-commit',['-m','fix(types): strict JSDoc types for tool scripts'])
## Budgets: max_changed_files 30, timeout 1800s, repair rounds 5.
