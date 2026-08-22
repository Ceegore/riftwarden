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
const { generateMap, createExpeditionRun, definitionOf, handlerForNode, dispatchEnterNode, dispatchCommit, dispatchResolve } = kernel;

/**
 * Walk the main path from startNode: follow non-side-branch edges forward.
 * Side-branch nodes have 's' in the id after the level digit (e.g. n1s0_...).
 */
function walkMainPath(map) {
  const mainPath = [];
  let cur = map.startNodeId;
  const visited = new Set();
  while (cur && !visited.has(cur)) {
    visited.add(cur);
    mainPath.push(cur);
    const edges = map.edges.filter((e) => e.from === cur);
    const forwardEdge = edges.find((e) => !e.to.includes('s') && e.from !== e.to);
    cur = forwardEdge ? forwardEdge.to : undefined;
  }
  return mainPath;
}

/**
 * Dispatches the primary node-type-specific action after ENTER has been
 * handled by dispatchEnterNode. Every decision is deterministic (seeded).
 * Returns null if the node type doesn't need a second action (anchor/story
 * when ENTER is sufficient).
 */
function dispatchPrimaryAction(kernel, state, nodeId, def, handler, seed) {
  const { dispatchCommit } = kernel;
  let s = seed ^ nodeId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const rand = () => { s = ((s * 1103515245 + 12345) >>> 0); return s; };

  switch (def.type) {
    case 'battle':
    case 'elite':
    case 'boss': {
      rand();
      return dispatchCommit(state, { transactionId: `hdl-battle-${String(seed)}-${nodeId}`, nodeId, action: 'ENGAGE' }, def, handler);
    }
    case 'event': {
      rand();
      const snap = state.snapshots[nodeId];
      const firstOption = snap?.kind === 'EVENT' ? snap.options.find((o) => o.available)?.optionId : undefined;
      if (firstOption !== undefined) {
        return dispatchCommit(state, { transactionId: `hdl-event-${String(seed)}-${nodeId}`, nodeId, action: 'CONFIRM', optionId: firstOption }, def, handler);
      }
      return dispatchCommit(state, { transactionId: `hdl-event-${String(seed)}-${nodeId}`, nodeId, action: 'DECLINE' }, def, handler);
    }
    case 'merchant': {
      rand();
      const snap = state.snapshots[nodeId];
      const offer = snap?.kind === 'OFFERS' ? snap.offers[0] : undefined;
      if (offer !== undefined && state.gold >= offer.priceGold) {
        return dispatchCommit(state, { transactionId: `hdl-merchant-${String(seed)}-${nodeId}`, nodeId, action: 'BUY', optionId: offer.offerId }, def, handler);
      }
      return dispatchCommit(state, { transactionId: `hdl-merchant-${String(seed)}-${nodeId}`, nodeId, action: 'DECLINE' }, def, handler);
    }
    case 'recruitment': {
      rand();
      const snap = state.snapshots[nodeId];
      const offer = snap?.kind === 'OFFERS' ? snap.offers[0] : undefined;
      if (offer !== undefined) {
        return dispatchCommit(state, { transactionId: `hdl-recruit-${String(seed)}-${nodeId}`, nodeId, action: 'CHOOSE', optionId: offer.offerId }, def, handler);
      }
      return dispatchCommit(state, { transactionId: `hdl-recruit-${String(seed)}-${nodeId}`, nodeId, action: 'DECLINE' }, def, handler);
    }
    case 'treasure': {
      rand();
      return dispatchCommit(state, { transactionId: `hdl-treasure-${String(seed)}-${nodeId}`, nodeId, action: 'TAKE' }, def, handler);
    }
    case 'workshop': {
      rand();
      if (state.gold >= 220) {
        return dispatchCommit(state, { transactionId: `hdl-workshop-${String(seed)}-${nodeId}`, nodeId, action: 'POLISH' }, def, handler);
      }
      return dispatchCommit(state, { transactionId: `hdl-workshop-${String(seed)}-${nodeId}`, nodeId, action: 'DECLINE' }, def, handler);
    }
    case 'altar': {
      rand();
      if (state.instability + 10 <= 100) {
        return dispatchCommit(state, { transactionId: `hdl-altar-${String(seed)}-${nodeId}`, nodeId, action: 'ACCEPT' }, def, handler);
      }
      return dispatchCommit(state, { transactionId: `hdl-altar-${String(seed)}-${nodeId}`, nodeId, action: 'DECLINE' }, def, handler);
    }
    case 'scout': {
      rand();
      return dispatchCommit(state, { transactionId: `hdl-scout-${String(seed)}-${nodeId}`, nodeId, action: 'REVEAL_PATH' }, def, handler);
    }
    case 'anchor': {
      // ENTER already done by dispatchEnterNode. SECURE any unsecured loot.
      if (state.unsecuredLoot.length > 0) {
        return dispatchCommit(state, { transactionId: `hdl-anchor-${String(seed)}-${nodeId}`, nodeId, action: 'SECURE' }, def, handler);
      }
      return null; // nothing more to do
    }
    case 'story': {
      // ENTER already done. CONTINUE advances the story.
      return dispatchCommit(state, { transactionId: `hdl-story-${String(seed)}-${nodeId}`, nodeId, action: 'CONTINUE' }, def, handler);
    }
    default:
      return null;
  }
}

/** @type {{ schemaVersion: number, phase: number, kind: string, timestamp: string, config: any, summary: any, runs: any[] }} */
const ledger = {
  schemaVersion: 1,
  phase: 32,
  kind: 'headless-runner-ledger',
  timestamp: new Date().toISOString(),
  config: { runs: RUNS, seedBase: BASE_SEED, contentRevision: CONTENT_REVISION, startGold: START_GOLD },
  summary: { started: 0, completed: 0, failures: 0, totalNodesVisited: 0, fallbackCount: 0 },
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

  let state = createExpeditionRun(map, START_GOLD);
  const mainPath = walkMainPath(map);
  const runLog = {
    seed, profileId: map.profileId, fallback: map.usedFallback, nodeCount: mainPath.length,
    nodes: /** @type {any[]} */ ([]), finalGold: 0, finalInstability: 0,
  };

  let runFailed = false;
  for (const nodeId of mainPath) {
    const def = definitionOf(map, nodeId);
    const handler = handlerForNode(def.type);

    nodeTypeStats[def.type] = (nodeTypeStats[def.type] || 0) + 1;

    try {
      // Phase 1: ENTER (instability applies, snapshot materialized)
      const enterTxId = `hdl-e-${String(seed)}-${nodeId}`;
      const enter = dispatchEnterNode(state, nodeId, def, handler, enterTxId);
      state = enter.state;

      // Phase 2: primary node-type action (if any)
      const actResult = dispatchPrimaryAction(kernel, state, nodeId, def, handler, seed);
      if (actResult !== null) {
        state = actResult.state;
      }

      // Phase 3: RESOLVE
      state = dispatchResolve(state, nodeId);

      runLog.nodes.push({
        nodeId, type: def.type,
        enterStatus: enter.outcome.result.status,
        actionStatus: actResult ? actResult.result.status : 'SKIPPED',
        action: actResult ? actResult.result.action : 'NONE',
        gold: state.gold, instability: state.instability,
      });
    } catch (e) {
      runFailed = true;
      break;
    }
  }

  goldSum += state.gold;
  goldCount += 1;
  instabilitySum += state.instability;
  runLog.finalGold = state.gold;
  runLog.finalInstability = state.instability;
  ledger.runs.push(runLog);

  if (runFailed) {
    ledger.summary.failures += 1;
  } else {
    ledger.summary.completed += 1;
    ledger.summary.totalNodesVisited += mainPath.length;
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
].join('\n'));

process.exit(summary.failures > 0 ? EXIT.RUNTIME : EXIT.OK);
