import type { JSX } from 'react';
import type { EncounterPresentation, Phase21OutboundReport } from './phase21-outbound-presenter.js';
import { presentPhase21Report } from './phase21-outbound-presenter.js';

/**
 * Phase 21 §9 outbound consumer. Renders the content-launch report the launcher
 * emits — the modifier hook telegraphs, the boss phase trail and the full phase
 * trace — as a lightweight, static panel. Pure data in, markup out: the
 * presentation is prepared by presentPhase21Report (unit-tested), this panel
 * only walks it.
 */
export interface Phase21OutboundPanelProps {
  readonly report: Phase21OutboundReport;
}

const TRACE_LABEL: Readonly<Record<string, string>> = Object.freeze({
  PhaseTransitionPlanned: 'planned',
  BossTelegraphStarted: 'telegraph',
  BossPhaseCompleted: 'exited',
  BossPhaseStarted: 'entered',
});

export function Phase21OutboundPanel({ report }: Phase21OutboundPanelProps): JSX.Element {
  const rows = presentPhase21Report(report);
  const failed = rows.filter((r) => r.status === 'FAIL').length;
  return (
    <section aria-label="Phase 21 outbound summary" className="rw-phase21-outbound">
      <div className="rw-phase21-outbound-head">
        <strong>Phase 21 content launch</strong>
        <span className="rw-type-numeric">{`${String(rows.length)} encounters · ${String(failed)} failed`}</span>
      </div>
      {rows.map((row) => <EncounterRow key={row.encounterId} row={row} />)}
    </section>
  );
}

function EncounterRow({ row }: { readonly row: EncounterPresentation }): JSX.Element {
  const meta = row.terminalPhase === null
    ? `objective ${row.objective}`
    : `objective ${row.objective} · ${row.terminalPhase}${row.terminalReason == null ? '' : ` (${row.terminalReason})`} · ${String(row.ticks)} ticks`;
  return (
    <article aria-label={row.encounterId} className="rw-phase21-encounter">
      <header className="rw-phase21-encounter-head">
        <code>{row.encounterId}</code>
        <span className={row.status === 'PASS' ? 'rw-phase21-ok' : 'rw-phase21-bad'}>{row.status}</span>
      </header>
      <div className="rw-phase21-encounter-meta">{meta}</div>
      {row.isBossPhase && (
        <ol className="rw-phase21-phases" aria-label="boss phase trail">
          {row.phaseTrail.map((step) => (
            <li key={step.phaseId} className={step.active ? 'rw-phase21-active' : undefined}>
              {step.phaseId}
              {step.active ? ' (current)' : ''}
            </li>
          ))}
        </ol>
      )}
      {row.hookTrace.length > 0 && (
        <ul className="rw-phase21-hooks" aria-label="modifier hook telegraphs">
          {row.hookTrace.map((hook, i) => (
            <li key={`${hook.modifierId}:${hook.hook}:${String(i)}`}>
              <code>{hook.modifierId}</code> {hook.hook} @ {String(hook.atTick)}
            </li>
          ))}
        </ul>
      )}
      {row.phaseTrace.length > 0 && (
        <ul className="rw-phase21-trace" aria-label="boss phase trace">
          {row.phaseTrace.map((event, i) => (
            <li key={`${String(event.tick)}:${event.type}:${String(i)}`}>
              {TRACE_LABEL[event.type] ?? event.type} <code>{event.detail}</code> @ {String(event.tick)}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
