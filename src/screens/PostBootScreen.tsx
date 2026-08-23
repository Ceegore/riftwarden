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
import { DungeonMapScreen } from './run/DungeonMapScreen.js';
import { NodeScreen } from './run/NodeScreen.js';
import { BattleResultScreen } from './run/BattleResultScreen.js';
import { RewardChoiceScreen } from './run/RewardChoiceScreen.js';
import { ExpeditionEndScreen } from './run/ExpeditionEndScreen.js';
import { DefeatRecoveryScreen } from './run/DefeatRecoveryScreen.js';
import { NewGameScreen } from './hq/NewGameScreen.js';
import { GlobalHelpScreen } from './hq/GlobalHelpScreen.js';
import { MissionBoardScreen } from './hq/MissionBoardScreen.js';
import { MissionDetailsScreen } from './hq/MissionDetailsScreen.js';
import { HqOverviewScreen, type HqSection } from './hq/HqOverviewScreen.js';
import { HeroHallScreen } from './hq/HeroHallScreen.js';
import { HeroDetailsScreen } from './hq/HeroDetailsScreen.js';
import { BarracksScreen } from './hq/BarracksScreen.js';
import { TroopDetailsScreen } from './hq/TroopDetailsScreen.js';
import { WorkshopScreen } from './hq/WorkshopScreen.js';
import { ItemDetailsScreen } from './hq/ItemDetailsScreen.js';
import { ArchiveHubScreen, type ArchiveSection } from './hq/ArchiveHubScreen.js';
import { CodexListScreen } from './hq/CodexListScreen.js';
import { CodexDetailsScreen } from './hq/CodexDetailsScreen.js';
import { MasteryScreen } from './hq/MasteryScreen.js';
import { AchievementsScreen } from './hq/AchievementsScreen.js';
import { RecordsStatisticsScreen } from './hq/RecordsStatisticsScreen.js';
import { StoryArchiveScreen } from './hq/StoryArchiveScreen.js';
import { AscensionRanksScreen } from './hq/AscensionRanksScreen.js';
import { ConstellationScreen } from './hq/ConstellationScreen.js';
import { RiftChamberScreen } from './hq/RiftChamberScreen.js';
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
  | 'riftChamber';

export function PostBootScreen({ step }: { readonly step: Exclude<BootTerminalStep, 'RECOVERY_REQUIRED'> }): JSX.Element {
  const { snapshot, map, hasSave, continueRun, loading } = useExpedition();
  const [nav, setNav] = useState<NavState>(() => (snapshot && map ? 'map' : 'menu'));

  // Sync nav when expedition state changes externally (abandon, restore).
  useEffect(() => {
    if (snapshot && map) {
      if (nav === 'menu') setNav('map');
    } else {
      if (nav !== 'menu') setNav('menu');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, map]);

  const handleNewGame = useCallback(() => setNav('newGame'), []);
  const handleHelp = useCallback(() => setNav('help'), []);
  const handleMissions = useCallback(() => setNav('missions'), []);
  const handleContinue = useCallback(() => { continueRun(); }, [continueRun]);
  const handleMenu = useCallback(() => setNav('menu'), []);

  const handleLaunched = useCallback(() => {
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

  const handleRewardDone = useCallback(() => setNav('map'), []);

  const handleFinish = useCallback((result: 'end' | 'defeat') => {
    setNav(result);
  }, []);

  const handleReturnToMenu = useCallback(() => setNav('menu'), []);
  const handleOpenHq = useCallback(() => setNav('hq'), []);

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
    return <DungeonMapScreen onEnterNode={handleEnterNode} onFinish={handleFinish} onBack={handleMenu} />;
  }

  if (typeof nav === 'object' && nav.kind === 'node') {
    return <NodeScreen onResolved={handleNodeResolved} nextHint={nav.nextAfterResolve} />;
  }

  if (nav === 'battleResult') {
    return <BattleResultScreen onContinue={handleBattleResultContinue} />;
  }

  if (nav === 'reward') {
    return <RewardChoiceScreen onDone={handleRewardDone} />;
  }

  if (nav === 'end') {
    return <ExpeditionEndScreen onReturn={handleReturnToMenu} />;
  }

  if (nav === 'defeat') {
    return <DefeatRecoveryScreen onReturn={handleReturnToMenu} />;
  }

  if (nav === 'newGame') {
    return <NewGameScreen onLaunched={handleLaunched} onBack={handleMenu} />;
  }

  if (nav === 'help') {
    return <GlobalHelpScreen onBack={handleMenu} />;
  }

  if (nav === 'hq') {
    return <HqOverviewScreen onNavigate={handleHqNavigate} onBack={handleMenu} />;
  }

  if (nav === 'heroHall') {
    return <HeroHallScreen onSelect={handleHeroSelect} onBack={() => setNav('hq')} />;
  }

  if (typeof nav === 'object' && nav.kind === 'heroDetail') {
    return <HeroDetailsScreen heroId={nav.heroId} onBack={() => setNav('heroHall')} />;
  }

  if (nav === 'barracks') {
    return <BarracksScreen onSelect={handleTroopSelect} onBack={() => setNav('hq')} />;
  }

  if (typeof nav === 'object' && nav.kind === 'troopDetail') {
    return <TroopDetailsScreen troopTypeId={nav.troopTypeId} onBack={() => setNav('barracks')} />;
  }

  if (nav === 'workshop') {
    return <WorkshopScreen onSelect={handleItemSelect} onBack={() => setNav('hq')} />;
  }

  if (typeof nav === 'object' && nav.kind === 'itemDetail') {
    return <ItemDetailsScreen itemId={nav.itemId} onBack={() => setNav('workshop')} />;
  }

  if (nav === 'missions') {
    return <MissionBoardScreen onSelectMission={handleSelectMission} onBack={handleMenu} />;
  }

  if (typeof nav === 'object' && nav.kind === 'missionDetail') {
    return (
      <MissionDetailsScreen
        mission={nav.mission}
        onLaunched={handleLaunched}
        onBack={() => setNav('missions')}
      />
    );
  }

  // Phase 35
  if (nav === 'archive') {
    return <ArchiveHubScreen onNavigate={handleArchiveNavigate} onBack={() => setNav('hq')} />;
  }

  if (nav === 'codexList') {
    return <CodexListScreen onSelectEntry={handleCodexEntrySelect} onBack={() => setNav('archive')} />;
  }

  if (typeof nav === 'object' && nav.kind === 'codexDetail') {
    return <CodexDetailsScreen entryId={nav.entryId} onBack={() => setNav('codexList')} />;
  }

  if (nav === 'mastery') {
    return <MasteryScreen onBack={() => setNav('hq')} />;
  }

  if (nav === 'achievements') {
    return <AchievementsScreen onBack={() => setNav('hq')} />;
  }

  if (nav === 'records') {
    return <RecordsStatisticsScreen onBack={() => setNav('archive')} />;
  }

  if (nav === 'storyArchive') {
    return <StoryArchiveScreen onBack={() => setNav('archive')} />;
  }

  // Phase 36
  if (nav === 'ascension') {
    return <AscensionRanksScreen onBack={() => setNav('hq')} />;
  }

  if (nav === 'constellation') {
    return <ConstellationScreen onBack={() => setNav('hq')} />;
  }

  if (nav === 'riftChamber') {
    return <RiftChamberScreen onBack={() => setNav('hq')} />;
  }

  // 'menu' state.
  if (step === 'FIRST_RUN') {
    return (
      <ScreenFrame labelledBy="first-run-title">
        <h1 id="first-run-title">Welcome</h1>
        <p>Start your first expedition.</p>
        <Button labelKey="ui.common.start" variant="primary" onClick={handleNewGame} disabled={loading} />
        <Button labelKey="ui.common.help" variant="secondary" onClick={handleHelp} />
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
