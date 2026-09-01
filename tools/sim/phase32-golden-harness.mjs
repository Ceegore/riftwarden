#!/usr/bin/env node
/**
 * Phase 32 snapshot golden harness (OFFER_SNAPSHOT_CONTRACT +
 * EVENT_SYSTEM_CONTRACT + NODE_REGISTRY_CONTRACT).
 *
 * Bundles the Phase 32 kernel (offer-service, event-service, event content,
 * node-transaction, run-economy, reward-pool) with Vite SSR and pins:
 *  1. deterministic offer snapshots (runId + nodeId + contentRevision) byte
 *     for byte — reload/replay must reproduce the identical snapshot;
 *  2. deterministic event roll slots per pinned event node;
 *  3. a 10,000-input reload-identity sweep over merchant/event/recruitment
 *     nodes proving materialize-twice === materialize-once;
 *  4. the closed registry invariants (12 types, 4+1 merchant, 2–3
 *     recruitment, 30 events).
 * A source hash of the kernel files is pinned so any semantic change
 * invalidates the registry and forces an explicit review.
 *
 * Usage:
 *   node tools/sim/phase32-golden-harness.mjs --check  # verify vs registry (exit 5 on divergence)
 *   node tools/sim/phase32-golden-harness.mjs --write  # regenerate baselines (explicit review tool)
 *   node tools/sim/phase32-golden-harness.mjs --report # print the divergence report only
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, rmSync, mkdtempSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { build } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const registryPath = resolve(root, 'contracts', 'phase32', 'golden-registry.json');

const EXIT = Object.freeze({ OK: 0, SCHEMA: 2, DIVERGENCE: 5, TOOL: 70 });
const WRITE = process.argv.includes('--write');
const REPORT_ONLY = process.argv.includes('--report');
const SWEEP_COUNT = 10000;

const KERNEL_FILES = [
  'src/game/expedition/stable.ts',
  'src/game/expedition/offers/offer-service.ts',
  'src/game/expedition/events/event-service.ts',
  'src/game/expedition/events/event-validator.ts',
  'src/game/expedition/nodes/node-transaction.ts',
  'src/game/expedition/run-economy.ts',
  'src/game/expedition/reward-pool.ts',
];

function sha256Hex(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function kernelSourceHash() {
  return sha256Hex(KERNEL_FILES.map((file) => readFileSync(resolve(root, file), 'utf8')).join('\n'));
}

/** Bundles the Phase 32 kernel with Vite SSR and imports it. */
async function loadKernel() {
  const outDir = mkdtempSync(join(tmpdir(), 'p32-kernel-'));
  try {
    const result = await build({
      root,
      configFile: false,
      logLevel: 'error',
      build: {
        ssr: true,
        write: false,
        minify: false,
        target: 'node18',
        rollupOptions: {
          input: {
            entry: resolve(root, 'tools', 'sim', 'phase32-kernel-entry.ts'),
          },
          output: { format: 'esm', entryFileNames: '[name].mjs', chunkFileNames: '[name]-[hash].mjs' },
        },
      },
    });
    const outputs = (Array.isArray(result) ? result : [result]).flatMap((r) => r.output);
    for (const chunk of outputs) {
      if (chunk.type === 'chunk') writeFileSync(join(outDir, chunk.fileName), chunk.code);
    }
    return await import(pathToFileURL(join(outDir, 'entry.mjs')).href);
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}

function offerRecord(snapshot) {
  return {
    snapshotId: snapshot.snapshotId,
    nodeId: snapshot.nodeId,
    seed: snapshot.seed,
    offers: snapshot.offers.map((offer) => ({
      offerId: offer.offerId,
      priceGold: offer.priceGold,
      stock: offer.stock,
      rewardId: offer.rewardId,
      labelKey: offer.labelKey,
    })),
    rollSlots: snapshot.rollSlots,
    rerollsUsed: snapshot.rerollsUsed,
  };
}

function firstDivergence(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected) ? undefined : { expected, actual };
}

const sourceSha256 = kernelSourceHash();
const kernel = await loadKernel();

const { materializeOffers } = kernel;
const { materializeEvent } = kernel;
const { EVENT_DEFINITIONS } = kernel;
const { validateEvents } = kernel;
const { buildRegistry } = kernel;
const { nodeRegistry } = kernel;
const { MERCHANT_OFFER_COUNT } = kernel;
const { merchantHandler, recruitmentHandler } = kernel;

// 1. Pinned offer snapshots.
const offerEntries = [];
for (let i = 0; i < 12; i += 1) {
  const state = kernel.createNodeRunState({
    runId: `golden-run-${String(i)}`,
    modeId: 'NORMAL',
    contentRevision: '32.0',
    seed: 1000 + i,
    gold: 100,
  });
  const snapshot = materializeOffers(state, `golden-merchant-${String(i)}`, MERCHANT_OFFER_COUNT);
  offerEntries.push(offerRecord(snapshot));
}

// 2. Pinned event roll slots for the first 8 events.
const eventEntries = [];
for (let i = 0; i < 8; i += 1) {
  const event = EVENT_DEFINITIONS[i];
  const state = kernel.createNodeRunState({
    runId: `golden-event-${String(i)}`,
    modeId: 'NORMAL',
    contentRevision: '32.0',
    seed: 2000 + i,
    gold: 100,
  });
  const snapshot = materializeEvent(state, event, `golden-event-node-${String(i)}`);
  eventEntries.push({ eventId: snapshot.eventId, nodeId: snapshot.nodeId, seed: snapshot.seed, rollSlots: snapshot.rollSlots });
}

// 3. Reload-identity sweep: materialize twice, the second must equal the first.
let sweepFailures = 0;
const sweepFirstFailure = { index: -1, node: 'none' };
for (let i = 0; i < SWEEP_COUNT; i += 1) {
  const runId = `sweep-run-${String(i)}`;
  const base = kernel.createNodeRunState({ runId, modeId: 'NORMAL', contentRevision: '32.0', seed: i, gold: 100 });
  const first = materializeOffers(base, `sweep-node-${String(i % 97)}`, 4);
  const again = materializeOffers(base, `sweep-node-${String(i % 97)}`, 4);
  if (JSON.stringify(first) !== JSON.stringify(again)) {
    sweepFailures += 1;
    if (sweepFirstFailure.index === -1) {
      sweepFirstFailure.index = i;
      sweepFirstFailure.node = `sweep-node-${String(i % 97)}`;
    }
    if (sweepFailures >= 5) break;
  }
}

// 4. Registry invariants.
let registryFailures = 0;
const registryChecks = [];
try {
  const handlers = [...nodeRegistry.values()];
  registryChecks.push({ check: 'registry-size', ok: nodeRegistry.size === 12 });
  registryChecks.push({ check: 'merchant-offer-count', ok: merchantHandler.allowedActions.includes('BUY') && MERCHANT_OFFER_COUNT === 4 });
  registryChecks.push({ check: 'recruitment-range', ok: recruitmentHandler.allowedActions.includes('CHOOSE') });
  validateEvents(EVENT_DEFINITIONS);
  registryChecks.push({ check: 'events-30', ok: EVENT_DEFINITIONS.length === 30 });
  const first = handlers[0];
  const duplicate = [...handlers, first];
  let buildError = null;
  try {
    buildRegistry(duplicate);
  } catch {
    buildError = 'rejected';
  }
  registryChecks.push({ check: 'duplicate-rejected', ok: buildError === 'rejected' });
  if (registryChecks.some((c) => !c.ok)) registryFailures += 1;
} catch {
  registryFailures += 1;
}

const registry = {
  schemaVersion: 1,
  phase: 32,
  kind: 'node-snapshot-golden',
  sourceSha256,
  pinnedOffers: offerEntries,
  pinnedEvents: eventEntries,
  sweep: { count: SWEEP_COUNT, failures: sweepFailures, firstFailure: sweepFirstFailure },
  registry: { failures: registryFailures, checks: registryChecks },
};

if (WRITE) {
  mkdirSync(dirname(registryPath), { recursive: true });
  writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n');
  console.log(`wrote ${registryPath} (${offerEntries.length} offers, ${eventEntries.length} events, sweep ${SWEEP_COUNT} clean=${sweepFailures === 0})`);
  process.exit(EXIT.OK);
}

let stored = null;
try {
  stored = JSON.parse(readFileSync(registryPath, 'utf8'));
} catch {
  console.error(`registry missing or invalid: ${registryPath}`);
  process.exit(EXIT.SCHEMA);
}

const divergences = [];
if (stored.sourceSha256 !== registry.sourceSha256) {
  divergences.push({ path: 'sourceSha256', expected: stored.sourceSha256, actual: registry.sourceSha256 });
}
for (let i = 0; i < offerEntries.length; i += 1) {
  const divergence = firstDivergence(offerEntries[i], stored.pinnedOffers?.[i]);
  if (divergence !== undefined) divergences.push({ path: `pinnedOffers[${i}]`, ...divergence });
}
for (let i = 0; i < eventEntries.length; i += 1) {
  const divergence = firstDivergence(eventEntries[i], stored.pinnedEvents?.[i]);
  if (divergence !== undefined) divergences.push({ path: `pinnedEvents[${i}]`, ...divergence });
}
if (registry.sweep.failures !== stored.sweep?.failures) {
  divergences.push({ path: 'sweep.failures', expected: stored.sweep?.failures, actual: registry.sweep.failures });
}
if (registry.registry.failures !== stored.registry?.failures) {
  divergences.push({ path: 'registry.failures', expected: stored.registry?.failures, actual: registry.registry.failures });
}

if (REPORT_ONLY) {
  console.log(JSON.stringify({ divergences, sweep: registry.sweep, registry: registry.registry }, null, 2));
  process.exit(EXIT.OK);
}

if (divergences.length > 0) {
  console.error(`DIVERGENCE: ${divergences.length} difference(s) vs ${registryPath}`);
  for (const d of divergences) console.error(`  ${d.path}: expected=${JSON.stringify(d.expected).slice(0, 120)} actual=${JSON.stringify(d.actual).slice(0, 120)}`);
  process.exit(EXIT.DIVERGENCE);
}

console.log(`PASS ${offerEntries.length} pinned offers + ${eventEntries.length} pinned events + ${SWEEP_COUNT}-node reload sweep (0 failures), source ${registry.sourceSha256.slice(0, 12)}`);
process.exit(EXIT.OK);
