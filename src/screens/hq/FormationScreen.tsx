/**
 * Formation screen (S40): select formation and place heroes in slots.
 */
import { useCallback, useMemo, useState } from 'react';
import type { JSX } from 'react';
import { Button } from '../../ui/components/Button.js';
import { GameCard } from '../../ui/components/GameCard.js';
import { StatRow } from '../../ui/components/StatRow.js';
import { ScreenFrame } from '../../ui/layout/ScreenFrame.js';
import { BottomActionBar } from '../../ui/layout/BottomActionBar.js';
import { ScrollRegion } from '../../ui/layout/ScrollRegion.js';
import { loadFormationState, saveFormationState, setActiveFormation, placeHero } from '../../game/formations/formation-store.js';
import { FORMATION_DEFINITIONS, type FormationPosition } from '../../game/formations/types.js';
import { loadOrCreateProfile } from '../../game/profile/profile-store.js';

export interface FormationScreenProps {
  readonly onBack: () => void;
}

function posLabel(pos: FormationPosition): string {
  const labels: Record<FormationPosition, string> = {
    front_left: 'Front Left', front_center: 'Front Center', front_right: 'Front Right',
    middle_left: 'Middle Left', middle_center: 'Middle Center', middle_right: 'Middle Right',
    back_left: 'Back Left', back_center: 'Back Center', back_right: 'Back Right',
  };
  return labels[pos];
}

function heroDisplayName(heroId: string): string {
  return heroId.replace(/^hero_/, '').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function FormationScreen({ onBack }: FormationScreenProps): JSX.Element {
  const [formationState, setFormationState] = useState(loadFormationState);
  const profile = useMemo(() => loadOrCreateProfile(), []);
  const heroIds = useMemo(
    () => Object.values(profile.heroes).filter((hero) => hero.unlocked).map((hero) => hero.id),
    [profile],
  );
  const [selectedPosition, setSelectedPosition] = useState<FormationPosition | null>(null);

  const activeFormation = useMemo(
    () => FORMATION_DEFINITIONS.find((f) => f.id === formationState.activeFormation) ?? null,
    [formationState.activeFormation],
  );

  const handleSetFormation = useCallback((formationId: string) => {
    const next = setActiveFormation(formationState, formationId);
    saveFormationState(next);
    setFormationState(next);
  }, [formationState]);

  const handlePlace = useCallback((heroId: string) => {
    if (!selectedPosition) return;
    const next = placeHero(formationState, selectedPosition, heroId);
    saveFormationState(next);
    setFormationState(next);
    setSelectedPosition(null);
  }, [formationState, selectedPosition]);

  const handleRemove = useCallback((position: FormationPosition) => {
    const next = placeHero(formationState, position, null);
    saveFormationState(next);
    setFormationState(next);
  }, [formationState]);

  return (
    <ScreenFrame labelledBy="formation-title">
      <h1 id="formation-title">Formation</h1>

      <section>
        <h2>Choose Formation</h2>
        <ScrollRegion label="Formations">
          {formationState.formations.map((f) => (
            <Button
              key={f.id}
              label={f.label}
              variant={formationState.activeFormation === f.id ? 'primary' : 'secondary'}
              disabled={!f.unlocked}
              onClick={() => { handleSetFormation(f.id); }}
            />
          ))}
        </ScrollRegion>
      </section>

      {activeFormation && (
        <ScrollRegion label="Placement">
          {Object.entries(activeFormation.bonuses).map(([stat, val]) => (
            <StatRow key={stat} label={`Bonus ${stat.toUpperCase()}`} value={`+${String(val)}`} />
          ))}
          {activeFormation.positions.map((pos) => {
            const heroId = formationState.placement[pos];
            return (
              <GameCard key={pos} title={posLabel(pos)} state="default"
                onSelect={() => { setSelectedPosition(pos); }}>
                {heroId ? (
                  <>
                    <StatRow label="Hero" value={heroId} />
                    <Button labelKey="ui.common.remove" variant="secondary"
                      onClick={() => { handleRemove(pos); }} />
                  </>
                ) : (
                  <StatRow label="Empty" value="Tap to place" />
                )}
              </GameCard>
            );
          })}
        </ScrollRegion>
      )}

      {selectedPosition && (
        <section>
          <h2>Place hero in {posLabel(selectedPosition)}</h2>
          <ScrollRegion label="Available heroes">
            {heroIds.map((hid) => (
              <Button key={hid} label={heroDisplayName(hid)} variant="secondary"
                onClick={() => { handlePlace(hid); }} />
            ))}
          </ScrollRegion>
        </section>
      )}

      <BottomActionBar>
        <Button labelKey="ui.common.back" variant="secondary" onClick={onBack} />
      </BottomActionBar>
    </ScreenFrame>
  );
}
