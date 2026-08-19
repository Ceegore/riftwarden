#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const contractPath = join(root, 'contracts', 'phase24', 'phase24-readiness.expected.json');

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

if (!existsSync(contractPath)) {
  console.log(JSON.stringify({ schemaVersion: 1, phase: 24, gate: 'G24', status: 'BLOCKED', blockers: ['P24_G24_NOT_REPRODUCED'], errors: ['phase24-readiness contract missing'] }, null, 2));
  process.exit(2);
}

const contract = readJson(contractPath);
const blockers = [];
const satisfied = [];

function checkModule(key, pathKey, detailKey, detail) {
  const path = join(root, contract.evidence[key][pathKey]);
  if (!existsSync(path)) blockers.push(`P24_G24_${key.toUpperCase()}_MISSING`);
  else satisfied.push({ id: key, [detailKey]: detail });
}

// 1. Schemas: settings/profile/run decoders + fixture.
const schemaOk = ['settings', 'profile', 'run'].every((kind) => existsSync(join(root, contract.evidence.schemas[kind])));
const schemaFixture = readJson(join(root, contract.evidence.schemas.fixture));
if (!schemaOk || !schemaFixture?.valid?.length || !schemaFixture?.invalid?.length) {
  blockers.push('P24_G24_SCHEMAS_MISSING');
} else {
  satisfied.push({ id: 'schemas', kinds: 3, valid: schemaFixture.valid.length, invalid: schemaFixture.invalid.length });
}

// 2. Migrations: registry + edges + fixture.
const migrationOk = existsSync(join(root, contract.evidence.migrations.path)) && existsSync(join(root, contract.evidence.migrations.edges));
const migrationFixture = readJson(join(root, contract.evidence.migrations.fixture));
if (!migrationOk || !migrationFixture?.cases?.length) blockers.push('P24_G24_MIGRATIONS_MISSING');
else satisfied.push({ id: 'migrations', cases: migrationFixture.cases.length });

// 3. Commit matrix: save service + coordinator + fixture.
const commitOk = existsSync(join(root, contract.evidence.commitMatrix.path)) && existsSync(join(root, contract.evidence.commitMatrix.coordinator));
const commitFixture = readJson(join(root, contract.evidence.commitMatrix.fixture));
if (!commitOk || !commitFixture?.reasons?.length) blockers.push('P24_G24_COMMIT_MATRIX_MISSING');
else satisfied.push({ id: 'commitMatrix', reasons: commitFixture.reasons.length });

// 4. Battle resume: module + 150-tick interval + golden fixture.
const resumeOk = existsSync(join(root, contract.evidence.battleResume.path));
const resumeFixture = readJson(join(root, contract.evidence.battleResume.fixture));
if (!resumeOk || resumeFixture?.id !== 'golden_save_301') blockers.push('P24_G24_BATTLE_RESUME_MISSING');
else satisfied.push({ id: 'battleResume', intervalTicks: contract.evidence.battleResume.intervalTicks });

// 5. Transfer: policy + quarantine + limits + malicious corpus.
const transferOk =
  existsSync(join(root, contract.evidence.transfer.path)) && existsSync(join(root, contract.evidence.transfer.quarantine));
const transferFixture = readJson(join(root, contract.evidence.transfer.fixture));
if (!transferOk || !transferFixture?.cases?.length) blockers.push('P24_G24_TRANSFER_MISSING');
else satisfied.push({ id: 'transfer', maxTotalBytes: contract.evidence.transfer.maxTotalBytes, maxEntryBytes: contract.evidence.transfer.maxEntryBytes, cases: transferFixture.cases.length });

// 6. Recovery + diagnostics.
const recoveryOk =
  existsSync(join(root, contract.evidence.recovery.path)) && existsSync(join(root, contract.evidence.recovery.diagnostics));
const recoveryFixture = readJson(join(root, contract.evidence.recovery.fixture));
if (!recoveryOk || !recoveryFixture?.rows?.length) blockers.push('P24_G24_RECOVERY_MISSING');
else satisfied.push({ id: 'recovery', rows: recoveryFixture.rows.length });

// 7. Test suites.
const testsOk =
  existsSync(join(root, contract.evidence.tests.schemaMigration)) && existsSync(join(root, contract.evidence.tests.serviceTransferRecovery));
if (!testsOk) blockers.push('P24_G24_TESTS_MISSING');
else satisfied.push({ id: 'tests', suites: 2 });

// 8. Operator-side evidence (never machine self-certifiable).
for (const code of contract.hardBlockers) {
  if (!blockers.includes(code)) blockers.push(code);
}

const report = {
  schemaVersion: 1,
  phase: 24,
  gate: 'G24',
  status: blockers.length ? 'BLOCKED' : 'PASS',
  blockers,
  satisfied,
};
console.log(JSON.stringify(report, null, 2));
const operatorCodes = new Set(contract.hardBlockers);
process.exitCode = blockers.filter((code) => !operatorCodes.has(code)).length ? 1 : 0;
