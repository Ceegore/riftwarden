/**
 * Phase 40: BattleTacticalView — replaces the PixiJS battle canvas when
 * reduced motion is active. Shows a static textual summary of the combat
 * lineup instead of animated graphics.
 */
import type { JSX } from 'react';
import { StatRow } from '../../ui/components/StatRow.js';
import { ScrollRegion } from '../../ui/layout/ScrollRegion.js';
import type { UnitRenderData } from './battle-renderer.js';

export interface BattleTacticalViewProps {
  readonly units: readonly UnitRenderData[];
}

function allies(units: readonly UnitRenderData[]): readonly UnitRenderData[] {
  return units.filter((u) => u.side === 'ally');
}

function enemies(units: readonly UnitRenderData[]): readonly UnitRenderData[] {
  return units.filter((u) => u.side === 'enemy');
}

export function BattleTacticalView({ units }: BattleTacticalViewProps): JSX.Element {
  const allyUnits = allies(units);
  const enemyUnits = enemies(units);

  return (
    <section aria-label="Tactical combat summary" className="rw-tactical-view">
      <h2>Combat Lineup</h2>

      <div className="rw-tactical-column">
        <h3>Allies ({String(allyUnits.length)})</h3>
        <ScrollRegion label="Ally roster">
          {allyUnits.map((u) => (
            <StatRow
              key={u.id}
              label={u.label}
              value={`${String(u.hp)} / ${String(u.maxHp)} HP`}
            />
          ))}
        </ScrollRegion>
      </div>

      <div className="rw-tactical-column">
        <h3>Enemies ({String(enemyUnits.length)})</h3>
        <ScrollRegion label="Enemy roster">
          {enemyUnits.map((u) => (
            <StatRow
              key={u.id}
              label={u.label}
              value={`${String(u.hp)} / ${String(u.maxHp)} HP`}
            />
          ))}
        </ScrollRegion>
      </div>
    </section>
  );
}