import type { JSX } from 'react';
import { LocalizedText } from '../../../locales/LocalizedText.js';
import type { EncounterPresentation, Phase21OutboundReport } from './phase21-outbound-presenter.js';
import { presentPhase21Report } from './phase21-outbound-presenter.js';

/**
 * Phase 21 §9 outbound consumer. Renders the content-launch report the launcher
 * emits — the modifier hook telegraphs, the boss phase trail and the full phase
 * trace — as a lightweight, static panel. Pure data in, markup out: the
 * presentation is prepared by presentPhase21Report (unit-tested), this panel
 * only walks it and localizes the visible words via `ui.phase21.*` keys
 * (structural punctuation and ids stay inline).
 */
export interface Phase21OutboundPanelProps {
  readonly report: Phase21OutboundReport;
}

/** Canonical phase event → `ui.phase21.trace.*` message key (fallback: raw type). */
const TRACE_KEYS: Readonly<Record<string, string>> = Object.freeze({
  PhaseTransitionPlanned: 'ui.phase21.trace.planned',
  BossTelegraphStarted: 'ui.phase21.trace.telegraph',
  BossPhaseCompleted: 'ui.phase21.trace.exited',
  BossPhaseStarted: 'ui.phase21.trace.entered',
});

export function Phase21OutboundPanel({ report }: Phase21OutboundPanelProps): JSX.Element {
  const rows = presentPhase21Report(report);
  const failed = rows.filter((r) => r.status === 'FAIL').length;
  return (
    <section aria-label="Phase 21 outbound summary" className="rw-phase21-outbound">
      <div className="rw-phase21-outbound-head">
        <strong><LocalizedText messageKey="ui.phase21.outbound.title" /></strong>
        <span className="rw-type-numeric">
          {`${String(rows.length)} `}<LocalizedText messageKey="ui.phase21.outbound.encounters" />{` · ${String(failed)} `}<LocalizedText messageKey="ui.phase21.outbound.failed" />
        </span>
      </div>
      {rows.map((row) => <EncounterRow key={row.encounterId} row={row} />)}
    </section>
  );
}

function EncounterRow({ row }: { readonly row: EncounterPresentation }): JSX.Element {
  return (
    <article aria-label={row.encounterId} className="rw-phase21-encounter">
      <header className="rw-phase21-encounter-head">
        <code>{row.encounterId}</code>
        <span className={row.status === 'PASS' ? 'rw-phase21-ok' : 'rw-phase21-bad'}>{row.status}</span>
      </header>
      <div className="rw-phase21-encounter-meta">
        <LocalizedText messageKey="ui.phase21.meta.objective" /> {row.objective}
        {row.terminalPhase !== null && (
          <> · {row.terminalPhase}{row.terminalReason == null ? '' : ` (${row.terminalReason})`} · {String(row.ticks)} <LocalizedText messageKey="ui.phase21.ticks" /></>
        )}
      </div>
      {row.isBossPhase && (
        <ol className="rw-phase21-phases" aria-label="boss phase trail">
          {row.phaseTrail.map((step) => (
            <li key={step.phaseId} className={step.active ? 'rw-phase21-active' : undefined}>
              {step.phaseId}
              {step.active ? ' ' : ''}
              {step.active ? <LocalizedText messageKey="ui.phase21.phase.current" /> : null}
            </li>
          ))}
        </ol>
      )}
      {row.phaseTrailSecondary.length > 0 && (
        <ol className="rw-phase21-phases rw-phase21-phases-secondary" aria-label="boss phase trail (secondary)">
          {row.phaseTrailSecondary.map((step) => (
            <li key={step.phaseId} className={step.active ? 'rw-phase21-active' : undefined}>
              {step.phaseId}
              {step.active ? ' ' : ''}
              {step.active ? <LocalizedText messageKey="ui.phase21.phase.current" /> : null}
            </li>
          ))}
        </ol>
      )}
      {row.telegraphs.length > 0 && (
        <ul className="rw-phase21-telegraphs" aria-label="boss phase telegraph countdowns">
          {row.telegraphs.map((telegraph) => (
            <li key={`${telegraph.phaseId}:${String(telegraph.plannedTick)}`}>
              <LocalizedText messageKey="ui.phase21.telegraph.prefix" /> <code>{telegraph.phaseId}</code>
              {telegraph.resolved
                ? <> · <LocalizedText messageKey="ui.phase21.telegraph.resolved_at" /> {String(telegraph.resolveTick)}</>
                : <> · <LocalizedText messageKey="ui.phase21.telegraph.resolves_in" /> {String(telegraph.countdown)} <LocalizedText messageKey="ui.phase21.ticks" /></>}
            </li>
          ))}
        </ul>
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
              {TRACE_KEYS[event.type] !== undefined
                ? <LocalizedText messageKey={TRACE_KEYS[event.type] ?? 'ui.phase21.trace.planned'} />
                : event.type} <code>{event.detail}</code> @ {String(event.tick)}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
