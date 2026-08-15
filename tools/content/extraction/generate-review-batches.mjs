#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from '../../lib/fs-utils.mjs';
import { loadLedgers } from './lib/load-ledgers.mjs';

const args = parseArgs(process.argv.slice(2));
const batchSize = Number(args['batch-size'] ?? args.batchSize ?? args._?.[0] ?? 12);
if (!Number.isInteger(batchSize) || batchSize < 8 || batchSize > 15) {
  throw new Error('Batch size must be an integer between 8 and 15.');
}

const indexDir = path.resolve(args['index-dir'] ?? args.indexDir ?? 'docs/reports/content-ledger');
const { ledgers } = await loadLedgers(indexDir);

// Slots ordered deterministically (family, then slotId).
const slots = ledgers
  .flatMap((ledger) => ledger.data.entries.map((entry) => ({ family: ledger.family, ...entry })))
  .filter((entry) => entry.status === 'UNEXTRACTED')
  .sort((a, b) => a.family.localeCompare(b.family) || a.slotId.localeCompare(b.slotId));
const familyBlocks = [];
for (let i = 0; i < slots.length;) {
  const start = i;
  while (i < slots.length && slots[i].family === slots[start].family) i += 1;
  familyBlocks.push(slots.slice(start, i));
}

// Family-granular greedy. Each family leaves a single-family remainder (1..7
// slots) that the next family fills to exactly 8; full chunks are exactly
// `batchSize`. Every batch therefore lands in 8..15 slots with at most two
// families, except when many tiny families force a soft three-family carry.
const batches = [];
let current = [];
for (const block of familyBlocks) {
  let remaining = block;
  if (current.length > 0) {
    const need = 8 - current.length;
    if (need <= 0) {
      // Already valid (or soft-carried past 8): close it and process the
      // family fresh. Never slice with a negative index — that drops slots.
      batches.push(current);
      current = [];
    } else if (need <= remaining.length) {
      current.push(...remaining.slice(0, need));
      remaining = remaining.slice(need);
      batches.push(current);
      current = [];
    } else {
      // Family too small to complete the batch: pull the shortfall from the
      // previous family's last chunk so the batch still reaches 8 with exactly
      // two families. The previous chunk may drop below 8; the rebalance pass
      // below always repairs it by merging with the just-completed 8-batch
      // (combined <= 15 and at most two families). Soft-carry only when the
      // previous chunk cannot give up the full shortfall.
      const deficit = need - remaining.length;
      const prev = batches[batches.length - 1];
      if (prev && prev.length > deficit) {
        current.push(...prev.splice(prev.length - deficit, deficit));
      }
      current.push(...remaining);
      remaining = [];
    }
  }
  if (remaining.length === 0) continue;
  const full = Math.floor(remaining.length / batchSize);
  for (let k = 0; k < full; k += 1) batches.push(remaining.slice(k * batchSize, (k + 1) * batchSize));
  const remainder = remaining.slice(full * batchSize);
  if (remainder.length >= 8) batches.push(remainder);
  else current = remainder;
}
if (current.length) batches.push(current);

// Rebalance: any batch smaller than 8 must grow. Merge with a neighbor when the
// combined size stays <= 15 and families stay <= 2; otherwise steal from the
// adjacent same-family batch while it keeps >= 8 slots.
for (let i = 0; i < batches.length; i += 1) {
  if (batches[i].length >= 8) continue;
  if (tryMerge(batches, i, 15)) { i -= 1; continue; }
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
  const currentBatch = batches[index];
  for (const neighbor of [index - 1, index + 1]) {
    if (neighbor < 0 || neighbor >= batches.length) continue;
    const other = batches[neighbor];
    const combined = [...currentBatch, ...other].sort((a, b) => a.slotId.localeCompare(b.slotId));
    const familyCount = new Set(combined.map((s) => s.family)).size;
    if (combined.length <= maxSize && familyCount <= 2) {
      // Remove the neighbor first, then replace the current batch. Removing the
      // current batch first would shift indices and corrupt the neighbor slot.
      batches.splice(neighbor, 1);
      batches.splice(neighbor < index ? index - 1 : index, 1, combined);
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
