import { GOLDEN_ENTRIES, SCENARIOS, goldenSeedWords, sessionFromSeed } from './scenario-registry.mjs';

/** Runs all twelve golden vectors and returns their Node reference hashes. */
export function runNodePhase22GoldenTrace(api) {
  const { battleKernel, snapshot } = api;
  const input = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });
  const vectors = {};
  for (const entry of GOLDEN_ENTRIES) {
    const scenario = SCENARIOS[entry.scenario];
    const seed = goldenSeedWords(entry.id);
    let state = scenario.build(api, seed);
    const startHash = snapshot.createSnapshot(state).checksum;
    const random = sessionFromSeed(api, seed);
    const systems = scenario.systems(api);
    const checkpoints = [];
    let terminal = false;
    let outcome = null;
    for (let i = 0; i < entry.capTicks; i++) {
      const step = battleKernel.stepBattle({ state, input, random, rules: {}, content: {}, systems });
      state = step.state;
      if (step.checkpoint) checkpoints.push({ tick: state.tick, checksum: step.checkpoint.checksum });
      if (['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(state.phase?.phase)) {
        terminal = true;
        outcome = state.phase.phase;
        break;
      }
    }
    vectors[entry.id] = {
      scenario: entry.scenario,
      startHash,
      checkpoints,
      endTick: state.tick,
      endHash: snapshot.createSnapshot(state).checksum,
      endReason: state.endReason,
      eventCount: state.emittedEventCount,
      outcome,
      terminal,
      exitCode: 0,
    };
  }
  return vectors;
}
