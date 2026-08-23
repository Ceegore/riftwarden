#!/usr/bin/env node
/**
 * Phase 32 headless expedition runner — generates maps, walks every node
 * through the handler pipeline, collects outcomes, and produces a
 * statistics ledger across configurable runs. Uses Vite SSR to bundle the
 * real kernel (never a synthetic stand-in). Every run is deterministic:
 * same seed → same gold trail, same events, same loot.
 *
 * Usage:
 *   node tools/sim/phase32-headless-runner.mjs [--runs N] [--seed BASE] [--write out.json]
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { build } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');

const RUNS = Number(process.argv[process.argv.indexOf('--runs') + 1] || '500');
const BASE_SEED = Number(process.argv[process.argv.indexOf('--seed') + 1] || '100000');
const WRITE_IDX = process.argv.indexOf('--write');
const WRITE_FLAG = WRITE_IDX !== -1;
const LEDGER_PATH = (WRITE_IDX !== -1 && process.argv[WRITE_IDX + 1] && !process.argv[WRITE_IDX + 1].startsWith('--'))
  ? process.argv[WRITE_IDX + 1]
  : join(root, 'contracts', 'phase32', 'headless-runner-ledger.json');

const EXIT = Object.freeze({ OK: 0, BUILD: 70, RUNTIME: 3 });

const FALLBACK_PROFILE = {
  id: 'headless.v1',
  logicalLevels: 6,
  targetVisited: [5, 8],
  mandatoryRoles: ['anchor', 'preparation', 'boss'],
  attemptCap: 50,
  fallbackTemplateId: 'fallback.v1',
};

const CONTENT_REVISION = '32.0';
const START_GOLD = 100;

async function loadKernel() {
  const outDir = mkdtempSync(join(tmpdir(), 'p32-headless-'));
  try {
    const result = await build({
      root,
      configFile: false,
      logLevel: 'error',
      build: {
        ssr: true, write: false, minify: false, target: 'node18',
        rollupOptions: {
          input: { entry: resolve(root, 'tools', 'sim', 'phase32-kernel-entry.ts') },
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

const kernel = await loadKernel();
const { generateMap, createExpedition, mainPath, encodeExpeditionSave, restoreExpeditionSave } = kernel;

/**
 * Builds the deterministic primary action for the current runner position,
 * then dispatches it through ExpeditionRunner.act. Returns the updated
 * runner and transaction id, or the unchanged runner when no second action
 * is needed (an anchor with no unsecured loot).
 */
function dispatchPrimaryAction(expedition, seed) {
  const { state, currentNodeId: nodeId, definition: def } = expedition;
  let request;
  const snapshot = state.snapshots[nodeId];

  switch (def.type) {
    case 'battle':
    case 'elite':
    case 'boss':
      request = { transactionId: `hdl-battle-${String(seed)}-${nodeId}`, nodeId, action: 'ENGAGE' };
      break;
    case 'event': {
      const firstOption = snapshot?.kind === 'EVENT' ? snapshot.options.find((o) => o.available)?.optionId : undefined;
      request = firstOption !== undefined
        ? { transactionId: `hdl-event-${String(seed)}-${nodeId}`, nodeId, action: 'CONFIRM', optionId: firstOption }
        : { transactionId: `hdl-event-${String(seed)}-${nodeId}`, nodeId, action: 'DECLINE' };
      break;
    }
    case 'merchant': {
      const offer = snapshot?.kind === 'OFFERS' ? snapshot.offers[0] : undefined;
      request = offer !== undefined && state.gold >= offer.priceGold
        ? { transactionId: `hdl-merchant-${String(seed)}-${nodeId}`, nodeId, action: 'BUY', optionId: offer.offerId }
        : { transactionId: `hdl-merchant-${String(seed)}-${nodeId}`, nodeId, action: 'DECLINE' };
      break;
    }
    case 'recruitment': {
      const offer = snapshot?.kind === 'OFFERS' ? snapshot.offers[0] : undefined;
      request = offer !== undefined
        ? { transactionId: `hdl-recruit-${String(seed)}-${nodeId}`, nodeId, action: 'CHOOSE', optionId: offer.offerId }
        : { transactionId: `hdl-recruit-${String(seed)}-${nodeId}`, nodeId, action: 'DECLINE' };
      break;
    }
    case 'treasure':
      request = { transactionId: `hdl-treasure-${String(seed)}-${nodeId}`, nodeId, action: 'TAKE' };
      break;
    case 'workshop':
      request = state.gold >= 220
        ? { transactionId: `hdl-workshop-${String(seed)}-${nodeId}`, nodeId, action: 'POLISH' }
        : { transactionId: `hdl-workshop-${String(seed)}-${nodeId}`, nodeId, action: 'DECLINE' };
      break;
    case 'altar':
      request = state.instability + 10 <= 100
        ? { transactionId: `hdl-altar-${String(seed)}-${nodeId}`, nodeId, action: 'ACCEPT' }
        : { transactionId: `hdl-altar-${String(seed)}-${nodeId}`, nodeId, action: 'DECLINE' };
      break;
    case 'scout':
      request = { transactionId: `hdl-scout-${String(seed)}-${nodeId}`, nodeId, action: 'REVEAL_PATH' };
      break;
    case 'anchor':
      if (state.unsecuredLoot.length === 0) return { expedition, transactionId: undefined };
      request = { transactionId: `hdl-anchor-${String(seed)}-${nodeId}`, nodeId, action: 'SECURE' };
      break;
    case 'story':
      request = { transactionId: `hdl-story-${String(seed)}-${nodeId}`, nodeId, action: 'CONTINUE' };
      break;
    default:
      return { expedition, transactionId: undefined };
  }

  return { expedition: expedition.act(request), transactionId: request.transactionId };
}

/** @type {{ schemaVersion: number, phase: number, kind: string, timestamp: string, config: any, summary: any, runs: any[] }} */
const ledger = {
  schemaVersion: 1,
  phase: 32,
  kind: 'headless-runner-ledger',
  timestamp: new Date().toISOString(),
  config: { runs: RUNS, seedBase: BASE_SEED, contentRevision: CONTENT_REVISION, startGold: START_GOLD },
  summary: {
    started: 0, completed: 0, failures: 0, totalNodesVisited: 0, fallbackCount: 0,
    saveRestores: 0, saveFailures: 0, restoreFailures: 0, stateMismatches: 0,
  },
  runs: [],
};

const nodeTypeStats = {};
let goldSum = 0;
let goldCount = 0;
let instabilitySum = 0;

for (let runIndex = 0; runIndex < RUNS; runIndex += 1) {
  const seed = BASE_SEED + runIndex;
  const input = { seed, profileId: 'headless.v1', contentRevision: CONTENT_REVISION };
  const map = generateMap(input, FALLBACK_PROFILE);

  let expedition = createExpedition(map, { startGold: START_GOLD });
  const path = mainPath(map);
  const runLog = {
    seed, profileId: map.profileId, fallback: map.usedFallback, nodeCount: path.length,
    nodes: /** @type {any[]} */ ([]), finalGold: 0, finalInstability: 0,
    saveRestore: /** @type {any} */ (undefined),
  };

  const midPoint = Math.floor(path.length / 2);
  let runFailed = false;
  let saveRestoreOk = true;
  for (let nodeIndex = 0; nodeIndex < path.length; nodeIndex += 1) {
    const nodeId = path[nodeIndex];
    if (nodeId === undefined) { runFailed = true; break; }
    try {
      if (expedition.currentNodeId !== nodeId) {
        expedition = expedition.advance(nodeId);
      }

      // Phase 1: ENTER (instability applies, snapshot materialized)
      const enterTxId = `hdl-e-${String(seed)}-${nodeId}`;
      expedition = expedition.enter(enterTxId);
      const enter = expedition.state.ledger[enterTxId];
      if (enter === undefined) throw new Error(`missing enter receipt: ${enterTxId}`);
      const type = expedition.definition.type;
      nodeTypeStats[type] = (nodeTypeStats[type] || 0) + 1;

      // Phase 2: primary node-type action (if any)
      const action = dispatchPrimaryAction(expedition, seed);
      expedition = action.expedition;
      const actResult = action.transactionId === undefined ? undefined : expedition.state.ledger[action.transactionId];
      if (action.transactionId !== undefined && actResult === undefined) {
        throw new Error(`missing action receipt: ${action.transactionId}`);
      }

      // Phase 3: RESOLVE
      expedition = expedition.resolve();
      const state = expedition.state;

      runLog.nodes.push({
        nodeId, type,
        enterStatus: enter.status,
        actionStatus: actResult ? actResult.status : 'SKIPPED',
        action: actResult ? actResult.action : 'NONE',
        gold: state.gold, instability: state.instability,
      });

      // Mid-expedition save/restore cycle: validates the save codec end-to-end.
      if (nodeIndex === midPoint) {
        ledger.summary.saveRestores += 1;
        const preGold = expedition.state.gold;
        const preInstability = expedition.state.instability;
        const preLedgerKeys = Object.keys(expedition.state.ledger).length;
        let serialized;
        try {
          serialized = encodeExpeditionSave(expedition);
        } catch {
          ledger.summary.saveFailures += 1;
          saveRestoreOk = false;
          runFailed = true;
          break;
        }
        let restored;
        try {
          restored = restoreExpeditionSave(serialized, map);
        } catch {
          ledger.summary.restoreFailures += 1;
          saveRestoreOk = false;
          runFailed = true;
          break;
        }
        if (
          restored.state.gold !== preGold ||
          restored.state.instability !== preInstability ||
          Object.keys(restored.state.ledger).length !== preLedgerKeys
        ) {
          ledger.summary.stateMismatches += 1;
          saveRestoreOk = false;
          runFailed = true;
          break;
        }
        expedition = restored;
      }
    } catch (e) {
      runFailed = true;
      break;
    }
  }

  const state = expedition.state;
  goldSum += state.gold;
  goldCount += 1;
  instabilitySum += state.instability;
  runLog.finalGold = state.gold;
  runLog.finalInstability = state.instability;
  if (midPoint < path.length) {
    runLog.saveRestore = { midNode: path[midPoint], ok: saveRestoreOk };
  }
  ledger.runs.push(runLog);

  if (runFailed) {
    ledger.summary.failures += 1;
  } else {
    ledger.summary.completed += 1;
    ledger.summary.totalNodesVisited += path.length;
  }
  if (map.usedFallback) ledger.summary.fallbackCount += 1;
  ledger.summary.started = runIndex + 1;
}

ledger.summary.avgGold = goldCount > 0 ? Math.round((goldSum / goldCount) * 10) / 10 : 0;
ledger.summary.avgInstability = goldCount > 0 ? Math.round((instabilitySum / goldCount) * 10) / 10 : 0;
ledger.summary.nodeTypeCounts = nodeTypeStats;

if (WRITE_FLAG) {
  writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2) + '\n');
  console.log(`wrote ${LEDGER_PATH}`);
}

const summary = ledger.summary;
const pct = summary.started > 0 ? Math.round((summary.completed / summary.started) * 1000) / 10 : 0;
console.log([
  `PHASE32 HEADLESS RUNNER: ${summary.started} runs, ${summary.completed} completed (${pct}%), ${summary.failures} failures`,
  `  nodes visited: ${summary.totalNodesVisited}, avg gold: ${summary.avgGold}, avg instability: ${summary.avgInstability}`,
  `  fallbacks: ${summary.fallbackCount}, node types: ${JSON.stringify(nodeTypeStats)}`,
  `  save/restore: ${summary.saveRestores} cycles, ${summary.saveFailures} save fails, ${summary.restoreFailures} restore fails, ${summary.stateMismatches} state mismatches`,
].join('\n'));

process.exit(summary.failures > 0 ? EXIT.RUNTIME : EXIT.OK);
