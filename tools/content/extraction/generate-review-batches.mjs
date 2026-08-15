#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from '../../lib/fs-utils.mjs';
import { loadLedgers } from './lib/load-ledgers.mjs';

const args = parseArgs(process.argv.slice(2));
const batchSize = Number(args.batchSize ?? args._?.[0] ?? 12);
if (!Number.isInteger(batchSize) || batchSize < 8 || batchSize > 15) {
  throw new Error('Batch size must be an integer between 8 and 15.');
}

const indexDir = path.resolve('docs/reports/content-ledger');
const { ledgers } = await loadLedgers(indexDir);
const slots = ledgers
  .flatMap((ledger) => ledger.data.entries.map((entry) => ({ family: ledger.family, ...entry })))
  .filter((entry) => entry.status === 'UNEXTRACTED')
  .sort((a, b) => a.family.localeCompare(b.family) || a.slotId.localeCompare(b.slotId));

// Greedy chunking: close a batch at `batchSize` slots, never exceeding two
// families per batch (slots are family-ordered, so batches stay single-family
// except when a short remainder absorbs the start of the next family).
const batches = [];
let current = [];
let families = new Set();
for (const slot of slots) {
  if (current.length >= batchSize) {
    batches.push(current);
    current = [];
    families = new Set();
  }
  if (families.size >= 2 && !families.has(slot.family)) {
    batches.push(current);
    current = [];
    families = new Set();
  }
  current.push(slot);
  families.add(slot.family);
}
if (current.length) batches.push(current);

// Rebalance: any batch smaller than 8 must grow. Merge with a neighbor when the
// combined size stays <= 15 and families stay <= 2; otherwise steal from the
// adjacent same-family batch while it keeps >= 8 slots.
for (let i = 0; i < batches.length; i += 1) {
  if (batches[i].length >= 8) continue;
  const merged = tryMerge(batches, i, 15);
  if (merged) { i -= 1; continue; }
  for (const neighbor of [i - 1, i + 1]) {
    if (neighbor < 0 || neighbor >= batches.length) continue;
    const deficit = 8 - batches[i].length;
    if (batches[neighbor].length - deficit >= 8) {
      const stolen = batches[neighbor].splice(batches[neighbor].length - deficit, deficit);
      batches[i] = [...stolen, ...batches[i]];
      break;
    }
  }
}

function tryMerge(batches, index, maxSize) {
  const current = batches[index];
  for (const neighbor of [index - 1, index + 1]) {
    if (neighbor < 0 || neighbor >= batches.length) continue;
    const other = batches[neighbor];
    const combined = [...current, ...other];
    const familyCount = new Set(combined.map((s) => s.family)).size;
    if (combined.length <= maxSize && familyCount <= 2) {
      batches.splice(index, 1);
      if (neighbor < index) {
        batches.splice(neighbor, 1, combined);
      } else {
        batches.splice(neighbor, 1, combined);
      }
      return true;
    }
  }
  return false;
}

const output = {
  schemaVersion: 1,
  batchSize,
  batches: batches.map((batch, i) => ({
    batchId: `batch-${String(i + 1).padStart(3, '0')}`,
    families: [...new Set(batch.map((s) => s.family))].sort(),
    slots: batch.map((s) => s.slotId)
  })),
  counts: { batches: batches.length, slots: slots.length }
};
await mkdir(indexDir, { recursive: true });
const outFile = path.join(indexDir, 'review-batches.json');
await writeFile(outFile, `${JSON.stringify(output, null, 2)}\n`);
console.log(outFile);
