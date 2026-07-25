import { describe, expect, it } from 'vitest';
import { probeRendererCapability } from '../../src/platform/render/capability';

function canvasWith(contexts: Readonly<Record<string, object | null>>): HTMLCanvasElement {
  return {
    getContext: (name: string) => contexts[name] ?? null,
  } as unknown as HTMLCanvasElement;
}

describe('renderer capability', () => {
  it('prefers webgl2', () => {
    expect(
      probeRendererCapability(() => canvasWith({ webgl2: {} })),
    ).toEqual({ kind: 'webgl2', supported: true });
  });

  it('marks webgl1 as validation-required', () => {
    expect(
      probeRendererCapability(() => canvasWith({ webgl: {} })),
    ).toEqual({
      kind: 'webgl1',
      supported: true,
      requiresValidation: true,
    });
  });

  it('never emits a canvas fallback', () => {
    expect(
      probeRendererCapability(() => canvasWith({})),
    ).toEqual({
      kind: 'unavailable',
      supported: false,
      reason: 'context_creation_failed',
    });
  });
});
