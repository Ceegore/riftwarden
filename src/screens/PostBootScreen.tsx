/**
 * Post-boot screen router: after boot finishes at TITLE or FIRST_RUN,
 * manages the full expedition + HQ screen flow through a typed nav state.
 *
 * Nav states:
 *   menu → newGame / help / missions / hq
 *   hq → heroHall / barracks / workshop / archive / mastery / achievements / riftChamber / ascension / constellation / help / back
 *   archive → codexList / storyArchive / records / achievements / back
 *   codexList → codexDetail / back
 *   newGame → launch → map
 *   help → back → menu
 *   missions → select → missionDetail / back → menu
 *   missionDetail → launch → map / back → missions
 *   map → enter → node / back → menu
 *   node → resolve → battleResult (combat) / map (other)
 *   battleResult → continue → reward (if rewards) / map
 *   reward → claim → resolved → map
 *   map (finish) → end (if boss) / defeat
 *   end / defeat → return → menu
 */
import { useCallback, useEffect, useState, type JSX } from 'react';
import { BottomActionBar } from '../ui/layout/BottomActionBar.js';
import { useMusicDirector } from '../features/audio/music-director-hooks.js';
import { contextForScreen } from '../features/audio/music-context-map.js';
import type { HqSection } from './hq/HqOverviewScreen.js';
import type { ArchiveSection } from './hq/ArchiveHubScreen.js';
import { renderRegisteredScreen } from './screen-renderer.js';
import { Button } from '../ui/components/Button.js';
import { ScreenFrame } from '../ui/layout/ScreenFrame.js';
import { useExpedition } from '../features/expedition/useExpedition.js';
import type { BootTerminalStep } from '../app/boot/boot-types.js';
import type { MissionDefinition } from '../game/mission/types.js';

type NavState =
  | 'menu'
  | 'newGame'
  | 'help'
  | 'missions'
  | { readonly kind: 'missionDetail'; readonly mission: MissionDefinition }
  | 'map'
  | { readonly kind: 'node'; readonly nextAfterResolve: 'map' | 'battleResult' }
  | 'battleResult'
  | 'reward'
  | 'end'
  | 'defeat'
  | 'hq'
  | 'heroHall'
  | { readonly kind: 'heroDetail'; readonly heroId: string }
  | 'barracks'
  | { readonly kind: 'troopDetail'; readonly troopTypeId: string }
  | 'workshop'
  | { readonly kind: 'itemDetail'; readonly itemId: string }
  // Phase 35
  | 'archive'
  | 'codexList'
  | { readonly kind: 'codexDetail'; readonly entryId: string }
  | 'mastery'
  | 'achievements'
  | 'records'
  | 'storyArchive'
  // Phase 36
  | 'ascension'
  | 'constellation'
  | 'cyclePreparation'
  | 'beyondSetup'
  | 'endlessSetup'
  | 'riftChamber'
  // Phase 37
  | 'equipment'
  | 'kits'
  | 'banners'
  | 'formation'
  // Phase 39-41: Settings
  | 'settings'
  | 'audioSettings'
  | 'accessibilitySettings'
  | 'controlsSettings'
  | 'graphicsSettings';

export function PostBootScreen({ step }: { readonly step: Exclude<BootTerminalStep, 'RECOVERY_REQUIRED'> }): JSX.Element {
  const { snapshot, map, hasSave, continueRun, loading } = useExpedition();
  const [activeMissionId, setActiveMissionId] = useState('mission_tutorial');
  const [nav, setNav] = useState<NavState>(() => (snapshot && map ? 'map' : 'menu'));

  // Phase 39: drive the music director from the active screen.
  const musicDirector = useMusicDirector();
  const navScreen = typeof nav === 'string' ? nav : nav.kind;
  const currentNodeType = snapshot?.currentNodeType ?? '';
  useEffect(() => {
    musicDirector.request(contextForScreen(navScreen, {
      regionId: activeMissionId,
      nodeType: currentNodeType,
    }));
  }, [navScreen, activeMissionId, currentNodeType, musicDirector]);

  // Boss stem layering: advance the stem as combat intensity ramps.
  // Layer 0 = intro (map / entering), 1 = ENGAGE committed, 2 = after
  // first reward claim, 3 = boss defeated / settle phase.
  const bossStemLayer = snapshot === null || currentNodeType !== 'boss'
    ? 0
    : navScreen === 'node'
      ? (snapshot.state.snapshots[snapshot.currentNodeId]?.kind === 'REWARD' ? 2 : 1)
      : navScreen === 'battleResult'
        ? 3
        : 0;
  useEffect(() => {
    musicDirector.setStem(bossStemLayer);
  }, [bossStemLayer, musicDirector]);

  const handleNewGame = useCallback(() => { setNav('newGame'); }, []);
  const handleHelp = useCallback(() => { setNav('help'); }, []);
  const handleMissions = useCallback(() => { setNav('missions'); }, []);
  const handleContinue = useCallback(() => { continueRun(); setNav('map'); }, [continueRun]);
  const handleMenu = useCallback(() => { setNav('menu'); }, []);

  const handleLaunched = useCallback((missionId: string) => {
    setActiveMissionId(missionId);
    setNav('map');
  }, []);

  const handleSelectMission = useCallback((mission: MissionDefinition) => {
    setNav({ kind: 'missionDetail', mission });
  }, []);

  const handleEnterNode = useCallback(() => {
    setNav({ kind: 'node', nextAfterResolve: 'map' });
  }, []);

  const handleNodeResolved = useCallback((next: 'map' | 'battleResult') => {
    if (next === 'battleResult') {
      setNav('battleResult');
    } else {
      setNav('map');
    }
  }, []);

  const handleBattleResultContinue = useCallback(() => {
    if (!snapshot) { setNav('map'); return; }
    const nodeSnap = snapshot.state.snapshots[snapshot.currentNodeId];
    const hasRewards =
      nodeSnap?.kind === 'REWARD' &&
      (nodeSnap as { rewardIds: readonly string[] }).rewardIds.length > 0;
    if (hasRewards) {
      setNav('reward');
    } else {
      setNav('map');
    }
  }, [snapshot]);

  const handleRewardDone = useCallback(() => { setNav('map'); }, []);

  const handleFinish = useCallback((result: 'end' | 'defeat') => {
    setNav(result);
  }, []);

  const handleReturnToMenu = useCallback(() => { setNav('menu'); }, []);
  const handleOpenHq = useCallback(() => { setNav('hq'); }, []);
  const handleSettings = useCallback(() => { setNav('settings'); }, []);

  const handleHqNavigate = useCallback((section: HqSection) => {
    switch (section) {
      case 'missions':     setNav('missions'); break;
      case 'heroHall':     setNav('heroHall'); break;
      case 'barracks':     setNav('barracks'); break;
      case 'workshop':     setNav('workshop'); break;
      case 'archive':      setNav('archive'); break;
      case 'mastery':      setNav('mastery'); break;
      case 'achievements': setNav('achievements'); break;
      case 'riftChamber':  setNav('riftChamber'); break;
      case 'ascension':    setNav('ascension'); break;
      case 'constellation':setNav('constellation'); break;
      case 'cyclePreparation': setNav('cyclePreparation'); break;
      case 'beyondSetup': setNav('beyondSetup'); break;
      case 'endlessSetup': setNav('endlessSetup'); break;
      case 'equipment':   setNav('equipment'); break;
      case 'kits':         setNav('kits'); break;
      case 'banners':      setNav('banners'); break;
      case 'formation':    setNav('formation'); break;
      case 'help':         setNav('help'); break;
    }
  }, []);

  const handleHeroSelect = useCallback((heroId: string) => {
    setNav({ kind: 'heroDetail', heroId });
  }, []);

  const handleTroopSelect = useCallback((troopTypeId: string) => {
    setNav({ kind: 'troopDetail', troopTypeId });
  }, []);

  const handleItemSelect = useCallback((itemId: string) => {
    setNav({ kind: 'itemDetail', itemId });
  }, []);

  // Phase 35 handlers
  const handleArchiveNavigate = useCallback((section: ArchiveSection) => {
    switch (section) {
      case 'codexList':    setNav('codexList'); break;
      case 'storyArchive': setNav('storyArchive'); break;
      case 'records':      setNav('records'); break;
      case 'achievements': setNav('achievements'); break;
    }
  }, []);

  const handleCodexEntrySelect = useCallback((entryId: string) => {
    setNav({ kind: 'codexDetail', entryId });
  }, []);

  // -- Render based on nav state --

  if (nav === 'map') {
    return renderRegisteredScreen('dungeonMap', { onEnterNode: handleEnterNode, onFinish: handleFinish, onBack: handleMenu });
  }

  if (typeof nav === 'object' && nav.kind === 'node') {
    return renderRegisteredScreen('nodePreview', { onResolved: handleNodeResolved, nextHint: nav.nextAfterResolve });
  }

  if (nav === 'battleResult') {
    return renderRegisteredScreen('battleResult', { onContinue: handleBattleResultContinue });
  }

  if (nav === 'reward') {
    return renderRegisteredScreen('rewardChoice', { onDone: handleRewardDone });
  }

  if (nav === 'end') {
    return renderRegisteredScreen('expeditionEnd', { onReturn: handleReturnToMenu, missionId: activeMissionId });
  }

  if (nav === 'defeat') {
    return renderRegisteredScreen('defeatRecovery', { onReturn: handleReturnToMenu, missionId: activeMissionId });
  }

  if (nav === 'newGame') {
    return renderRegisteredScreen('newGame', { onLaunched: handleLaunched, onBack: handleMenu });
  }

  if (nav === 'help') {
    return renderRegisteredScreen('globalHelp', { onBack: handleMenu });
  }

  if (nav === 'hq') {
    return renderRegisteredScreen('hqOverview', { onNavigate: handleHqNavigate, onBack: handleMenu });
  }

  if (nav === 'heroHall') {
    return renderRegisteredScreen('heroHall', { onSelect: handleHeroSelect, onBack: () => { setNav('hq'); } });
  }

  if (typeof nav === 'object' && nav.kind === 'heroDetail') {
    return renderRegisteredScreen('heroDetails', { heroId: nav.heroId, onBack: () => { setNav('heroHall'); } });
  }

  if (nav === 'barracks') {
    return renderRegisteredScreen('barracks', { onSelect: handleTroopSelect, onBack: () => { setNav('hq'); } });
  }

  if (typeof nav === 'object' && nav.kind === 'troopDetail') {
    return renderRegisteredScreen('troopDetails', { troopTypeId: nav.troopTypeId, onBack: () => { setNav('barracks'); } });
  }

  if (nav === 'workshop') {
    return renderRegisteredScreen('workshop', { onSelect: handleItemSelect, onBack: () => { setNav('hq'); } });
  }

  if (typeof nav === 'object' && nav.kind === 'itemDetail') {
    return renderRegisteredScreen('itemDetails', { itemId: nav.itemId, onBack: () => { setNav('workshop'); } });
  }

  if (nav === 'missions') {
    return renderRegisteredScreen('missionBoard', { onSelectMission: handleSelectMission, onBack: handleMenu });
  }

  if (typeof nav === 'object' && nav.kind === 'missionDetail') {
    return renderRegisteredScreen('missionDetails', {
      mission: nav.mission,
      onLaunched: handleLaunched,
      onBack: () => { setNav('missions'); },
    });
  }

  // Phase 35
  if (nav === 'archive') {
    return renderRegisteredScreen('archiveHub', { onNavigate: handleArchiveNavigate, onBack: () => { setNav('hq'); } });
  }

  if (nav === 'codexList') {
    return renderRegisteredScreen('codexList', { onSelectEntry: handleCodexEntrySelect, onBack: () => { setNav('archive'); } });
  }

  if (typeof nav === 'object') {
    return renderRegisteredScreen('codexDetails', { entryId: nav.entryId, onBack: () => { setNav('codexList'); } });
  }

  if (nav === 'mastery') {
    return renderRegisteredScreen('mastery', { onBack: () => { setNav('hq'); } });
  }

  if (nav === 'achievements') {
    return renderRegisteredScreen('achievements', { onBack: () => { setNav('hq'); } });
  }

  if (nav === 'records') {
    return renderRegisteredScreen('recordsStatistics', { onBack: () => { setNav('archive'); } });
  }

  if (nav === 'storyArchive') {
    return renderRegisteredScreen('storyArchive', { onBack: () => { setNav('archive'); } });
  }

  // Phase 36
  if (nav === 'ascension') {
    return renderRegisteredScreen('ascensionRanks', { onBack: () => { setNav('hq'); } });
  }

  if (nav === 'constellation') {
    return renderRegisteredScreen('constellation', { onBack: () => { setNav('hq'); } });
  }

  if (nav === 'riftChamber') {
    return renderRegisteredScreen('riftChamber', { onBack: () => { setNav('hq'); } });
  }

  if (nav === 'cyclePreparation') {
    return renderRegisteredScreen('cyclePreparation', { onBack: () => { setNav('hq'); } });
  }

  if (nav === 'beyondSetup') {
    return renderRegisteredScreen('beyondSetup', { onBack: () => { setNav('hq'); } });
  }

  if (nav === 'endlessSetup') {
    return renderRegisteredScreen('endlessSetup', { onBack: () => { setNav('hq'); } });
  }

  // Phase 37
  if (nav === 'equipment') {
    return renderRegisteredScreen('equipmentPicker', { onBack: () => { setNav('hq'); } });
  }

  if (nav === 'kits') {
    return renderRegisteredScreen('kitPicker', { onBack: () => { setNav('hq'); } });
  }

  if (nav === 'banners') {
    return renderRegisteredScreen('bannerPicker', { onBack: () => { setNav('hq'); } });
  }

  if (nav === 'formation') {
    return renderRegisteredScreen('formationPreview', { onBack: () => { setNav('hq'); } });
  }

  // Phase 39-41: Settings screens
  if (nav === 'settings') {
    return (
      <ScreenFrame labelledBy="settings-title">
        <h1 id="settings-title">Settings</h1>
        <Button label="Audio" variant="secondary" onClick={() => { setNav('audioSettings'); }} />
        <Button label="Accessibility" variant="secondary" onClick={() => { setNav('accessibilitySettings'); }} />
        <Button label="Controls" variant="secondary" onClick={() => { setNav('controlsSettings'); }} />
        <Button label="Graphics" variant="secondary" onClick={() => { setNav('graphicsSettings'); }} />
        <BottomActionBar>
          <Button labelKey="ui.common.back" variant="secondary" onClick={handleMenu} />
        </BottomActionBar>
      </ScreenFrame>
    );
  }

  if (nav === 'audioSettings') {
    return renderRegisteredScreen('audioSettings', { onBack: () => { setNav('settings'); } });
  }

  if (nav === 'accessibilitySettings') {
    return renderRegisteredScreen('accessibilitySettings', { onBack: () => { setNav('settings'); } });
  }

  if (nav === 'controlsSettings') {
    return renderRegisteredScreen('controlsSettings', { onBack: () => { setNav('settings'); } });
  }

  if (nav === 'graphicsSettings') {
    return renderRegisteredScreen('graphicsSettings', { onBack: () => { setNav('settings'); } });
  }

  // 'menu' state.
  if (step === 'FIRST_RUN' && !hasSave) {
    return (
      <ScreenFrame labelledBy="first-run-title">
        <h1 id="first-run-title">Welcome</h1>
        <p>Start your first expedition.</p>
        <Button labelKey="ui.common.start" variant="primary" onClick={handleNewGame} disabled={loading} />
        <Button labelKey="ui.common.help" variant="secondary" onClick={handleHelp} />
        <Button label="Settings" variant="secondary" onClick={handleSettings} />
      </ScreenFrame>
    );
  }

  if (hasSave) {
    return (
      <ScreenFrame labelledBy="continue-title">
        <h1 id="continue-title">Continue</h1>
        <p>You have a saved expedition.</p>
        <Button labelKey="ui.common.continue" variant="primary" onClick={handleContinue} disabled={loading} />
        <Button labelKey="ui.common.new_game" variant="secondary" onClick={handleNewGame} />
        <Button labelKey="ui.common.missions" variant="secondary" onClick={handleMissions} />
        <Button labelKey="ui.common.hq" variant="secondary" onClick={handleOpenHq} />
        <Button labelKey="ui.common.help" variant="secondary" onClick={handleHelp} />
        <Button label="Settings" variant="secondary" onClick={handleSettings} />
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame labelledBy="no-run-title">
      <h1 id="no-run-title">Expedition</h1>
      <p>Start a new expedition.</p>
      <Button labelKey="ui.common.start" variant="primary" onClick={handleNewGame} disabled={loading} />
      <Button labelKey="ui.common.missions" variant="secondary" onClick={handleMissions} />
      <Button labelKey="ui.common.hq" variant="secondary" onClick={handleOpenHq} />
      <Button labelKey="ui.common.help" variant="secondary" onClick={handleHelp} />
    </ScreenFrame>
  );
}
