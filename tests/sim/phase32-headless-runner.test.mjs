import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, mkdtempSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import test from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const runner = resolve(root, 'tools', 'sim', 'phase32-headless-runner.mjs');

function runLedger(seed, runs, outputPath) {
  const stdout = execFileSync(process.execPath, [runner, '--runs', String(runs), '--seed', String(seed), '--write', outputPath], {
    cwd: root,
    encoding: 'utf8',
    timeout: 180_000,
  });
  assert.match(stdout, new RegExp(`PHASE32 HEADLESS RUNNER: ${runs} runs, ${runs} completed`));
  assert.ok(existsSync(outputPath), 'headless ledger was not written');
  return JSON.parse(readFileSync(outputPath, 'utf8'));
}

test('phase32 headless runner persists a completed ExpeditionRunner ledger', () => {
  const dir = mkdtempSync(join(tmpdir(), 'p32-headless-test-'));
  try {
    const ledger = runLedger(620000, 12, join(dir, 'ledger.json'));
    assert.equal(ledger.phase, 32);
    assert.equal(ledger.kind, 'headless-runner-ledger');
    assert.equal(ledger.summary.started, 12);
    assert.equal(ledger.summary.completed, 12);
    assert.equal(ledger.summary.failures, 0);
    assert.equal(ledger.runs.length, 12);
    assert.ok(ledger.runs.every((run) => run.nodes.length === run.nodeCount));
    assert.ok(ledger.runs.every((run) => run.nodes.every((node) => node.enterStatus === 'COMMITTED')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('phase32 headless runner is repeatable for the same seed and count', () => {
  const dir = mkdtempSync(join(tmpdir(), 'p32-headless-repeat-'));
  try {
    const first = runLedger(620100, 8, join(dir, 'first.json'));
    const second = runLedger(620100, 8, join(dir, 'second.json'));
    assert.deepEqual(
      { config: first.config, summary: first.summary, runs: first.runs },
      { config: second.config, summary: second.summary, runs: second.runs },
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
