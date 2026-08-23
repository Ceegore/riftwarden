/**
 * Post-boot screen router: after boot finishes at TITLE or FIRST_RUN,
 * determines which screen to show based on save state and renders it
 * through the ScreenNavigator.
 */
import { useCallback, type JSX } from 'react';
import type { RoutableScreenKey } from '../app/navigation/screen-id.js';
import { ScreenNavigator, routeFor } from '../app/navigation/ScreenNavigator.js';
import { Button } from '../ui/components/Button.js';
import { ScreenFrame } from '../ui/layout/ScreenFrame.js';
import { useExpedition } from '../features/expedition/useExpedition.js';
import type { BootTerminalStep } from '../app/boot/boot-types.js';

export function PostBootScreen({ step }: { readonly step: Exclude<BootTerminalStep, 'RECOVERY_REQUIRED'> }): JSX.Element {
  const { snapshot, map, hasSave, newRun, continueRun, loading } = useExpedition();

  const handleNewGame = useCallback(() => newRun(Date.now()), [newRun]);
  const handleContinue = useCallback(() => continueRun(), [continueRun]);

  if (step === 'FIRST_RUN') {
    return (
      <ScreenFrame labelledBy="first-run-title">
        <h1 id="first-run-title">Welcome</h1>
        <p>Start your first expedition.</p>
        <Button labelKey="ui.common.start" variant="primary" onClick={handleNewGame} disabled={loading} />
      </ScreenFrame>
    );
  }

  // TITLE: show the appropriate screen.
  if (snapshot && map) {
    // Active expedition — show dungeon map.
    return <ScreenNavigator route={routeFor('dungeonMap' as RoutableScreenKey)} />;
  }

  if (hasSave) {
    return (
      <ScreenFrame labelledBy="continue-title">
        <h1 id="continue-title">Continue</h1>
        <p>You have a saved expedition.</p>
        <Button labelKey="ui.common.continue" variant="primary" onClick={handleContinue} disabled={loading} />
        <Button labelKey="ui.common.new_game" variant="secondary" onClick={handleNewGame} disabled={loading} />
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame labelledBy="no-run-title">
      <h1 id="no-run-title">Expedition</h1>
      <p>Start a new expedition.</p>
      <Button labelKey="ui.common.start" variant="primary" onClick={handleNewGame} disabled={loading} />
    </ScreenFrame>
  );
}
