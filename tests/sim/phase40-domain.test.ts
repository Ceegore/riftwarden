/**
 * Phase 40 domain tests: a11y settings, focus graph, input registry, touch enforcer.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { loadA11ySettings, saveA11ySettings, updateA11ySettings, colorBlindCssFilter } from '../../src/game/settings/a11y-settings.js';
import type { A11ySettings } from '../../src/game/settings/a11y-settings.js';
import { buildFocusGraph, resolveNextFocus, trapGroupNodes } from '../../src/ui/focus/focus-graph.js';
import type { FocusNode } from '../../src/ui/focus/focus-graph.js';
import { InputRegistry } from '../../src/platform/input/input-registry.js';
import { validateTouchTarget, validateTouchSpacing } from '../../src/ui/touch/touch-target-enforcer.js';
import type { TouchTarget } from '../../src/ui/touch/touch-target-enforcer.js';

describe('a11y settings', () => {
  beforeEach(() => { localStorage.clear(); });

  it('loads defaults when nothing stored', () => {
    const s = loadA11ySettings();
    expect(s.textScale).toBe(100);
    expect(s.reducedMotion).toBe(false);
    expect(s.highContrast).toBe(false);
    expect(s.screenReaderMode).toBe(false);
    expect(s.colorBlindFilter).toBe('none');
    expect(s.touchTargetSize).toBe('normal');
  });

  it('persists and loads', () => {
    const original: A11ySettings = {
      textScale: 150, reducedMotion: true, highContrast: true,
      screenReaderMode: true, colorBlindFilter: 'deuteranopia',
      touchTargetSize: 'large', stickyKeys: true, inputRepeatDelay: 500,
    };
    saveA11ySettings(original);
    const loaded = loadA11ySettings();
    expect(loaded.textScale).toBe(150);
    expect(loaded.reducedMotion).toBe(true);
    expect(loaded.colorBlindFilter).toBe('deuteranopia');
  });

  it('survives corrupt storage', () => {
    localStorage.setItem('rw.a11y.v1', '{borken');
    const s = loadA11ySettings();
    expect(s.textScale).toBe(100);
  });

  it('updateA11ySettings patches partial changes', () => {
    const current = loadA11ySettings();
    const next = updateA11ySettings(current, { textScale: 200, reducedMotion: true });
    expect(next.textScale).toBe(200);
    expect(next.reducedMotion).toBe(true);
    expect(next.highContrast).toBe(false);
  });

  it('rejects invalid text scale values', () => {
    const current = loadA11ySettings();
    const next = updateA11ySettings(current, { textScale: 99 as unknown as 125 });
    expect(next.textScale).toBe(100);
  });

  it('returns correct CSS filter strings', () => {
    expect(colorBlindCssFilter('none')).toBe('none');
    expect(colorBlindCssFilter('protanopia')).toContain('url');
    expect(colorBlindCssFilter('deuteranopia')).toContain('url');
    expect(colorBlindCssFilter('tritanopia')).toContain('url');
  });
});

describe('focus graph', () => {
  const nodes: readonly FocusNode[] = [
    { id: 'a', nextId: 'b', rightId: 'b' },
    { id: 'b', nextId: 'c', prevId: 'a', leftId: 'a' },
    { id: 'c', prevId: 'b', trapGroup: 'modal' },
  ];

  it('builds a valid graph', () => {
    const graph = buildFocusGraph(nodes, 'a');
    expect(graph.nodes).toHaveLength(3);
    expect(graph.defaultFocusId).toBe('a');
  });

  it('rejects default not in graph', () => {
    expect(() => buildFocusGraph(nodes, 'x')).toThrow();
  });

  it('resolves forward navigation', () => {
    const graph = buildFocusGraph(nodes, 'a');
    expect(resolveNextFocus(graph, 'a', 'forward')).toBe('b');
    expect(resolveNextFocus(graph, 'b', 'forward')).toBe('c');
    expect(resolveNextFocus(graph, 'c', 'forward')).toBeNull();
  });

  it('resolves backward navigation', () => {
    const graph = buildFocusGraph(nodes, 'a');
    expect(resolveNextFocus(graph, 'b', 'backward')).toBe('a');
  });

  it('resolves directional navigation', () => {
    const graph = buildFocusGraph(nodes, 'a');
    expect(resolveNextFocus(graph, 'a', 'right')).toBe('b');
    expect(resolveNextFocus(graph, 'b', 'left')).toBe('a');
  });

  it('returns null for unknown node', () => {
    const graph = buildFocusGraph(nodes, 'a');
    expect(resolveNextFocus(graph, 'x', 'forward')).toBeNull();
  });

  it('finds trap group nodes', () => {
    const graph = buildFocusGraph(nodes, 'a');
    const trapped = trapGroupNodes(graph, 'modal');
    expect(trapped).toHaveLength(1);
    expect(trapped[0]).toBe('c');
  });
});

describe('input registry', () => {
  const reg = new InputRegistry();

  function keyEvent(key: string, shiftKey = false): KeyboardEvent {
    return { key, shiftKey } as KeyboardEvent;
  }

  it('resolves keyboard Enter as confirm', () => {
    expect(reg.resolveKeyEvent(keyEvent('Enter'))).toBe('confirm');
  });

  it('resolves Escape as back', () => {
    expect(reg.resolveKeyEvent(keyEvent('Escape'))).toBe('back');
  });

  it('resolves ArrowUp as up', () => {
    expect(reg.resolveKeyEvent(keyEvent('ArrowUp'))).toBe('up');
  });

  it('resolves Tab as nextTab', () => {
    expect(reg.resolveKeyEvent(keyEvent('Tab'))).toBe('nextTab');
  });

  it('does not resolve unknown keys', () => {
    expect(reg.resolveKeyEvent(keyEvent('F5'))).toBeNull();
  });

  it('resolves gamepad button 0 as confirm', () => {
    expect(reg.resolveGamepadButton(0)).toBe('confirm');
  });

  it('resolves gamepad button 1 as back', () => {
    expect(reg.resolveGamepadButton(1)).toBe('back');
  });

  it('shouldFire enforces double-tap prevention', () => {
    expect(reg.shouldFire('confirm', 0)).toBe(true);
    expect(reg.shouldFire('confirm', 100)).toBe(false);
    expect(reg.shouldFire('confirm', 400)).toBe(true);
  });

  it('resetCooldown allows immediate re-fire', () => {
    reg.shouldFire('confirm', 0);
    reg.resetCooldown('confirm');
    expect(reg.shouldFire('confirm', 10)).toBe(true);
  });

  it('directional actions allow rapid repeat', () => {
    expect(reg.shouldFire('up', 0)).toBe(true);
    expect(reg.shouldFire('up', 50)).toBe(true);
  });
});

describe('touch target enforcer', () => {
  const normal: TouchTarget = { id: 'btn-1', x: 100, y: 100, w: 44, h: 44 };
  const small: TouchTarget = { id: 'btn-2', x: 200, y: 200, w: 30, h: 30 };

  it('accepts min-sized targets', () => {
    expect(validateTouchTarget(normal, 'normal')).toBeNull();
    expect(validateTouchTarget({ ...normal, w: 48, h: 48 }, 'large')).toBeNull();
  });

  it('rejects undersized targets', () => {
    const result = validateTouchTarget(small, 'normal');
    expect(result).not.toBeNull();
    expect(result).toContain('btn-2');
  });

  it('detects overlapping targets', () => {
    const a: TouchTarget = { id: 'a', x: 0, y: 0, w: 50, h: 50 };
    const b: TouchTarget = { id: 'b', x: 10, y: 10, w: 50, h: 50 };
    const result = validateTouchSpacing(a, b);
    expect(result).not.toBeNull();
    expect(result).toContain('overlap');
  });

  it('detects insufficient horizontal spacing', () => {
    const a: TouchTarget = { id: 'a', x: 0, y: 0, w: 50, h: 50 };
    const b: TouchTarget = { id: 'b', x: 52, y: 0, w: 50, h: 50 };
    const result = validateTouchSpacing(a, b);
    expect(result).not.toBeNull();
    expect(result).toContain('horizontal spacing');
  });

  it('accepts well-spaced targets', () => {
    const a: TouchTarget = { id: 'a', x: 0, y: 0, w: 50, h: 50 };
    const b: TouchTarget = { id: 'b', x: 60, y: 60, w: 50, h: 50 };
    expect(validateTouchSpacing(a, b)).toBeNull();
  });
});