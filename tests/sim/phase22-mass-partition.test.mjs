import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateHash, mergeCases, partitionCaseIndices } from '../../tools/sim/lib/mass-partition.mjs';

test('P22-T05: partition covers every case exactly once across workers', () => {
  const total = 1000;
  const workers = 4;
  const parts = Array.from({ length: workers }, (_, w) => partitionCaseIndices(total, workers, w));
  const union = parts.flat().sort((a, b) => a - b);
  assert.deepEqual(union, Array.from({ length: total }, (_, i) => i));
});

test('P22-T05: partition is stable and worker-count independent', () => {
  const a = partitionCaseIndices(1000, 2, 0);
  const b = partitionCaseIndices(1000, 2, 0);
  assert.deepEqual(a, b);
  const four = [0, 1, 2, 3].flatMap((w) => partitionCaseIndices(1000, 4, w)).sort((x, y) => x - y);
  const two = [0, 1].flatMap((w) => partitionCaseIndices(1000, 2, w)).sort((x, y) => x - y);
  assert.deepEqual(four, two);
});

test('P22-T05: rejects invalid worker/index arguments', () => {
  assert.throws(() => partitionCaseIndices(10, 0, 0), /P22_PARTITION_WORKERS_INVALID/);
  assert.throws(() => partitionCaseIndices(10, 2, 2), /P22_PARTITION_INDEX_INVALID/);
  assert.throws(() => partitionCaseIndices(-1, 2, 0), /P22_PARTITION_TOTAL_INVALID/);
});

test('P22-T05: mergeCases sorts strictly ascending and detects duplicates', () => {
  const partA = [{ caseIndex: 2, outcome: 'ACTIVE', endTick: 60, endHash: 'b', invariantCount: 0 }];
  const partB = [{ caseIndex: 0, outcome: 'ACTIVE', endTick: 60, endHash: 'a', invariantCount: 0 }];
  const partC = [{ caseIndex: 1, outcome: 'ACTIVE', endTick: 60, endHash: 'c', invariantCount: 0 }];
  const merged = mergeCases([partA, partB, partC]);
  assert.deepEqual(merged.map((r) => r.caseIndex), [0, 1, 2]);
  assert.throws(() => mergeCases([partA, partA]), /P22_MERGE_DUPLICATE_CASE/);
});

test('P22-T05: aggregate hash is deterministic and order-sensitive', () => {
  const cases = [
    { caseIndex: 0, outcome: 'ACTIVE', endTick: 60, endHash: 'a', invariantCount: 0 },
    { caseIndex: 1, outcome: 'ACTIVE', endTick: 60, endHash: 'b', invariantCount: 0 },
  ];
  assert.equal(aggregateHash(cases), aggregateHash(cases));
  assert.notEqual(aggregateHash(cases), aggregateHash([...cases].reverse()));
});
