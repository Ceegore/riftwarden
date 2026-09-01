import { describe, expect, it } from 'vitest';
import { readJson } from './phase30-helpers.js';
import { ActionLedger } from '../../src/game/app-shell/action-ledger.js';
import { FirstRunFlow, KILL_POINT_ORDER } from '../../src/game/app-shell/first-run.js';
import { DEFAULT_SETTINGS, SettingsSession } from '../../src/game/app-shell/settings-domain.js';

describe('phase30 kill-point matrix', () => {
  const matrix = readJson('fixtures/kill-point-matrix.json') as readonly {
    readonly flow: string;
    readonly point: string;
  }[];

  it('pins the nine kill points across settings-apply and first-run', () => {
    const settingsPoints = matrix.filter((row) => row.flow === 'settings-apply').map((row) => row.point);
    const firstRunPoints = matrix.filter((row) => row.flow === 'first-run').map((row) => row.point);
    expect(settingsPoints).toEqual(['before-temp', 'after-temp', 'before-replace', 'after-replace', 'before-publish']);
    expect(firstRunPoints).toEqual(['before-settings', 'after-settings', 'before-completion', 'after-completion']);
  });

  it('first-run kill points are recorded in canonical order', () => {
    expect(KILL_POINT_ORDER).toEqual(['before-settings', 'after-settings', 'before-completion', 'after-completion']);
  });
});

describe('phase30 first-run flow', () => {
  it('records kill points in order through settings and completion', () => {
    const flow = new FirstRunFlow();
    const session = new SettingsSession(DEFAULT_SETTINGS);
    flow.applySettings(session, { locale: 'en', textScale: 200 });
    expect(flow.state().phase).toBe('settings');
    expect(flow.state().reachedKillPoints).toEqual(['before-settings', 'after-settings']);
    expect(flow.complete(() => undefined)).toBe(true);
    expect(flow.state().phase).toBe('complete');
    expect(flow.state().reachedKillPoints).toEqual([
      'before-settings',
      'after-settings',
      'before-completion',
      'after-completion',
    ]);
    expect(flow.isComplete()).toBe(true);
  });

  it('completion is idempotent: the marker write runs exactly once', () => {
    const flow = new FirstRunFlow();
    let writes = 0;
    expect(flow.complete(() => (writes += 1))).toBe(true);
    expect(flow.complete(() => (writes += 1))).toBe(false);
    expect(flow.complete(() => (writes += 1))).toBe(false);
    expect(writes).toBe(1);
  });

  it('a failing marker write leaves the flow incomplete and retryable', () => {
    const flow = new FirstRunFlow();
    let fail = true;
    const write = (): void => {
      if (fail) throw new Error('storage full');
    };
    expect(() => flow.complete(write)).toThrow('storage full');
    expect(flow.isComplete()).toBe(false);
    expect(flow.state().reachedKillPoints).toEqual(['before-completion']);
    fail = false;
    expect(flow.complete(write)).toBe(true);
    expect(flow.isComplete()).toBe(true);
  });

  it('settings apply is atomic: an invalid commit attempt leaves the session at the baseline', () => {
    const flow = new FirstRunFlow();
    const session = new SettingsSession(DEFAULT_SETTINGS);
    flow.applySettings(session, { locale: 'en' });
    expect(session.effective().revision).toBe(1);
    expect(session.effective().locale).toBe('en');
  });
});

describe('phase30 action ledger', () => {
  it('runs an id once and returns undefined for repeats', () => {
    const ledger = new ActionLedger();
    let n = 0;
    expect(ledger.run('x', () => (n += 1))).toBe(1);
    expect(ledger.run('x', () => (n += 1))).toBeUndefined();
    expect(ledger.run('x', () => (n += 1))).toBeUndefined();
    expect(n).toBe(1);
    expect(ledger.has('x')).toBe(true);
  });

  it('clear allows a confirmed retry', () => {
    const ledger = new ActionLedger();
    let n = 0;
    ledger.run('id', () => (n += 1));
    expect(ledger.has('id')).toBe(true);
    ledger.clear('id');
    expect(ledger.has('id')).toBe(false);
    expect(ledger.run('id', () => (n += 1))).toBe(2);
    expect(n).toBe(2);
  });

  it('distinct ids are independent', () => {
    const ledger = new ActionLedger();
    let n = 0;
    ledger.run('a', () => (n += 1));
    ledger.run('a', () => (n += 1));
    ledger.run('b', () => (n += 1));
    expect(n).toBe(2);
  });
});
