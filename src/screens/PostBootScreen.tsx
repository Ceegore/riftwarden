/**
 * Post-boot screen router: after boot finishes at TITLE or FIRST_RUN,
 * manages the expedition screen flow. Navigation state cycles between
 * 'menu' (start/continue), 'map' (dungeon map), and 'node' (enter/act/resolve).
 * NodeScreen calls onResolved when the node is completed, which transitions
 * back to the map.
 */
import { useCallback, useEffect, useState, type JSX } from 'react';
import { DungeonMapScreen } from './run/DungeonMapScreen.js';
import { NodeScreen } from './run/NodeScreen.js';
import { Button } from '../ui/components/Button.js';
import { ScreenFrame } from '../ui/layout/ScreenFrame.js';
import { useExpedition } from '../features/expedition/useExpedition.js';
import type { BootTerminalStep } from '../app/boot/boot-types.js';

type NavState = 'menu' | 'map' | 'node';

export function PostBootScreen({ step }: { readonly step: Exclude<BootTerminalStep, 'RECOVERY_REQUIRED'> }): JSX.Element {
  const { snapshot, map, hasSave, newRun, continueRun, loading } = useExpedition();
  const [nav, setNav] = useState<NavState>(() => (snapshot && map ? 'map' : 'menu'));

  // Sync nav when expedition state changes externally (abandon, restore).
  useEffect(() => {
    if (snapshot && map) {
      if (nav === 'menu') setNav('map');
    } else {
      if (nav !== 'menu') setNav('menu');
    }
    // Only react to snapshot/map existence, not nav itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, map]);

  const handleNewGame = useCallback(() => {
    newRun(Date.now());
  }, [newRun]);

  const handleContinue = useCallback(() => {
    continueRun();
  }, [continueRun]);

  const handleEnterNode = useCallback(() => setNav('node'), []);
  const handleNodeResolved = useCallback(() => setNav('map'), []);

  if (nav === 'map') {
    return <DungeonMapScreen onEnterNode={handleEnterNode} />;
  }

  if (nav === 'node') {
    return <NodeScreen onResolved={handleNodeResolved} />;
  }

  // 'menu' state — same for FIRST_RUN and TITLE.
  if (step === 'FIRST_RUN') {
    return (
      <ScreenFrame labelledBy="first-run-title">
        <h1 id="first-run-title">Welcome</h1>
        <p>Start your first expedition.</p>
        <Button labelKey="ui.common.start" variant="primary" onClick={handleNewGame} disabled={loading} />
      </ScreenFrame>
    );
  }

  // TITLE with save: offer continue + new game.
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

  // TITLE without save: start fresh.
  return (
    <ScreenFrame labelledBy="no-run-title">
      <h1 id="no-run-title">Expedition</h1>
      <p>Start a new expedition.</p>
      <Button labelKey="ui.common.start" variant="primary" onClick={handleNewGame} disabled={loading} />
    </ScreenFrame>
  );
}
