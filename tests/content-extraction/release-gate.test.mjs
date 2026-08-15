import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLedgers } from '../../tools/content/extraction/lib/load-ledgers.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const releaseCli = path.resolve('tools/content/extraction/validate-release.mjs');
const batchesCli = path.resolve('tools/content/extraction/generate-review-batches.mjs');

async function withTempLedger(mutate, fn) {
  const dir = await mkdtemp(path.join(tmpdir(), 'rw-ledger-'));
  try {
    const { index, ledgers } = await loadLedgers();
    mutate?.(index, ledgers);
    await writeFile(path.join(dir, 'content-ledger.index.json'), JSON.stringify(index, null, 2));
    for (const ledger of ledgers) {
      await writeFile(path.join(dir, ledger.family + '.ledger.json'), JSON.stringify(ledger.data, null, 2));
    }
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function reviewed(entry, n) {
  return {
    ...entry,
    status: 'REVIEWED',
    runtimeId: `rw_${entry.slotId.replace(':', '_').toLowerCase()}`,
    extractor: n % 2 === 0 ? 'extractor-a' : 'extractor-b',
    extractedAt: '2026-08-15T00:00:00Z',
    sourceOutputPath: `content/source/${entry.slotId.split(':')[0]}/${entry.slotId.replace(':', '-')}.json`,
    review: { reviewer: n % 2 === 0 ? 'reviewer-b' : 'reviewer-a', reviewedAt: '2026-08-16T00:00:00Z', verdict: 'APPROVED', defectIds: [] },
    fidelity: {
      numericFacts: ['120', '1.5', '35%'],
      textFactsSha256: 'a'.repeat(64),
      secondsConversion: 'CENTRAL_COMPILER_ONLY'
    },
    localization: { deKey: `x.de.${entry.slotId}`, enKey: `x.en.${entry.slotId}`, enStatus: 'DRAFT' }
  };
}

test('release gate PASSES when every slot is independently REVIEWED', async () => {
  await withTempLedger((index, ledgers) => {
    let n = 0;
    for (const ledger of ledgers) {
      ledger.data.entries = ledger.data.entries.map((e) => reviewed(e, n++));
    }
  }, async (dir) => {
    const run = spawnSync(process.execPath, [releaseCli, '--index-dir', dir], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stdout + run.stderr);
    const report = JSON.parse(run.stdout);
    assert.equal(report.status, 'PASS');
    assert.equal(report.totals.reviewed, 408);
    assert.deepEqual(report.diagnostics, []);
  });
});

test('REVIEWED slot missing DE/EN keys blocks with P10_LOCALIZATION_KEY', async () => {
  await withTempLedger((index, ledgers) => {
    let n = 0;
    for (const ledger of ledgers) {
      ledger.data.entries = ledger.data.entries.map((e) => reviewed(e, n++));
    }
    ledgers[0].data.entries[0].localization.deKey = null;
  }, async (dir) => {
    const run = spawnSync(process.execPath, [releaseCli, '--index-dir', dir], { encoding: 'utf8' });
    const report = JSON.parse(run.stdout);
    assert.equal(report.diagnostics.some((d) => d.code === 'P10_LOCALIZATION_KEY'), true);
  });
});

test('REVIEWED slot with EN at NOT_STARTED blocks with P10_EN_STATUS', async () => {
  await withTempLedger((index, ledgers) => {
    let n = 0;
    for (const ledger of ledgers) {
      ledger.data.entries = ledger.data.entries.map((e) => reviewed(e, n++));
    }
    ledgers[0].data.entries[0].localization.enStatus = 'NOT_STARTED';
  }, async (dir) => {
    const run = spawnSync(process.execPath, [releaseCli, '--index-dir', dir], { encoding: 'utf8' });
    const report = JSON.parse(run.stdout);
    assert.equal(report.diagnostics.some((d) => d.code === 'P10_EN_STATUS'), true);
  });
});

test('REVIEWED slot with self-review blocks with P10_REVIEW_NOT_INDEPENDENT', async () => {
  await withTempLedger((index, ledgers) => {
    let n = 0;
    for (const ledger of ledgers) {
      ledger.data.entries = ledger.data.entries.map((e) => reviewed(e, n++));
    }
    const first = ledgers[0].data.entries[0];
    first.review = { ...first.review, reviewer: first.extractor };
  }, async (dir) => {
    const run = spawnSync(process.execPath, [releaseCli, '--index-dir', dir], { encoding: 'utf8' });
    const report = JSON.parse(run.stdout);
    assert.equal(report.diagnostics.some((d) => d.code === 'P10_REVIEW_NOT_INDEPENDENT'), true);
  });
});

test('asset requirement below owner phase 10 blocks with P10_ASSET_OWNER', async () => {
  await withTempLedger((index, ledgers) => {
    let n = 0;
    for (const ledger of ledgers) {
      ledger.data.entries = ledger.data.entries.map((e) => reviewed(e, n++));
    }
    ledgers[0].data.entries[0].assetRequirements = [{ id: 'a1', kind: 'visual', status: 'PLANNED', ownerPhase: 9, path: null, sha256: null }];
  }, async (dir) => {
    const run = spawnSync(process.execPath, [releaseCli, '--index-dir', dir], { encoding: 'utf8' });
    const report = JSON.parse(run.stdout);
    assert.equal(report.diagnostics.some((d) => d.code === 'P10_ASSET_OWNER'), true);
  });
});

test('PRESENT_VERIFIED asset without path/hash blocks with P10_REQUIRED_ASSET_MISSING', async () => {
  await withTempLedger((index, ledgers) => {
    let n = 0;
    for (const ledger of ledgers) {
      ledger.data.entries = ledger.data.entries.map((e) => reviewed(e, n++));
    }
    ledgers[0].data.entries[0].assetRequirements = [{ id: 'a1', kind: 'visual', status: 'PRESENT_VERIFIED', ownerPhase: 10, path: null, sha256: null }];
  }, async (dir) => {
    const run = spawnSync(process.execPath, [releaseCli, '--index-dir', dir], { encoding: 'utf8' });
    const report = JSON.parse(run.stdout);
    assert.equal(report.diagnostics.some((d) => d.code === 'P10_REQUIRED_ASSET_MISSING'), true);
  });
});

test('REVIEWED slot without fidelity evidence blocks with P10_FIDELITY_TEXT', async () => {
  await withTempLedger((index, ledgers) => {
    let n = 0;
    for (const ledger of ledgers) {
      ledger.data.entries = ledger.data.entries.map((e) => reviewed(e, n++));
    }
    ledgers[0].data.entries[0].fidelity = { numericFacts: null, textFactsSha256: null, secondsConversion: 'CENTRAL_COMPILER_ONLY' };
  }, async (dir) => {
    const run = spawnSync(process.execPath, [releaseCli, '--index-dir', dir], { encoding: 'utf8' });
    const report = JSON.parse(run.stdout);
    assert.equal(report.diagnostics.some((d) => d.code === 'P10_FIDELITY_TEXT'), true);
  });
});

test('REVIEWED slot without source output path blocks with P10_LEDGER_SHAPE', async () => {
  await withTempLedger((index, ledgers) => {
    let n = 0;
    for (const ledger of ledgers) {
      ledger.data.entries = ledger.data.entries.map((e) => reviewed(e, n++));
    }
    ledgers[0].data.entries[0].sourceOutputPath = null;
  }, async (dir) => {
    const run = spawnSync(process.execPath, [releaseCli, '--index-dir', dir], { encoding: 'utf8' });
    const report = JSON.parse(run.stdout);
    assert.equal(report.diagnostics.some((d) => d.code === 'P10_LEDGER_SHAPE'), true);
  });
});

async function makeSyntheticLedgers(familyCounts) {
  const dir = await mkdtemp(path.join(tmpdir(), 'rw-synth-'));
  const index = {
    schemaVersion: 1,
    authorityFile: 'inputs/sources/GDD_V5_PHASE10_AUTHORITY_EXTRACT.md',
    authoritySha256: 'bd66585dcd836f77a511e64e579d48b7925f2985be19c12662635d9811994e73',
    families: Object.entries(familyCounts).map(([family, expectedCount]) => ({
      family, category: 'gateCritical', expectedCount, file: `${family}.ledger.json`
    }))
  };
  await writeFile(path.join(dir, 'content-ledger.index.json'), JSON.stringify(index, null, 2));
  for (const [family, count] of Object.entries(familyCounts)) {
    const entries = Array.from({ length: count }, (_, i) => ({
      slotId: `${family}:${String(i + 1).padStart(3, '0')}`,
      authorityLabel: `${family} slot ${i + 1}`,
      sourceLocator: { file: 'inputs/sources/GDD_V5_PHASE10_AUTHORITY_EXTRACT.md', chapter: '11.1', lineStart: 259, lineEnd: 259, lineSha256: 'x'.repeat(64) },
      runtimeId: null,
      status: 'UNEXTRACTED',
      review: { reviewer: null, reviewedAt: null, verdict: 'PENDING', defectIds: [] },
      fidelity: { numericFacts: null, textFactsSha256: null, secondsConversion: 'CENTRAL_COMPILER_ONLY' },
      localization: { deKey: null, enKey: null, enStatus: 'NOT_STARTED' },
      assetRequirements: []
    }));
    await writeFile(path.join(dir, `${family}.ledger.json`), JSON.stringify({ schemaVersion: 1, family, category: 'gateCritical', expectedCount: count, entries }, null, 2));
  }
  return dir;
}

const REAL_DIST = { a: 36, b: 10, c: 7, d: 4, e: 8, f: 28, g: 6, h: 12, i: 28, j: 42, k: 30, l: 10, m: 50, n: 4, o: 20, p: 18, q: 36, r: 4, s: 15, t: 14, u: 8, v: 18 };

async function runBatches(dist, size) {
  const dir = await makeSyntheticLedgers(dist);
  try {
    const run = spawnSync(process.execPath, [batchesCli, '--index-dir', dir, '--batch-size', String(size)], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    return JSON.parse(readFileSync(path.join(dir, 'review-batches.json'), 'utf8'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function assertComplete(out, dist, size) {
  const total = Object.values(dist).reduce((s, n) => s + n, 0);
  assert.equal(out.counts.slots, total, `size ${size}`);
  const all = out.batches.flatMap((b) => b.slots);
  assert.equal(new Set(all).size, all.length, `duplicate slots at size ${size}`);
}

test('review batches stay strict (8-15 slots, <=2 families) for achievable distributions', async () => {
  const strictDistributions = [REAL_DIST, { a: 7, b: 7, c: 7, d: 7, e: 7, f: 7 }, { a: 4, b: 4, c: 4, d: 4, e: 4, f: 4, g: 4, h: 4 }, { a: 15, b: 15, c: 15, d: 15, e: 15 }];
  for (const dist of strictDistributions) {
    for (const size of [8, 9, 10, 11, 12, 13, 14, 15]) {
      const out = await runBatches(dist, size);
      assert.equal(out.batches.every((b) => b.slots.length >= 8 && b.slots.length <= 15 && b.families.length <= 2), true, `size ${size} dist ${JSON.stringify(dist)}`);
      assertComplete(out, dist, size);
    }
  }
});

test('review batches never lose or duplicate slots even for pathological tiny families', async () => {
  // With eleven single-slot families a strict two-family split is impossible;
  // the hard guarantees are complete coverage, no duplicates and the 15 cap.
  const dist = { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1, g: 1, h: 1, i: 1, j: 1, k: 1 };
  for (const size of [8, 9, 10, 11, 12, 13, 14, 15]) {
    const out = await runBatches(dist, size);
    assert.equal(out.batches.every((b) => b.slots.length <= 15), true, `size ${size}`);
    assertComplete(out, dist, size);
  }
});

test('review batches are deterministic across runs', async () => {
  const dir = await makeSyntheticLedgers({ a: 36, b: 10, c: 7, d: 4, e: 8, f: 28, g: 6 });
  try {
    spawnSync(process.execPath, [batchesCli, '--index-dir', dir, '--batch-size', '12'], { encoding: 'utf8' });
    const first = readFileSync(path.join(dir, 'review-batches.json'), 'utf8');
    spawnSync(process.execPath, [batchesCli, '--index-dir', dir, '--batch-size', '12'], { encoding: 'utf8' });
    const second = readFileSync(path.join(dir, 'review-batches.json'), 'utf8');
    assert.equal(second, first);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
