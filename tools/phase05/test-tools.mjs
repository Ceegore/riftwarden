import { mkdtemp, cp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const sourceRoot = process.cwd();
const temp = await mkdtemp(path.join(os.tmpdir(), 'riftwarden-phase05-'));
await cp(path.join(sourceRoot, 'reference'), path.join(temp, 'reference'), {
  recursive: true,
});
await cp(path.join(sourceRoot, 'src'), path.join(temp, 'src'), {
  recursive: true,
});
await cp(path.join(sourceRoot, 'tools'), path.join(temp, 'tools'), {
  recursive: true,
});
await mkdir(path.join(temp, 'docs/evidence/phase-05'), { recursive: true });

function run(script, args = []) {
  return spawnSync(process.execPath, [path.join(temp, script), ...args], {
    cwd: temp,
    encoding: 'utf8',
  });
}

const contract = run('tools/phase05/verify-contracts.mjs');
if (contract.status !== 0) throw new Error(contract.stdout || contract.stderr);
const source = run('tools/phase05/verify-source-shape.mjs');
if (source.status !== 0) throw new Error(source.stdout || source.stderr);
const copy = run('tools/phase05/verify-copy-parity.mjs');
if (copy.status !== 0) throw new Error(copy.stdout || copy.stderr);

const blockedEvidence = {
  statusClaim: 'BLOCKED',
  gateG04Verified: false,
  commands: [],
  artifacts: [],
  openP0: 0,
  openP1: 0,
};
await writeFile(
  path.join(temp, 'docs/evidence/phase-05/evidence.json'),
  JSON.stringify(blockedEvidence),
);
const blocked = run('tools/phase05/verify-evidence.mjs');
if (blocked.status === 0) {
  throw new Error('Incomplete evidence incorrectly passed.');
}

const passEvidence = {
  statusClaim: 'PASS',
  gateG04Verified: true,
  browserColdStartVerified: true,
  browserBootFailureVerified: true,
  browserNoWebglVerified: true,
  androidLifecycleVerified: true,
  iosLifecycleVerified: true,
  backgroundZeroActivityVerified: true,
  snapshotBudgetVerified: true,
  diagnosticPrivacyVerified: true,
  screenIdNormalizationResolved: true,
  mainPipelineGreen: true,
  openP0: 0,
  openP1: 0,
  commands: [{ command: 'pnpm verify:g05', exitCode: 0 }],
  artifacts: [{ path: 'docs/reports/phase-05.md', sha256: 'fixture' }],
};
await writeFile(
  path.join(temp, 'docs/evidence/phase-05/evidence.json'),
  JSON.stringify(passEvidence),
);
const passed = run('tools/phase05/verify-evidence.mjs');
if (passed.status !== 0) throw new Error(passed.stdout || passed.stderr);

process.stdout.write(
  `${JSON.stringify({
    ok: true,
    tests: [
      'contracts pass',
      'source shape passes',
      'copy parity passes',
      'incomplete evidence blocks',
      'complete synthetic evidence passes',
    ],
  }, null, 2)}\n`,
);
