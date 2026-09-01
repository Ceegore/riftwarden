import test from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditPhase10 } from '../../tools/rules/lib/phase10-readiness.mjs';

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const report = auditPhase10(join(root, 'docs', 'reports', 'content-ledger'));

test('real G10 remains blocked', () => {
  assert.equal(report.status, 'BLOCKED');
});
test('all 408 source slots remain unextracted', () => {
  assert.equal(report.unextracted, 408);
  assert.equal(report.total, 408);
});
test('G10 evidence diagnostic', () => {
  assert.ok(report.diagnostics.some((x) => x.code === 'P11_G10_NOT_PROVEN'));
});
test('NORM-003 diagnostic', () => {
  assert.ok(report.diagnostics.some((x) => x.code === 'P11_NORM_003_OPEN'));
});
