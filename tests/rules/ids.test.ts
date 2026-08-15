import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseContentId,
  parseScreenId,
  parseKnownEntityId,
  contentTypeOf,
  compareStableIds,
  contentLocalizationKey,
  uiLocalizationKey,
  assertGlobalIdUniqueness,
  SCREEN_IDS,
} from '../../src/game/rules/ids';

const here = path.dirname(fileURLToPath(import.meta.url));
const c = JSON.parse(readFileSync(path.join(here, '..', '..', 'contracts', 'rules', 'screen-ids.json'), 'utf8')) as {
  screens: string[];
  overlays: string[];
};

describe('content IDs', () => {
  for (const id of ['hero_ardyn', 'ability_shield_wall', 'audio_battle_start']) {
    it(`valid content ${id}`, () => {
      expect(parseContentId(id)).toBe(id);
    });
  }
  for (const id of ['Hero_ardyn', 'hero_Ärdyn', 'hero-ardyn', 'unknown_ardyn', 'hero_', '_hero']) {
    it(`invalid content ${id}`, () => {
      expect(() => parseContentId(id)).toThrow();
    });
  }
  it('content type', () => {
    expect(contentTypeOf('talisman_morning_seed')).toBe('talisman');
  });
});

describe('stable ordering', () => {
  it('compares without locale', () => {
    expect(compareStableIds('a', 'b')).toBe(-1);
    expect(compareStableIds('b', 'a')).toBe(1);
    expect(compareStableIds('a', 'a')).toBe(0);
  });
});

describe('screen IDs', () => {
  it('all semantic screens closed', () => {
    expect(SCREEN_IDS.length).toBe(c.screens.length + c.overlays.length);
    for (const s of [...c.screens, ...c.overlays]) expect(parseScreenId(s)).toBe(s);
  });
  it('numeric alias rejected', () => {
    expect(() => parseScreenId('S03')).toThrow();
  });
  it('unknown screen rejected', () => {
    expect(() => parseScreenId('notAScreen')).toThrow();
  });
});

describe('entity IDs', () => {
  it('known entity accepted', () => {
    expect(parseKnownEntityId('battle_entity_1', new Set(['battle_entity_1']))).toBe('battle_entity_1');
  });
  it('unknown entity rejected', () => {
    expect(() => parseKnownEntityId('battle_entity_1', new Set())).toThrow();
  });
  it('content-looking entity rejected', () => {
    expect(() => parseKnownEntityId('hero_ardyn', new Set(['hero_ardyn']))).toThrow();
  });
});

describe('localization keys', () => {
  it('content locale key', () => {
    expect(contentLocalizationKey(parseContentId('hero_ardyn'), 'name')).toBe('content.hero.hero_ardyn.name');
  });
  it('ui locale key', () => {
    expect(uiLocalizationKey(parseScreenId('title'), 'continue_button')).toBe('ui.title.continue_button');
  });
});

describe('global uniqueness', () => {
  it('duplicate IDs block', () => {
    expect(() => {
      assertGlobalIdUniqueness(['hero_a', 'hero_a']);
    }).toThrow();
  });
  it('unique IDs pass', () => {
    expect(() => {
      assertGlobalIdUniqueness(['hero_a', 'troop_a']);
    }).not.toThrow();
  });
});
