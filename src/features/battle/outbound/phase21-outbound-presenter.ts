/**
 * Phase 21 §9 outbound presentation. The content launcher emits a per-encounter
 * report (terminal, modifier hook log, boss phase, full phase trace). This pure
 * module maps that "outbound sense" into a UI presentation model so a React
 * panel can render hook-driven boss scripting without reading the sim core.
 *
 * It is intentionally a pure mapper — no I/O, no localeApply, no wallclock — so
 * it is unit-testable in the renderer-agnostic node environment.
 */

export type OutboundHookEvent = readonly [modifierId: string, hook: string, atTick: number];
export type OutboundPhaseEvent = readonly [type: string, tick: number, detail: string];

export type EncounterOutbound = {
  readonly objective: string;
  readonly terminal: { readonly phase: string; readonly reason: string | null } | null;
  readonly ticks: number;
  readonly status: string;
  readonly hooks: readonly OutboundHookEvent[];
  readonly bossPhase: { readonly phaseId: string; readonly visited: readonly string[]; readonly transition: boolean } | null;
  readonly phasesDescended?: boolean;
  readonly phaseTrace?: readonly OutboundPhaseEvent[];
};

export type Phase21OutboundReport = {
  readonly gate: string;
  readonly status: string;
  readonly drift: number;
  readonly seededFailures: number;
  readonly perEncounter: Readonly<Record<string, EncounterOutbound>>;
};

export type PhaseTrailStep = {
  readonly phaseId: string;
  readonly active: boolean;
};

export type HookEntry = {
  readonly modifierId: string;
  readonly hook: string;
  readonly atTick: number;
};

export type TraceEntry = {
  readonly type: string;
  readonly tick: number;
  readonly detail: string;
};

export type EncounterPresentation = {
  readonly encounterId: string;
  readonly objective: string;
  readonly terminalPhase: string | null;
  readonly terminalReason: string | null;
  readonly ticks: number;
  readonly status: 'PASS' | 'FAIL';
  readonly isBossPhase: boolean;
  readonly phasesDescended: boolean;
  readonly phaseTrail: readonly PhaseTrailStep[];
  readonly hookTrace: readonly HookEntry[];
  readonly phaseTrace: readonly TraceEntry[];
};

function terminalOf(entry: EncounterOutbound): readonly [string | null, string | null] {
  const t = entry.terminal;
  if (t === null) return [null, null];
  return [t.phase, t.reason];
}

function statusOf(value: string): 'PASS' | 'FAIL' {
  return value === 'PASS' ? 'PASS' : 'FAIL';
}

/** Ordered phase trail from the boss-phase projection: visited phases in commit
 * order, the last one flagged as the current (active) phase. */
export function phaseTrailOf(bossPhase: EncounterOutbound['bossPhase']): readonly PhaseTrailStep[] {
  if (bossPhase === null) return Object.freeze([]);
  const visited = bossPhase.visited;
  const last = visited[visited.length - 1];
  return Object.freeze(
    visited.map((phaseId) => Object.freeze({ phaseId, active: phaseId === last })),
  );
}

/** Canonical encounter order: code-unit id compare (never localeApply). */
function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Maps a full phase21 content-launch report to a sorted list of encounter rows. */
export function presentPhase21Report(report: Phase21OutboundReport): readonly EncounterPresentation[] {
  const ids = Object.keys(report.perEncounter).sort(compareIds);
  return Object.freeze(ids.map((id) => {
    const entry = report.perEncounter[id];
    if (entry === undefined) throw new Error(`missing outbound entry for ${id}`);
    const [terminalPhase, terminalReason] = terminalOf(entry);
    const hookTrace = Object.freeze(entry.hooks.map(([modifierId, hook, atTick]) => Object.freeze({ modifierId, hook, atTick })));
    const phaseTrace = Object.freeze((entry.phaseTrace ?? Object.freeze([])).map(([type, tick, detail]) => Object.freeze({ type, tick, detail })));
    return Object.freeze({
      encounterId: id,
      objective: entry.objective,
      terminalPhase,
      terminalReason,
      ticks: entry.ticks,
      status: statusOf(entry.status),
      isBossPhase: entry.bossPhase !== null,
      phasesDescended: entry.phasesDescended === true,
      phaseTrail: phaseTrailOf(entry.bossPhase),
      hookTrace,
      phaseTrace,
    });
  }));
}
