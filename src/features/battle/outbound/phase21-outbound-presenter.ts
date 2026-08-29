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

export type OutboundBossPhase = { readonly phaseId: string; readonly visited: readonly string[]; readonly transition: boolean };

export type EncounterOutbound = {
  readonly objective: string;
  readonly terminal: { readonly phase: string; readonly reason: string | null } | null;
  readonly ticks: number;
  readonly status: string;
  readonly hooks: readonly OutboundHookEvent[];
  readonly bossPhase: OutboundBossPhase | null;
  /** The secondary boss authority (duo encounters) — same shape as the primary slot. */
  readonly bossPhaseSecondary?: OutboundBossPhase | null;
  readonly phasesDescended?: boolean;
  readonly phaseTrace?: readonly OutboundPhaseEvent[];
  /** One telegraph per planned boss transition: [target phase, planned tick, resolve tick]. */
  readonly telegraphs?: readonly OutboundTelegraph[];
};

export type OutboundTelegraph = readonly [phaseId: string, plannedTick: number, resolveTick: number];

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

export type TelegraphPresentation = {
  readonly phaseId: string;
  readonly plannedTick: number;
  /** Commit tick the telegraph counts down to (the event's own tick when none was carried). */
  readonly resolveTick: number;
  /** Ticks remaining until resolve from the snapshot's tick (0 once resolved). */
  readonly countdown: number;
  readonly resolved: boolean;
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
  /** Second boss authority's trail (duo encounters); empty when absent. */
  readonly phaseTrailSecondary: readonly PhaseTrailStep[];
  readonly hookTrace: readonly HookEntry[];
  readonly phaseTrace: readonly TraceEntry[];
  readonly telegraphs: readonly TelegraphPresentation[];
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

/** Live battle surface the bridge reads (structural — no sim core import). */
export interface LiveOutboundInput {
  readonly encounterId: string;
  readonly objective: string;
  readonly tick: number;
  readonly phase: { readonly phase: string; readonly endReason: string | null };
  readonly bossPhase: { readonly phaseId: string; readonly visited: readonly string[]; readonly transition: unknown } | null;
  /** Second boss authority (duo encounters); same shape as the primary slot. */
  readonly bossPhaseSecondary?: { readonly phaseId: string; readonly visited: readonly string[]; readonly transition: unknown } | null;
  readonly modifierHookLog: readonly { readonly modifierId: string; readonly hook: string; readonly atTick: number }[];
  /** Canonical phase events; `BossTelegraphStarted` carries the resolve (commit) tick. */
  readonly events: readonly { readonly type: string; readonly tick: number; readonly contentIds: readonly string[]; readonly resolveTick?: number }[];
  readonly status?: string;
}

const TRACE_TYPES: readonly string[] = Object.freeze(['PhaseTransitionPlanned', 'BossTelegraphStarted', 'BossPhaseCompleted', 'BossPhaseStarted']);

/**
 * Live-battle bridge: maps the running sim's boss phase, modifier hook log and
 * canonical event stream into the same outbound entry the launcher report
 * emits, so Phase21OutboundPanel consumes a live battle exactly like a static
 * report. Structural input only — no sim import, still a pure mapper.
 */
function outboundBossPhaseOf(phase: { readonly phaseId: string; readonly visited: readonly string[]; readonly transition: unknown } | null | undefined): OutboundBossPhase | null {
  if (phase == null) return null;
  return Object.freeze({ phaseId: phase.phaseId, visited: Object.freeze([...phase.visited]), transition: phase.transition !== null });
}

export function encounterOutboundFromBattle(input: LiveOutboundInput): EncounterOutbound {
  const terminalPhase = ['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(input.phase.phase) ? input.phase.phase : null;
  const telegraphs = input.events
    .filter((e) => e.type === 'BossTelegraphStarted' && e.contentIds.length >= 2)
    .map((e) => Object.freeze([e.contentIds[1] ?? '', e.tick, e.resolveTick ?? e.tick] as const));
  const bossPhase = outboundBossPhaseOf(input.bossPhase);
  const bossPhaseSecondary = outboundBossPhaseOf(input.bossPhaseSecondary);
  return Object.freeze({
    objective: input.objective,
    terminal: terminalPhase === null ? null : { phase: terminalPhase, reason: input.phase.endReason },
    ticks: input.tick,
    status: input.status ?? 'PASS',
    hooks: Object.freeze(input.modifierHookLog.map((f) => Object.freeze([f.modifierId, f.hook, f.atTick] as const))),
    bossPhase,
    bossPhaseSecondary,
    phasesDescended: (bossPhase !== null && bossPhase.visited.length > 1) || (bossPhaseSecondary !== null && bossPhaseSecondary.visited.length > 1),
    phaseTrace: Object.freeze(
      input.events
        .filter((e) => TRACE_TYPES.includes(e.type))
        .map((e) => Object.freeze([e.type, e.tick, e.contentIds.join('/')] as const)),
    ),
    telegraphs: Object.freeze(telegraphs),
  });
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
    const telegraphs = Object.freeze((entry.telegraphs ?? Object.freeze([])).map(([phaseId, plannedTick, resolveTick]) => {
      const resolved = entry.ticks >= resolveTick;
      return Object.freeze({
        phaseId,
        plannedTick,
        resolveTick,
        countdown: resolved ? 0 : resolveTick - entry.ticks,
        resolved,
      });
    }));
    return Object.freeze({
      encounterId: id,
      objective: entry.objective,
      terminalPhase,
      terminalReason,
      ticks: entry.ticks,
      status: statusOf(entry.status),
      isBossPhase: entry.bossPhase !== null || entry.bossPhaseSecondary != null,
      phasesDescended: entry.phasesDescended === true,
      phaseTrail: phaseTrailOf(entry.bossPhase),
      phaseTrailSecondary: phaseTrailOf(entry.bossPhaseSecondary ?? null),
      hookTrace,
      phaseTrace,
      telegraphs,
    });
  }));
}
