import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const run = (args, cwd) => spawnSync(process.execPath, args, { cwd: cwd ?? root, encoding: 'utf8' });

test('phase13 readiness expected contract lists all six blockers', () => {
  const expected = JSON.parse(readFileSync(join(root, 'contracts', 'sim', 'phase13-readiness.expected.json'), 'utf8'));
  assert.equal(expected.expectedBlockers.length, 6);
  assert.ok(expected.expectedBlockers.includes('P14_G13_NOT_PROVEN'));
  assert.ok(expected.expectedBlockers.includes('P14_CROSSRUNTIME_EVIDENCE_MISSING'));
});

test('readiness gate truthfully BLOCKs with the expected blockers', () => {
  const res = run(['tools/sim/validate-phase13-readiness.mjs']);
  const report = JSON.parse(res.stdout);
  assert.equal(report.status, 'BLOCKED');
  assert.ok(report.blockers.includes('P14_G13_NOT_PROVEN'));
  assert.equal(res.status, 2);
});

test('kernel import audit flags UI and wallclock in a synthetic tree', () => {
  const d = mkdtempSync(join(tmpdir(), 'p14-'));
  mkdirSync(join(d, 'src', 'game', 'sim', 'core'), { recursive: true });
  writeFileSync(join(d, 'src', 'game', 'sim', 'core', 'ok.ts'), 'export const ok = 1;\n');
  writeFileSync(join(d, 'src', 'game', 'sim', 'core', 'bad.ts'), "import { h } from 'react';\nconst t = Date.now();\nconst r = Math.random();\n");
  const res = run(['tools/sim/audit-kernel-imports.mjs', d]);
  const report = JSON.parse(res.stdout);
  assert.equal(report.status, 'BLOCKED');
  assert.ok(report.findings.some((x) => x.kind === 'ui-native-import'));
  assert.ok(report.findings.some((x) => x.kind === 'wallclock'));
  assert.ok(report.findings.some((x) => x.kind === 'random-access'));
  assert.equal(res.status, 2);
});

test('kernel import audit passes on the clean src tree', () => {
  const res = run(['tools/sim/audit-kernel-imports.mjs', '.']);
  const report = JSON.parse(res.stdout);
  assert.equal(report.status, 'PASS');
  assert.deepEqual(report.findings, []);
});

test('crossruntime matrix pins Node against the reference trace and leaves devices NOT_RUN', () => {
  const d = mkdtempSync(join(tmpdir(), 'p14-cr-'));
  const res = run(['tools/sim/generate-crossruntime-matrix.mjs', join(d, 'matrix.json')]);
  assert.equal(res.status, 0, res.stderr);
  const matrix = JSON.parse(readFileSync(join(d, 'matrix.json'), 'utf8'));
  const fixture = JSON.parse(readFileSync(join(root, 'tests', 'sim', 'fixtures', 'reference-traces.json'), 'utf8'));
  assert.equal(matrix.runtimes.node.tick30, fixture.checkpoints.find((c) => c.tick === 30).checksum);
  assert.equal(matrix.runtimes.node.tick60, fixture.checkpoints.find((c) => c.tick === 60).checksum);
  assert.equal(matrix.runtimes.node.endHash, fixture.finalSnapshotChecksum);
  assert.equal(matrix.status, 'PARTIAL');
  for (const key of ['chromium', 'firefox', 'webkit', 'android_webview', 'ios_wkwebview']) {
    assert.equal(matrix.runtimes[key].status, 'NOT_RUN');
  }
  // Phase 15 movement trace column is also pinned against its fixture.
  const fixture15 = JSON.parse(readFileSync(join(root, 'tests', 'sim', 'fixtures', 'reference-traces-phase15.json'), 'utf8'));
  assert.equal(matrix.phase15.runtimes.node.tick30, fixture15.checkpoints.find((c) => c.tick === 30).checksum);
  assert.equal(matrix.phase15.runtimes.node.tick60, fixture15.checkpoints.find((c) => c.tick === 60).checksum);
  assert.equal(matrix.phase15.runtimes.node.endHash, fixture15.finalSnapshotChecksum);
  for (const key of ['chromium', 'firefox', 'webkit']) {
    assert.equal(matrix.phase15.runtimes[key].status, 'NOT_RUN');
  }
  // Phase 16 targeting/attack-prep column is pinned against its fixture too.
  const fixture16 = JSON.parse(readFileSync(join(root, 'tests', 'sim', 'fixtures', 'reference-traces-phase16.json'), 'utf8'));
  assert.equal(matrix.phase16.runtimes.node.tick30, fixture16.checkpoints.find((c) => c.tick === 30).checksum);
  assert.equal(matrix.phase16.runtimes.node.tick60, fixture16.checkpoints.find((c) => c.tick === 60).checksum);
  assert.equal(matrix.phase16.runtimes.node.endHash, fixture16.finalSnapshotChecksum);
  for (const key of ['chromium', 'firefox', 'webkit']) {
    assert.equal(matrix.phase16.runtimes[key].status, 'NOT_RUN');
  }
  // Phase 17 basic-attack/projectile/damage column is pinned against its fixture.
  const fixture17 = JSON.parse(readFileSync(join(root, 'tests', 'sim', 'fixtures', 'reference-traces-phase17.json'), 'utf8'));
  assert.equal(matrix.phase17.runtimes.node.tick30, fixture17.checkpoints.find((c) => c.tick === 30).checksum);
  assert.equal(matrix.phase17.runtimes.node.tick60, fixture17.checkpoints.find((c) => c.tick === 60).checksum);
  assert.equal(matrix.phase17.runtimes.node.endHash, fixture17.finalSnapshotChecksum);
  for (const key of ['chromium', 'firefox', 'webkit']) {
    assert.equal(matrix.phase17.runtimes[key].status, 'NOT_RUN');
  }
  // Phase 17 stage J/L column (defeat + collapse + battle-end) is pinned too.
  const fixture17jl = JSON.parse(readFileSync(join(root, 'tests', 'sim', 'fixtures', 'reference-traces-phase17jl.json'), 'utf8'));
  assert.equal(matrix.phase17jl.runtimes.node.tick30, fixture17jl.checkpoints.find((c) => c.tick === 2700).checksum);
  assert.equal(matrix.phase17jl.runtimes.node.tick60, fixture17jl.checkpoints.find((c) => c.tick === 2880).checksum);
  assert.equal(matrix.phase17jl.runtimes.node.endHash, fixture17jl.finalSnapshotChecksum);
  assert.equal(matrix.phase17jl.runtimes.node.terminal, true);
  for (const key of ['chromium', 'firefox', 'webkit']) {
    assert.equal(matrix.phase17jl.runtimes[key].status, 'NOT_RUN');
  }
  // Phase 18 status periodic/expiry column is pinned against its fixture too.
  const fixture18 = JSON.parse(readFileSync(join(root, 'tests', 'sim', 'fixtures', 'reference-traces-phase18.json'), 'utf8'));
  assert.equal(matrix.phase18.runtimes.node.tick30, fixture18.checkpoints.find((c) => c.tick === 30).checksum);
  assert.equal(matrix.phase18.runtimes.node.tick60, fixture18.checkpoints.find((c) => c.tick === 60).checksum);
  assert.equal(matrix.phase18.runtimes.node.endHash, fixture18.finalSnapshotChecksum);
  for (const key of ['chromium', 'firefox', 'webkit']) {
    assert.equal(matrix.phase18.runtimes[key].status, 'NOT_RUN');
  }
});

test('mass-sim harness reports PASS with no drift and accumulates events across battles', () => {
  const d = mkdtempSync(join(tmpdir(), 'p14-mass-'));
  const res = run(['tools/sim/run-mass-sim.mjs', '--battles', '5', '--out', join(d, 'mass.json')]);
  assert.equal(res.status, 0, res.stderr);
  const report = JSON.parse(readFileSync(join(d, 'mass.json'), 'utf8'));
  assert.equal(report.status, 'PASS');
  assert.equal(report.invariantErrors, 0);
  assert.equal(report.hashDrift, 0);
  assert.equal(report.totalEvents, 5 * 60);
  assert.equal(report.totalTicks, 5 * 60);
  assert.ok(report.tickLatencyMs.max >= report.tickLatencyMs.median);
});

test('phase15 mass-sim evidence (spawn + separation active) is PASS with pinned hash', () => {
  const report = JSON.parse(readFileSync(join(root, 'docs', 'reports', 'phase15-mass-sim.json'), 'utf8'));
  assert.equal(report.status, 'PASS');
  assert.equal(report.invariantErrors, 0);
  assert.equal(report.hashDrift, 0);
  assert.equal(report.battles, 10000);
  assert.equal(report.totalTicks, 600000);
  assert.equal(report.mode, 'phase15-spawn-separation');
  assert.match(report.referenceFinalHash, /^[0-9a-f]{64}$/);
  assert.ok(report.endHeapBytes <= report.peakHeapBytes, 'heap must not grow unbounded');
});

test('phase16 mass-sim evidence (targeting + attack-prep active) is PASS with pinned hash', () => {
  const report = JSON.parse(readFileSync(join(root, 'docs', 'reports', 'phase16-mass-sim.json'), 'utf8'));
  assert.equal(report.status, 'PASS');
  assert.equal(report.invariantErrors, 0);
  assert.equal(report.hashDrift, 0);
  assert.equal(report.battles, 10000);
  assert.equal(report.totalTicks, 600000);
  assert.equal(report.mode, 'phase16-targeting-attackprep');
  assert.match(report.referenceFinalHash, /^[0-9a-f]{64}$/);
  assert.ok(report.endHeapBytes <= report.peakHeapBytes, 'heap must not grow unbounded');
});

test('phase17 mass-sim evidence (basic-attack + projectile active) is PASS with pinned hash', () => {
  const report = JSON.parse(readFileSync(join(root, 'docs', 'reports', 'phase17-mass-sim.json'), 'utf8'));
  assert.equal(report.status, 'PASS');
  assert.equal(report.invariantErrors, 0);
  assert.equal(report.hashDrift, 0);
  assert.equal(report.battles, 10000);
  assert.equal(report.totalTicks, 600000);
  assert.equal(report.mode, 'phase17-basicattack-projectile');
  assert.match(report.referenceFinalHash, /^[0-9a-f]{64}$/);
  assert.ok(report.endHeapBytes <= report.peakHeapBytes, 'heap must not grow unbounded');
});

test('content-driven battle launcher derives objectives via the adapter and resolves every encounter', () => {
  const d = mkdtempSync(join(tmpdir(), 'p21-content-launch-'));
  const res = run(['tools/sim/run-content-encounters.mjs', '--out', join(d, 'content-encounters.json')]);
  assert.equal(res.status, 0, res.stderr);
  const report = JSON.parse(readFileSync(join(d, 'content-encounters.json'), 'utf8'));
  assert.equal(report.status, 'PASS');
  assert.equal(report.invariantErrors, 0);
  assert.equal(report.drift, 0);
  assert.equal(report.seededFailures, 0);
  assert.equal(report.encounters, 9);
  const byId = report.perEncounter;
  for (const key of ['encounter_fixture_first', 'encounter_fixture_survive', 'encounter_fixture_waves', 'encounter_fixture_boss_object', 'encounter_fixture_protect_object', 'encounter_fixture_boss_duo', 'encounter_fixture_wave_boss', 'encounter_fixture_heal_sustain', 'encounter_fixture_sustain_collapse']) {
    assert.equal(byId[key].status, 'PASS', key);
    assert.equal(byId[key].objectivesSeeded, true, key);
    assert.equal(byId[key].bossObjectsPlaced, true, key);
    assert.equal(byId[key].drift, false, key);
  }
  // The content-derived mission kinds land in the battle exactly as derived.
  assert.equal(byId['encounter_fixture_first'].objective, 'defeat_all');
  assert.equal(byId['encounter_fixture_survive'].objective, 'survive');
  assert.equal(byId['encounter_fixture_waves'].objective, 'complete_waves');
  assert.equal(byId['encounter_fixture_boss_object'].objective, 'defeat_boss');
  assert.equal(byId['encounter_fixture_boss_duo'].objective, 'defeat_boss');
  assert.equal(byId['encounter_fixture_protect_object'].objective, 'protect_object');
  // §7/§8 wiring: modifiers are committed and declared waves enter the cursor.
  for (const key of ['encounter_fixture_first', 'encounter_fixture_survive', 'encounter_fixture_waves', 'encounter_fixture_boss_object', 'encounter_fixture_protect_object', 'encounter_fixture_boss_duo', 'encounter_fixture_wave_boss']) {
    assert.equal(byId[key].modifiersCommitted, true, key);
    assert.equal(byId[key].wavesSpawned, true, key);
  }
  // §8: every mission objective must actually complete (the gate is strict).
  for (const key of ['encounter_fixture_first', 'encounter_fixture_survive', 'encounter_fixture_waves', 'encounter_fixture_boss_object', 'encounter_fixture_protect_object', 'encounter_fixture_boss_duo', 'encounter_fixture_wave_boss', 'encounter_fixture_heal_sustain']) {
    assert.equal(byId[key].objectivesComplete, true, key);
  }
  // §9.5 objective-bounty teeth: every encounter discloses its objective
  // bounty (defeat_all 5, survive/waves/heal 10, defeat_boss 15, protect
  // ranked per-object) and the victory Bounty paid equals it for every
  // single-objective mission (never pays LESS than disclosed).
  for (const key of ['encounter_fixture_first', 'encounter_fixture_survive', 'encounter_fixture_waves', 'encounter_fixture_boss_object', 'encounter_fixture_boss_duo', 'encounter_fixture_wave_boss', 'encounter_fixture_heal_sustain', 'encounter_fixture_sustain_collapse']) {
    assert.ok(typeof byId[key].objectiveBounty === 'number', `${key} report discloses objectiveBounty`);
    assert.ok(typeof byId[key].victoryBounty === 'number', `${key} report carries victoryBounty`);
    if (byId[key].objectivesComplete) assert.ok(byId[key].victoryBounty >= byId[key].objectiveBounty, `${key} pays >= what it discloses`);
  }
  assert.equal(byId['encounter_fixture_first'].objectiveBounty, 5, 'defeat_all bounty 5');
  assert.equal(byId['encounter_fixture_boss_object'].objectiveBounty, 15, 'defeat_boss bounty 15');
  assert.equal(byId['encounter_fixture_wave_boss'].objectiveBounty, 15, 'content boss bounty 15');
  assert.equal(byId['encounter_fixture_heal_sustain'].objectiveBounty, 10, 'heal_sustain bounty 10');
  assert.equal(byId['encounter_fixture_heal_sustain'].victoryBounty, 10, 'heal_sustain victory pays 10');
  assert.equal(byId['encounter_fixture_sustain_collapse'].objectiveBounty, 10, 'collapse sustain discloses 10');
  // §10 sustain × collapse TIPPING teeth: the 80000-requirement encounter is
  // NOT bankable by the pre-window grind, so it loses IN the window — the
  // content soft-limit override (softLimitSeconds 60 → 1800 ticks) opens the
  // collapse window early, the halved heal rate (150→75 observed) turns the
  // player's net intake negative and the collapse damage kills them
  // (DEFEAT side_eliminated). The win side of the boundary stays the
  // 1000-requirement encounter (VICTORY, banked pre-window).
  const collapseEntry = byId['encounter_fixture_sustain_collapse'];
  assert.equal(collapseEntry.sustainCollapseTeeth, true);
  assert.equal(collapseEntry.terminal.phase, 'DEFEAT');
  assert.equal(collapseEntry.terminal.reason, 'side_eliminated');
  assert.equal(collapseEntry.windowOpened, true);
  assert.equal(collapseEntry.halvingObserved, true);
  assert.equal(collapseEntry.inWindowDeath, true);
  assert.equal(collapseEntry.objectivesComplete, false);
  assert.ok(collapseEntry.counterAtDeath < collapseEntry.requirement, 'the requirement is NOT bankable');
  assert.equal(collapseEntry.softLimitTicks, 1800, 'the content soft-limit override (60s → 1800 ticks) drives the window');
  assert.ok(collapseEntry.ticks > 1800 && collapseEntry.ticks < 2250, 'the death lands inside the overridden §10 window');
  // §8.3 sustain POLICY pass: every heal_sustain encounter's contract is
  // validated at launch time (positive requirement, positive composite heal
  // scale, a damageable target) — both sustain encounters must be clean.
  for (const key of ['encounter_fixture_heal_sustain', 'encounter_fixture_sustain_collapse']) {
    assert.deepEqual(byId[key].sustainPolicy, [], `${key} sustain policy is clean`);
    assert.equal(byId[key].status, 'PASS', key);
  }
  // The survive window must actually elapse: terminal is VICTORY survive_complete.
  assert.equal(byId['encounter_fixture_survive'].terminal.reason, 'survive_complete');
  assert.equal(byId['encounter_fixture_survive'].terminal.phase, 'VICTORY');
  // The waves mission ends VICTORY waves_complete the tick all waves spawned
  // (the waves window drives resolution, never a late elimination end).
  assert.equal(byId['encounter_fixture_waves'].terminal.reason, 'waves_complete');
  assert.equal(byId['encounter_fixture_waves'].terminal.phase, 'VICTORY');
  // protect_object teeth: the enemy destroys the protected body → forced DEFEAT.
  assert.equal(byId['encounter_fixture_protect_object'].teeth, true);
  // §9 boss-phase teeth: content phases drive a real p1→p2→p3 descent across
  // the boss's HP (a Lamport-style phase commit on each boundary).
  assert.equal(byId['encounter_fixture_boss_object'].phasesDescended, true);
  // §9 outbound surface: the report exposes the modifier hook log and the boss
  // phase at the terminal, and the teeth run leaves a full phase trace.
  // The main-run boss actually descends (defeat_boss kills the boss), so the
  // surfaced phase must be a real phase with a consistent visited trail.
  const bossPhase = byId['encounter_fixture_boss_object'].bossPhase;
  assert.equal(typeof bossPhase, 'object');
  assert.ok(['phase_ash_1', 'phase_ash_2', 'phase_ash_3'].includes(bossPhase.phaseId));
  assert.equal(typeof bossPhase.transition, 'boolean');
  assert.ok(bossPhase.visited.length >= 2, 'multiple visited phases in the main-run descent');
  assert.equal(typeof bossPhase.visited[0], 'string');
  assert.ok(Array.isArray(byId['encounter_fixture_boss_object'].phaseTrace));
  assert.ok(byId['encounter_fixture_first'].hooks.length > 0, 'non-empty hook log surfaced');
  assert.equal(byId['encounter_fixture_first'].bossPhase, null);
  for (const event of byId['encounter_fixture_boss_object'].phaseTrace) {
    assert.match(event[0], /^(PhaseTransitionPlanned|BossPhaseStarted|BossPhaseCompleted|BossTelegraphStarted)$/);
    assert.equal(typeof event[1], 'number');
  }
  // §10 multi-boss: the duo encounter seeds a SECOND boss-phase authority and
  // its teeth run descends BOTH bosses interleaved in one battle.
  const duoPhase = byId['encounter_fixture_boss_duo'].bossPhase;
  assert.equal(typeof duoPhase, 'object');
  // The main run seeds BOTH authorities and both genuinely descend (the
  // secondary reaches q2 as unit_p eliminates the enemy side).
  const duoSecondary = byId['encounter_fixture_boss_duo'].bossPhaseSecondary;
  assert.equal(typeof duoSecondary, 'object');
  assert.ok(['phase_duo_q1', 'phase_duo_q2'].includes(duoSecondary.phaseId));
  assert.equal(typeof duoSecondary.transition, 'boolean');
  assert.ok(duoSecondary.visited.length >= 1);
  assert.equal(byId['encounter_fixture_boss_duo'].multiBossDescended, true);
  // §10 real-combat teeth: BOTH bosses descend under REAL applied combat damage
  // (no HP re-seeding) in one interleaved battle.
  assert.equal(byId['encounter_fixture_boss_duo'].multiBossRealCombat, true);
  const duoTraceBosses = new Set(byId['encounter_fixture_boss_duo'].phaseTrace.map((event) => event[2].split('/')[0]));
  assert.ok(duoTraceBosses.has('boss_ash_unit'));
  assert.ok(duoTraceBosses.has('boss_ember_unit'));
  // §8/§10 content-driven wave×boss teeth: the wave-boss encounter runs BOTH
  // reinforcement waves AND content boss phases in one battle — the declared
  // waves spawn their referenced compositions exactly on schedule (observed
  // scheduledTick + 1) while the boss descends via the content phase machine,
  // deterministically.
  assert.equal(byId['encounter_fixture_wave_boss'].objective, 'defeat_boss');
  assert.equal(byId['encounter_fixture_wave_boss'].waveBossInterplay, true);
  const spawnByWave = new Map(byId['encounter_fixture_wave_boss'].waveSpawnTicks);
  assert.equal(spawnByWave.get('encounter_fixture_wave_boss_wave_0'), 31); // atSeconds 1 → 30 ticks
  assert.equal(spawnByWave.get('encounter_fixture_wave_boss_wave_1'), 121); // atSeconds 4 → 120 ticks
  // §8.3 real heal source teeth: the lifesteal encounter's heal_sustain mission
  // completes from REAL HealApplied events (the modifier-runtime `heal_bps`
  // effect, 300 damage → 150 heal), the player sustains below max and the
  // enemy's death ends the battle VICTORY — deterministically, no injected heal.
  const healEntry = byId['encounter_fixture_heal_sustain'];
  assert.equal(healEntry.objective, 'heal_sustain');
  assert.equal(healEntry.healSustainRealCombat, true);
  assert.equal(healEntry.terminal.phase, 'VICTORY');
  assert.equal(healEntry.ticks, 467);
  assert.ok(healEntry.heals.length >= 7, 'at least 7 lifesteal heals observed');
  for (const heal of healEntry.heals.slice(0, 7)) {
    assert.deepEqual(heal, ['unit_p', 150, 150]);
  }
  // §7/§6 heal stream on the static report: the sustain battle's heals are
  // real applied entries (delta > 0) with ZERO suppressed (no immune targets),
  // and the field rides EVERY encounter's report entry.
  assert.ok(Array.isArray(healEntry.healStream) && healEntry.healStream.length >= 7, 'healStream carries the applied heals');
  const healApplied = healEntry.healStream.filter((h) => !h.blocked);
  assert.ok(healApplied.length >= 7, 'applied heal-stream entries present');
  assert.ok(healApplied.slice(0, 7).every((h) => h.targetId === 'unit_p' && h.delta === 150), 'first heal-stream entries are the full 150 lifesteal heals');
  assert.equal(healEntry.healStream.filter((h) => h.blocked).length, 0, 'no suppressed heals in the sustain setup');
  for (const key of Object.keys(byId)) {
    assert.ok(Array.isArray(byId[key].healStream), `${key} report carries the healStream field`);
  }
});

test('phase21-policy mass-sim evidence (all policy combos) is PASS with zero drift and zero gate violations', () => {
  const report = JSON.parse(readFileSync(join(root, 'docs', 'reports', 'phase21-policy-mass-sim.json'), 'utf8'));
  assert.equal(report.status, 'PASS');
  assert.equal(report.mode, 'phase21-policy-corpus');
  assert.equal(report.hashDrift, 0);
  assert.equal(report.gateViolations, 0);
  assert.equal(report.comboCount, 18);
  assert.equal(report.groups, 3);
  assert.ok(report.battles >= 2000, 'default sweep is 2000 battles');
  const g = report.gateStats;
  // The direct-damage gate never lets a hit reach immune/shield_only HP.
  assert.equal(g.immuneDropped, 0);
  assert.equal(g.shieldOnlyDropped, 0);
  // The status gate never lets a burn tick on a `block` target.
  assert.equal(g.blockTicked, 0);
  // Both gates were exercised non-trivially across the sweep.
  assert.ok(g.normalDropped > 0, 'normal objects received direct damage');
  assert.ok(g.allowTicked > 0, 'allow objects fired their periodic burn');
  // Every combo is present and independently gated.
  const keys = Object.keys(report.byCombo);
  assert.equal(keys.length, 18);
  for (const key of keys) {
    const entry = report.byCombo[key];
    if (key.startsWith('normal')) assert.ok(entry.count > 0);
    else assert.equal(entry.directReachedHp, 0, `${key} must never reach object HP`);
    if (key.includes('/block/')) assert.equal(entry.ticked, 0, `${key} block must never tick`);
  }
});

test('phase14 readiness gate honors present evidence and blocks on device work', () => {
  const d = mkdtempSync(join(tmpdir(), 'p14-ready-'));
  mkdirSync(join(d, 'contracts', 'phase15'), { recursive: true });
  mkdirSync(join(d, 'docs', 'reports'), { recursive: true });
  writeFileSync(join(d, 'contracts', 'phase15', 'phase14-readiness.expected.json'), readFileSync(join(root, 'contracts', 'phase15', 'phase14-readiness.expected.json')));
  writeFileSync(join(d, 'docs', 'reports', 'phase14-mass-sim.json'), JSON.stringify({ status: 'PASS', battles: 10000 }));
  writeFileSync(join(d, 'docs', 'reports', 'phase14-crossruntime.json'), JSON.stringify({
    runtimes: {
      node: { status: 'REFERENCE' },
      chromium: { status: 'PASS' },
      firefox: { status: 'PASS' },
      webkit: { status: 'PASS' },
      android_webview: { status: 'NOT_RUN' },
      ios_wkwebview: { status: 'NOT_RUN' },
    },
  }));
  const res = run(['tools/sim/validate-phase14-readiness.mjs', d]);
  const report = JSON.parse(res.stdout);
  assert.equal(res.status, 2);
  assert.equal(report.status, 'BLOCKED');
  assert.deepEqual(report.blockers, ['P15_G14_WEBVIEWS_NOT_RUN', 'P15_G14_NOT_REPRODUCED', 'P15_G14_DEVICE_PERF_MISSING']);
  assert.deepEqual(report.satisfied.map((s) => s.id), ['massSim', 'crossRuntimeDesktop']);
});

test('phase14 readiness gate flags missing evidence artifacts', () => {
  const d = mkdtempSync(join(tmpdir(), 'p14-ready-'));
  mkdirSync(join(d, 'contracts', 'phase15'), { recursive: true });
  writeFileSync(join(d, 'contracts', 'phase15', 'phase14-readiness.expected.json'), readFileSync(join(root, 'contracts', 'phase15', 'phase14-readiness.expected.json')));
  const res = run(['tools/sim/validate-phase14-readiness.mjs', d]);
  const report = JSON.parse(res.stdout);
  assert.equal(res.status, 2);
  assert.ok(report.blockers.includes('P15_G14_MASSSIM_MISSING'));
  assert.ok(report.blockers.includes('P15_G14_CROSSRUNTIME_MISSING'));
});

test('crossruntime browser runner fills desktop engines hash-identically to Node for both phases', () => {
  const d = mkdtempSync(join(tmpdir(), 'p14-crb-'));
  const res = run(['tools/sim/run-crossruntime-browsers.mjs', join(d, 'matrix.json')]);
  assert.equal(res.status, 0, res.stderr);
  const matrix = JSON.parse(readFileSync(join(d, 'matrix.json'), 'utf8'));
  for (const key of ['chromium', 'firefox', 'webkit']) {
    assert.equal(matrix.runtimes[key].status, 'PASS', `${key}: ${JSON.stringify(matrix.runtimes[key].drift)}`);
    assert.equal(matrix.runtimes[key].tick30, matrix.runtimes.node.tick30);
    assert.equal(matrix.runtimes[key].tick60, matrix.runtimes.node.tick60);
    assert.equal(matrix.runtimes[key].endHash, matrix.runtimes.node.endHash);
    assert.equal(matrix.runtimes[key].startHash, matrix.runtimes.node.startHash);
  }
  assert.equal(matrix.runtimes.android_webview.status, 'NOT_RUN');
  assert.equal(matrix.runtimes.ios_wkwebview.status, 'NOT_RUN');
  // Phase 15 movement trace: desktop engines hash-identical to the P15 node column.
  for (const key of ['chromium', 'firefox', 'webkit']) {
    assert.equal(matrix.phase15.runtimes[key].status, 'PASS', `${key}: ${JSON.stringify(matrix.phase15.runtimes[key].drift)}`);
    assert.equal(matrix.phase15.runtimes[key].tick30, matrix.phase15.runtimes.node.tick30);
    assert.equal(matrix.phase15.runtimes[key].tick60, matrix.phase15.runtimes.node.tick60);
    assert.equal(matrix.phase15.runtimes[key].endHash, matrix.phase15.runtimes.node.endHash);
    assert.equal(matrix.phase15.runtimes[key].startHash, matrix.phase15.runtimes.node.startHash);
  }
  assert.equal(matrix.phase15.runtimes.android_webview.status, 'NOT_RUN');
  assert.equal(matrix.phase15.runtimes.ios_wkwebview.status, 'NOT_RUN');
  // Phase 16 targeting/attack-prep trace: desktop engines hash-identical to the P16 node column.
  for (const key of ['chromium', 'firefox', 'webkit']) {
    assert.equal(matrix.phase16.runtimes[key].status, 'PASS', `${key}: ${JSON.stringify(matrix.phase16.runtimes[key].drift)}`);
    assert.equal(matrix.phase16.runtimes[key].tick30, matrix.phase16.runtimes.node.tick30);
    assert.equal(matrix.phase16.runtimes[key].tick60, matrix.phase16.runtimes.node.tick60);
    assert.equal(matrix.phase16.runtimes[key].endHash, matrix.phase16.runtimes.node.endHash);
    assert.equal(matrix.phase16.runtimes[key].startHash, matrix.phase16.runtimes.node.startHash);
  }
  assert.equal(matrix.phase16.runtimes.android_webview.status, 'NOT_RUN');
  assert.equal(matrix.phase16.runtimes.ios_wkwebview.status, 'NOT_RUN');
  // Phase 17 basic-attack/projectile/damage trace: desktop engines hash-identical to the P17 node column.
  for (const key of ['chromium', 'firefox', 'webkit']) {
    assert.equal(matrix.phase17.runtimes[key].status, 'PASS', `${key}: ${JSON.stringify(matrix.phase17.runtimes[key].drift)}`);
    assert.equal(matrix.phase17.runtimes[key].tick30, matrix.phase17.runtimes.node.tick30);
    assert.equal(matrix.phase17.runtimes[key].tick60, matrix.phase17.runtimes.node.tick60);
    assert.equal(matrix.phase17.runtimes[key].endHash, matrix.phase17.runtimes.node.endHash);
    assert.equal(matrix.phase17.runtimes[key].startHash, matrix.phase17.runtimes.node.startHash);
  }
  assert.equal(matrix.phase17.runtimes.android_webview.status, 'NOT_RUN');
  assert.equal(matrix.phase17.runtimes.ios_wkwebview.status, 'NOT_RUN');
  // Phase 18 status periodic/expiry trace: desktop engines hash-identical to the P18 node column.
  for (const key of ['chromium', 'firefox', 'webkit']) {
    assert.equal(matrix.phase18.runtimes[key].status, 'PASS', `${key}: ${JSON.stringify(matrix.phase18.runtimes[key].drift)}`);
    assert.equal(matrix.phase18.runtimes[key].tick30, matrix.phase18.runtimes.node.tick30);
    assert.equal(matrix.phase18.runtimes[key].tick60, matrix.phase18.runtimes.node.tick60);
    assert.equal(matrix.phase18.runtimes[key].endHash, matrix.phase18.runtimes.node.endHash);
    assert.equal(matrix.phase18.runtimes[key].startHash, matrix.phase18.runtimes.node.startHash);
  }
  assert.equal(matrix.phase18.runtimes.android_webview.status, 'NOT_RUN');
  assert.equal(matrix.phase18.runtimes.ios_wkwebview.status, 'NOT_RUN');
});
