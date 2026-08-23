/**
 * Global help screen (S08): scrollable game mechanics reference.
 * Covers nodes, instability, loot, retreat, and defeat rules.
 */
import type { JSX } from 'react';
import { Button } from '../../ui/components/Button.js';
import { ScreenFrame } from '../../ui/layout/ScreenFrame.js';
import { BottomActionBar } from '../../ui/layout/BottomActionBar.js';
import { ScrollRegion } from '../../ui/layout/ScrollRegion.js';

export interface GlobalHelpScreenProps {
  readonly onBack: () => void;
}

const SECTIONS: readonly { readonly title: string; readonly body: string }[] = [
  {
    title: 'Expedition Map',
    body: 'Each expedition has 6 levels. You advance through nodes: battles, events, merchants, treasures, workshops, altars, scouts, recruitment posts, anchor points, and story beats. The final node is always a boss.',
  },
  {
    title: 'Nodes',
    body: 'Every node has a type that determines what actions you can take. Combat nodes (battle, elite, boss) let you engage enemies for gold and loot. Non-combat nodes offer unique choices: buy at merchants, recruit troops, take treasure, polish items at workshops, sacrifice at altars, or scout ahead.',
  },
  {
    title: 'Instability',
    body: 'Instability rises each time you enter a node. Different node types add different amounts. If instability reaches 100, your expedition ends in defeat. Anchor points reduce instability significantly.',
  },
  {
    title: 'Gold & Loot',
    body: 'Gold is earned from battles and events. Loot items are either secured (saved at anchor points) or unsecured (lost on defeat). Spend gold at merchants and workshops. Unsecured loot becomes secured at anchor points.',
  },
  {
    title: 'Retreat',
    body: 'At an anchor point, you can retreat voluntarily. You keep all secured loot and a portion of your gold. Retreat is always an option — no run is a death march.',
  },
  {
    title: 'Defeat',
    body: 'If your party is defeated (instability reaches 100 or you lose a battle), you keep your secured loot and 60% of the gold you earned during the expedition. Unsecured loot is lost.',
  },
  {
    title: 'Victory',
    body: 'Defeat the boss to win the expedition. You keep all gold and all loot — secured and unsecured. Victory also unlocks harder missions and rewards relics and recruits.',
  },
  {
    title: 'Missions',
    body: 'Missions determine the expedition profile: difficulty, gold multiplier, and instability rate. Complete easier missions to unlock harder ones with better rewards.',
  },
];

export function GlobalHelpScreen({ onBack }: GlobalHelpScreenProps): JSX.Element {
  return (
    <ScreenFrame labelledBy="help-title">
      <h1 id="help-title">How to Play</h1>
      <ScrollRegion label="Help content">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </section>
        ))}
      </ScrollRegion>
      <BottomActionBar>
        <Button labelKey="ui.common.back" variant="secondary" onClick={onBack} />
      </BottomActionBar>
    </ScreenFrame>
  );
}
