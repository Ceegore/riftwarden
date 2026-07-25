export type RendererCapability =
  | { readonly kind: 'webgl2'; readonly supported: true }
  | { readonly kind: 'webgl1'; readonly supported: true; readonly requiresValidation: true }
  | {
      readonly kind: 'unavailable';
      readonly supported: false;
      readonly reason: 'context_creation_failed' | 'blocked_by_policy';
    };

export interface RendererRecoveryHooks {
  readonly pauseLifecycle: () => Promise<void>;
  readonly requestMemorySnapshot: () => Promise<void>;
  readonly recreateResourcesFromSnapshot: () => Promise<void>;
  readonly routeToCompatibility: () => void;
  readonly recordDiagnostic: (
    code: string,
    context: Readonly<Record<string, string | number | boolean>>,
  ) => void;
}

export function probeRendererCapability(
  createCanvas: () => HTMLCanvasElement,
): RendererCapability {
  const canvas = createCanvas();
  const webgl2 = canvas.getContext('webgl2', {
    failIfMajorPerformanceCaveat: true,
  });
  if (webgl2 !== null) {
    return { kind: 'webgl2', supported: true };
  }

  const webgl1 =
    canvas.getContext('webgl', { failIfMajorPerformanceCaveat: true }) ??
    canvas.getContext('experimental-webgl', {
      failIfMajorPerformanceCaveat: true,
    });

  return webgl1 === null
    ? {
        kind: 'unavailable',
        supported: false,
        reason: 'context_creation_failed',
      }
    : { kind: 'webgl1', supported: true, requiresValidation: true };
}

export class RendererContextRecovery {
  private restoreAttempts = 0;

  public constructor(private readonly hooks: RendererRecoveryHooks) {}

  public bind(canvas: HTMLCanvasElement): () => void {
    const onLost = (event: Event): void => {
      event.preventDefault();
      void this.handleLost();
    };
    const onRestored = (): void => {
      void this.handleRestored();
    };

    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);

    return () => {
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
    };
  }

  private async handleLost(): Promise<void> {
    await this.hooks.pauseLifecycle();
    await this.hooks.requestMemorySnapshot();
    this.hooks.recordDiagnostic('WEBGL_CONTEXT_LOST', {
      restoreAttempt: this.restoreAttempts,
    });
  }

  private async handleRestored(): Promise<void> {
    this.restoreAttempts += 1;
    try {
      await this.hooks.recreateResourcesFromSnapshot();
      this.restoreAttempts = 0;
    } catch {
      this.hooks.recordDiagnostic('WEBGL_RESTORE_FAILED', {
        restoreAttempt: this.restoreAttempts,
      });
      if (this.restoreAttempts >= 2) {
        this.hooks.routeToCompatibility();
      }
    }
  }
}
