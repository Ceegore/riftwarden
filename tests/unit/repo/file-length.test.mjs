import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { countPhysicalLines, scanFileLengths } from '../../../tools/file-length/scan.mjs';

function fixture(lines) {
  const root = mkdtempSync(join(tmpdir(), 'riftwarden-length-'));
  for (const directory of ['content/generated', 'public/assets/generated', 'docs/reports/generated']) {
    mkdirSync(join(root, directory), { recursive: true });
    writeFileSync(join(root, directory, 'README.md'), 'GENERATED_DIRECTORY_CONTRACT\n');
  }
  writeFileSync(join(root, 'sample.md'), Array.from({ length: lines }, (_, index) => `line ${index + 1}`).join('\n') + '\n');
  return root;
}

test('physical line counting handles final newline', () => {
  assert.equal(countPhysicalLines(''), 0);
  assert.equal(countPhysicalLines('a'), 1);
  assert.equal(countPhysicalLines('a\n'), 1);
  assert.equal(countPhysicalLines('a\nb'), 2);
});

test('300 lines pass without warning', () => {
  const report = scanFileLengths(fixture(300));
  assert.equal(report.passed, true);
  assert.equal(report.summary.warnings, 0);
});

test('301 and 500 lines warn with exit-compatible pass', () => {
  for (const lines of [301, 500]) {
    const report = scanFileLengths(fixture(lines));
    assert.equal(report.passed, true);
    assert.equal(report.findings.some((entry) => entry.code === 'LENGTH_WARN'), true);
  }
});

test('501 lines block', () => {
  const report = scanFileLengths(fixture(501));
  assert.equal(report.passed, false);
  assert.equal(report.findings.some((entry) => entry.code === 'LENGTH_BLOCK'), true);
});
