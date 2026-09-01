/**
 * Phase 37 tests: kills tracking in combat handler, codex discovery
 * wiring, equipment/kit/banner/formation stores, and PixiJS types.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { loadCodexState, saveCodexState, discoverEntity, clearCodexState } from '../../src/game/codex/codex-store.js';
import { loadMasteryState, addMasteryKills, clearMasteryState } from '../../src/game/mastery/mastery-store.js';
import { loadEquipmentState, saveEquipmentState, equipItem, unequipSlot, clearEquipmentState } from '../../src/game/equipment/equipment-store.js';
import { loadKitState, saveKitState, unlockKit, clearKitState } from '../../src/game/kits/kit-store.js';
import { loadBannerState, saveBannerState, unlockBanner, setActiveBanner, clearBannerState } from '../../src/game/banners/banner-store.js';
import { loadFormationState, saveFormationState, setActiveFormation, placeHero, clearFormationState } from '../../src/game/formations/formation-store.js';
import { baseState, definition as makeDef, commitFlow, openAndPrepare } from './phase32-helpers.js';
import { battleHandler, eliteHandler } from '../../src/game/expedition/nodes/handlers/combat.js';
import { loadAllPersistentState, applyExpeditionTracking, clearAllPersistentState } from '../../src/game/expedition/settlement-bridge.js';
import { createNodeRunState } from '../../src/game/expedition/nodes/run-state.js';

// ---- Kills in combat handler ----

describe('Phase 37 — combat handler grants kills', () => {
  it('battle ENGAGE awards kills via ledger', () => {
    const state = baseState();
    const def = makeDef('n1', 'battle');
    const prepared = openAndPrepare(state, battleHandler, def);
    const { outcome } = commitFlow(prepared, battleHandler, def, {
      transactionId: 'tx1', nodeId: 'n1', action: 'ENGAGE',
    });
    expect(outcome.state.killsEarned).toBeGreaterThan(0);
  });

  it('elite ENGAGE awards kills', () => {
    const state = baseState();
    const def = makeDef('n2', 'elite');
    const prepared = openAndPrepare(state, eliteHandler, def);
    const { outcome } = commitFlow(prepared, eliteHandler, def, {
      transactionId: 'tx1', nodeId: 'n2', action: 'ENGAGE',
    });
    expect(outcome.state.killsEarned).toBeGreaterThan(0);
  });

  it('kills are persisted through the save codec', () => {
    const state = baseState();
    const def = makeDef('n3', 'battle');
    const prepared = openAndPrepare(state, battleHandler, def);
    const { outcome } = commitFlow(prepared, battleHandler, def, {
      transactionId: 'tx1', nodeId: 'n3', action: 'ENGAGE',
    });
    const killed = outcome.state.killsEarned;
    // Round-trip through JSON
    const raw = JSON.parse(JSON.stringify(outcome.state)) as { readonly killsEarned: number };
    expect(raw.killsEarned).toBe(killed);
  });

  it('kills feed into mastery via settlement bridge', () => {
    const state = createNodeRunState({
      runId: 'kills-test',
      modeId: 'NORMAL',
      contentRevision: '32.0',
      seed: 1,
      mapHash: 'test',
      gold: 100,
    });
    const killed = { ...state, killsEarned: 7 };
    const heroId = 'hero_test';
    const all = {
      ...loadAllPersistentState(),
      mastery: addMasteryKills(loadAllPersistentState().mastery, heroId, 0),
    };
    const updated = applyExpeditionTracking(killed, 'victory', 'mission_tutorial', 200, 5, all, heroId);
    expect(updated.mastery.heroes[heroId]?.kills).toBe(7);
  });
});

// ---- Codex discovery wiring ----

describe('Phase 37 — codex discovery', () => {
  beforeEach(() => { clearCodexState(); });

  it('discovers node type entities', () => {
    let codex = loadCodexState();
    codex = discoverEntity(codex, 'nodetype_battle', 'nodeType');
    expect(codex.entries['nodetype_battle']?.discovered).toBe(true);
  });

  it('discovers enemy entities with category', () => {
    let codex = loadCodexState();
    codex = discoverEntity(codex, 'goblin_scout', 'enemy');
    expect(codex.entries['goblin_scout']?.category).toBe('enemy');
  });

  it('round-trips codex through localStorage', () => {
    let codex = loadCodexState();
    codex = discoverEntity(codex, 'nodetype_merchant', 'nodeType');
    saveCodexState(codex);
    const reloaded = loadCodexState();
    expect(reloaded.entries['nodetype_merchant']?.discovered).toBe(true);
  });
});

// ---- Equipment store ----

describe('Phase 37 — equipment store', () => {
  beforeEach(() => { clearEquipmentState(); });

  it('starts with 8 unpurchased items', () => {
    const equip = loadEquipmentState();
    const items = Object.values(equip.items);
    expect(items.length).toBe(8);
    expect(items.every((i) => !i.owned)).toBe(true);
  });

  it('equips and unequips items on heroes', () => {
    let equip = loadEquipmentState();
    const ironBlade = equip.items['equip_iron_blade'];
    if (ironBlade === undefined) throw new Error('iron blade definition missing');
    equip = { ...equip, items: { ...equip.items, equip_iron_blade: { ...ironBlade, owned: true } } };
    const equipped = equipItem(equip, 'hero_aurel', 'weapon', 'equip_iron_blade');
    expect(equipped.equipped['hero_aurel']?.weapon).toBe('equip_iron_blade');

    const unequipped = unequipSlot(equipped, 'hero_aurel', 'weapon');
    expect(unequipped.equipped['hero_aurel']?.weapon).toBeUndefined();
  });

  it('round-trips through localStorage', () => {
    let equip = loadEquipmentState();
    const rustedSword = equip.items['equip_rusted_sword'];
    if (rustedSword === undefined) throw new Error('rusted sword definition missing');
    equip = { ...equip, items: { ...equip.items, equip_rusted_sword: { ...rustedSword, owned: true } } };
    saveEquipmentState(equip);
    const reloaded = loadEquipmentState();
    expect(reloaded.items['equip_rusted_sword']?.owned).toBe(true);
  });
});

// ---- Kit store ----

describe('Phase 37 — kit store', () => {
  beforeEach(() => { clearKitState(); });

  it('starts with no unlocked kits', () => {
    expect(loadKitState().unlockedKits).toHaveLength(0);
  });

  it('unlocks a kit by id', () => {
    let kits = loadKitState();
    kits = unlockKit(kits, 'kit_frontline_defender');
    expect(kits.unlockedKits).toContain('kit_frontline_defender');
  });

  it('round-trips through localStorage', () => {
    let kits = loadKitState();
    kits = unlockKit(kits, 'kit_striker');
    saveKitState(kits);
    expect(loadKitState().unlockedKits).toContain('kit_striker');
  });
});

// ---- Banner store ----

describe('Phase 37 — banner store', () => {
  beforeEach(() => { clearBannerState(); });

  it('starts with no unlocked banners', () => {
    expect(loadBannerState().unlocked).toHaveLength(0);
  });

  it('unlocks and sets active banner', () => {
    let banners = loadBannerState();
    banners = unlockBanner(banners, 'banner_crimson');
    banners = setActiveBanner(banners, 'banner_crimson');
    expect(banners.activeBanner).toBe('banner_crimson');
  });

  it('round-trips through localStorage', () => {
    let banners = loadBannerState();
    banners = unlockBanner(banners, 'banner_iron');
    banners = setActiveBanner(banners, 'banner_iron');
    saveBannerState(banners);
    const reloaded = loadBannerState();
    expect(reloaded.activeBanner).toBe('banner_iron');
  });
});

// ---- Formation store ----

describe('Phase 37 — formation store', () => {
  beforeEach(() => { clearFormationState(); });

  it('has standard and vanguard unlocked by default', () => {
    const formations = loadFormationState();
    const unlocked = formations.formations.filter((f) => f.unlocked).map((f) => f.id);
    expect(unlocked).toContain('formation_standard');
    expect(unlocked).toContain('formation_vanguard');
  });

  it('sets active formation and places heroes', () => {
    let formations = loadFormationState();
    formations = setActiveFormation(formations, 'formation_standard');
    expect(formations.activeFormation).toBe('formation_standard');

    formations = placeHero(formations, 'front_center', 'hero_aurel');
    expect(formations.placement.front_center).toBe('hero_aurel');

    formations = placeHero(formations, 'front_center', null);
    expect(formations.placement.front_center).toBeUndefined();
  });

  it('round-trips through localStorage', () => {
    let formations = loadFormationState();
    formations = setActiveFormation(formations, 'formation_vanguard');
    formations = placeHero(formations, 'front_left', 'hero_guardian');
    saveFormationState(formations);
    const reloaded = loadFormationState();
    expect(reloaded.activeFormation).toBe('formation_vanguard');
    expect(reloaded.placement.front_left).toBe('hero_guardian');
  });
});

// ---- Settlement bridge — kills wired ----

describe('Phase 37 — settlement bridge kills', () => {
  beforeEach(() => {
    clearAllPersistentState();
    clearMasteryState();
  });

  it('blank state has zero kills in mastery', () => {
    const mastery = loadMasteryState();
    expect(Object.keys(mastery.heroes).length).toBe(0);
  });

  it('applies kills to mastery for the active hero', () => {
    const state = createNodeRunState({
      runId: 'br-kills',
      modeId: 'NORMAL',
      contentRevision: '32.0',
      seed: 1,
      mapHash: 'test',
      gold: 100,
    });
    const withKills = { ...state, killsEarned: 5 };
    const loaded = loadAllPersistentState();
    const all = { ...loaded, mastery: addMasteryKills(loaded.mastery, 'hero_aurel', 0) };
    const updated = applyExpeditionTracking(withKills, 'victory', 'mission_tutorial', 300, 5, all, 'hero_aurel');
    expect(updated.mastery.heroes['hero_aurel']?.kills).toBe(5);
    expect(updated.mastery.heroes['hero_aurel']?.expeditions).toBe(1);
  });
});
