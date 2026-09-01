import { describe, expect, it } from 'vitest';
import { catchShellCode, hqArea, readJson } from './phase30-helpers.js';
import { parseRoute, resolveBoot, safeRoute } from '../../src/game/app-shell/route-resolver.js';
import { primaryForClass, resolveContinue, saveClassOf } from '../../src/game/app-shell/continue-resolver.js';
import { validateExternalUrl } from '../../src/game/app-shell/external-link-policy.js';
import { validateHqAreas } from '../../src/game/app-shell/hq-capabilities.js';
import { LOCALES, ROUTE_IDS, TEXT_SCALES } from '../../src/game/app-shell/types.js';

describe('phase30 constants contract', () => {
  const constants = readJson('phase30-constants.json') as {
    readonly contractVersion: number;
    readonly phase: number;
    readonly screenIds: readonly string[];
    readonly languages: readonly string[];
    readonly textScales: readonly number[];
    readonly allowedSchemes: readonly string[];
    readonly gate: string;
    readonly status: string;
  };

  it('pins the app-shell constants', () => {
    expect(constants.contractVersion).toBe(1);
    expect(constants.phase).toBe(30);
    expect(constants.screenIds).toEqual([
      'S02',
      'S03',
      'S04',
      'S05',
      'S06',
      'S07',
      'S08',
      'S10',
      'S60',
      'S61',
      'S62',
      'S63',
      'S64',
      'S65',
    ]);
    expect(constants.languages).toEqual(LOCALES);
    expect(constants.textScales).toEqual(TEXT_SCALES);
    expect(constants.allowedSchemes).toEqual(['https']);
    expect(constants.gate).toBe('G30');
    expect(constants.status).toBe('NOT_PROVEN');
  });

  it('pins the ten route ids', () => {
    expect(ROUTE_IDS).toEqual([
      'first-run',
      'title',
      'new-game',
      'continue',
      'recovery',
      'hq',
      'settings-hub',
      'settings-page',
      'legal-about',
      'help',
    ]);
  });
});

describe('phase30 route matrix', () => {
  const matrix = readJson('fixtures/route-matrix.json') as readonly {
    readonly from: string;
    readonly state: string;
    readonly to: string;
  }[];

  it('pins the four route cases', () => {
    expect(matrix).toHaveLength(4);
    expect(matrix[0]).toEqual({ from: 'boot', state: 'fresh', to: 'first-run' });
    expect(matrix[1]).toEqual({ from: 'boot', state: 'valid-profile', to: 'title' });
    expect(matrix[2]).toEqual({ from: 'title', state: 'run', to: 'continue' });
    expect(matrix[3]).toEqual({ from: 'continue', state: 'corrupt', to: 'recovery' });
  });

  it('resolves boot states per the matrix', () => {
    expect(resolveBoot('fresh').id).toBe('first-run');
    expect(resolveBoot('valid-profile').id).toBe('title');
    expect(resolveBoot('valid-run').id).toBe('title');
    expect(resolveBoot('valid-battle').id).toBe('title');
    expect(resolveBoot('corrupt').id).toBe('recovery');
  });

  it('falls back to title for unknown routes, never blank', () => {
    expect(safeRoute({ id: 'hq' }).id).toBe('hq');
    expect(safeRoute({ id: 'nope' }).id).toBe('title');
    expect(safeRoute(null).id).toBe('title');
    expect(safeRoute(42).id).toBe('title');
    expect(safeRoute({}).id).toBe('title');
    expect(safeRoute({ id: 'title', returnTo: 'hq', focusId: 'f1' })).toEqual({
      version: 1,
      id: 'title',
      returnTo: 'hq',
      focusId: 'f1',
    });
  });

  it('throws strictly for unknown route ids', () => {
    expect(catchShellCode(() => parseRoute({ id: 'nope' }))).toBe('UNKNOWN_ROUTE_ID');
    expect(catchShellCode(() => parseRoute({ id: 'hq' }))).toBeNull();
    expect(catchShellCode(() => parseRoute(null))).toBeNull();
  });
});

describe('phase30 continue-save matrix', () => {
  const matrix = readJson('fixtures/continue-save-matrix.json') as readonly {
    readonly id: string;
    readonly primary: string;
  }[];

  it('pins the five save classes with primaries', () => {
    expect(matrix).toHaveLength(5);
    expect(matrix[0]).toEqual({ id: 'none', primary: 'new-game' });
    expect(matrix[1]).toEqual({ id: 'profile', primary: 'continue-hq' });
    expect(matrix[2]).toEqual({ id: 'run', primary: 'continue-run' });
    expect(matrix[3]).toEqual({ id: 'battle', primary: 'resume-battle' });
    expect(matrix[4]).toEqual({ id: 'corrupt', primary: 'recovery' });
  });

  it('maps every matrix class to its pinned primary', () => {
    for (const row of matrix) {
      expect(primaryForClass(saveClassOf(row.id))).toBe(row.primary);
    }
  });

  it('resolves presence flags by priority battle > run > profile > recovery > none', () => {
    expect(resolveContinue({ battleSnapshot: false, run: false, profile: false, corrupt: false })).toEqual({
      primary: 'new-game',
      class: 'none',
    });
    expect(resolveContinue({ battleSnapshot: false, run: false, profile: true, corrupt: false })).toEqual({
      primary: 'continue-hq',
      class: 'profile',
    });
    expect(resolveContinue({ battleSnapshot: false, run: true, profile: true, corrupt: false })).toEqual({
      primary: 'continue-run',
      class: 'run',
    });
    expect(resolveContinue({ battleSnapshot: true, run: true, profile: true, corrupt: false })).toEqual({
      primary: 'resume-battle',
      class: 'battle',
    });
    expect(resolveContinue({ battleSnapshot: true, run: true, profile: true, corrupt: true })).toEqual({
      primary: 'recovery',
      class: 'corrupt',
    });
  });

  it('rejects unknown save classes', () => {
    expect(catchShellCode(() => saveClassOf('cloud'))).toBe('CONTINUE_UNKNOWN_SAVE_CLASS');
  });
});

describe('phase30 external link cases', () => {
  const cases = readJson('fixtures/external-link-cases.json') as readonly {
    readonly url: string;
    readonly release?: boolean;
    readonly allowed: boolean;
  }[];

  const policy = { allowedHosts: ['approved.example.com', 'support.riftwarden-game.com'], release: true };

  it('pins the four link cases', () => {
    expect(cases).toHaveLength(4);
    expect(cases[0]).toEqual({ url: 'https://support.example.invalid', release: false, allowed: false });
    expect(cases[1]).toEqual({ url: 'http://example.com', allowed: false });
    expect(cases[2]).toEqual({ url: 'javascript:alert(1)', allowed: false });
    expect(cases[3]).toEqual({ url: 'https://approved.example.com/privacy', allowed: true });
  });

  it('applies the security policy per case', () => {
    // https to a non-allowlisted host is refused (even in dev).
    const c0 = cases[0];
    if (c0 === undefined) throw new Error('missing case 0');
    expect(catchShellCode(() => validateExternalUrl(c0.url, policy))).toBe('LINK_HOST_REFUSED');
    // http is refused at the scheme step.
    const c1 = cases[1];
    if (c1 === undefined) throw new Error('missing case 1');
    expect(catchShellCode(() => validateExternalUrl(c1.url, policy))).toBe('LINK_SCHEME_REFUSED');
    // javascript: is refused at the scheme step.
    const c2 = cases[2];
    if (c2 === undefined) throw new Error('missing case 2');
    expect(catchShellCode(() => validateExternalUrl(c2.url, policy))).toBe('LINK_SCHEME_REFUSED');
    // approved host passes in dev (the fixture pins no release flag) and returns the URL.
    const c3 = cases[3];
    if (c3 === undefined) throw new Error('missing case 3');
    const url = validateExternalUrl(c3.url, { ...policy, release: false });
    expect(url.protocol).toBe('https:');
    expect(url.hostname).toBe('approved.example.com');
  });

  it('release mode refuses placeholder hosts even when allowlisted', () => {
    expect(
      catchShellCode(() => validateExternalUrl('https://approved.example.com/placeholder/test', policy)),
    ).toBe('LINK_PLACEHOLDER_REFUSED');
  });

  it('refuses unparseable urls', () => {
    expect(catchShellCode(() => validateExternalUrl('not a url', policy))).toBe('LINK_SCHEME_REFUSED');
  });
});

describe('phase30 HQ capability fixture', () => {
  const fixture = readJson('fixtures/hq-capabilities.json') as readonly {
    readonly id: string;
    readonly state: string;
    readonly reasonKey?: string;
  }[];

  it('pins the six HQ areas with locked reasons', () => {
    expect(fixture).toHaveLength(6);
    expect(fixture[0]).toEqual({ id: 'heroes', state: 'locked', reasonKey: 'hq.locked.phase31' });
    expect(fixture[4]).toEqual({ id: 'expedition', state: 'available' });
    expect(fixture[5]).toEqual({ id: 'settings', state: 'available' });
  });

  it('validates the pinned fixture as a full registry', () => {
    const areas = fixture.map((row) =>
      hqArea(row.id, row.state as 'available' | 'locked', row.reasonKey !== undefined ? { reasonKey: row.reasonKey } : {}),
    );
    expect(() => {
      validateHqAreas(areas);
    }).not.toThrow();
  });

  it('rejects wrong counts, missing routes and reasonless locks', () => {
    const good = fixture.map((row) =>
      hqArea(row.id, row.state as 'available' | 'locked', row.reasonKey !== undefined ? { reasonKey: row.reasonKey } : {}),
    );
    expect(catchShellCode(() => {
      validateHqAreas(good.slice(0, 5));
    })).toBe('HQ_AREA_COUNT');
    const noRoute = good.map((area) => ({ ...area, routeId: '' }));
    expect(catchShellCode(() => {
      validateHqAreas(noRoute);
    })).toBe('HQ_AREA_MISSING_ROUTE');
    const noReason = good.map((area) => ({ ...area, state: 'locked', reasonKey: undefined } as unknown as typeof area));
    expect(catchShellCode(() => {
      validateHqAreas(noReason);
    })).toBe('HQ_AREA_LOCKED_WITHOUT_REASON');
  });

  it('rejects duplicate ids within a full registry', () => {
    const dup: Parameters<typeof validateHqAreas>[0] = [
      hqArea('a', 'available'),
      hqArea('a', 'locked'),
      hqArea('b', 'locked'),
      hqArea('c', 'locked'),
      hqArea('d', 'locked'),
      hqArea('e', 'locked'),
    ];
    expect(catchShellCode(() => {
      validateHqAreas(dup);
    })).toBe('HQ_AREA_DUPLICATE');
  });
});
