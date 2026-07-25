import type { CompiledBundle, LocaleId } from './format/compiled-types';
import type { LocaleRegistry } from './registry';

export interface LocaleContinuitySnapshot {
  readonly navigationSemanticId:string | null;
  readonly modalStack:readonly string[];
  readonly pendingTransactionId:string | null;
  readonly recoveryState:unknown;
  readonly focusedSemanticId:string | null;
  readonly scrollAnchorSemanticId:string | null;
  readonly saveGameFingerprint:string;
  readonly simulationFingerprint:string;
}

export interface LocaleSwitchAdapter {
  captureContinuity():LocaleContinuitySnapshot;
  restoreFocusAndScroll(snapshot:LocaleContinuitySnapshot):void;
  persistLocale(locale:LocaleId):Promise<void>;
}

export interface LocaleSnapshot {
  readonly activeLocale:LocaleId;
  readonly bundle:CompiledBundle;
  readonly uiRevision:number;
  readonly switchingTo:LocaleId | null;
  readonly lastSwitchError:unknown;
}

export type LocaleListener = (snapshot:LocaleSnapshot) => void;

export class LocaleController {
  #snapshot:LocaleSnapshot;
  #listeners = new Set<LocaleListener>();
  #switchSerial = 0;

  constructor(
    private readonly registry:LocaleRegistry,
    private readonly adapter:LocaleSwitchAdapter,
    initialLocale:LocaleId,
    initialBundle:CompiledBundle,
  ) {
    this.#snapshot = { activeLocale:initialLocale, bundle:initialBundle, uiRevision:0, switchingTo:null, lastSwitchError:null };
  }

  getSnapshot = ():LocaleSnapshot => this.#snapshot;

  subscribe = (listener:LocaleListener):(() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  async switchLocale(target:LocaleId):Promise<void> {
    if (target === this.#snapshot.activeLocale || target === this.#snapshot.switchingTo) return;
    const serial = ++this.#switchSerial;
    const continuity = this.adapter.captureContinuity();
    this.set({ ...this.#snapshot, switchingTo:target, lastSwitchError:null });
    try {
      const bundle = await this.registry.load(target);
      if (serial !== this.#switchSerial) return;
      const afterLoad = this.adapter.captureContinuity();
      assertContinuityUnchanged(continuity, afterLoad);
      this.set({ activeLocale:target, bundle, uiRevision:this.#snapshot.uiRevision + 1, switchingTo:null, lastSwitchError:null });
      await this.adapter.persistLocale(target);
      queueMicrotask(() => { this.adapter.restoreFocusAndScroll(continuity); });
    } catch (error) {
      if (serial !== this.#switchSerial) return;
      this.set({ ...this.#snapshot, switchingTo:null, lastSwitchError:error });
      throw error;
    }
  }

  private set(next:LocaleSnapshot):void {
    this.#snapshot = next;
    for (const listener of this.#listeners) listener(next);
  }
}

function assertContinuityUnchanged(before:LocaleContinuitySnapshot, after:LocaleContinuitySnapshot):void {
  const stableKeys:readonly (keyof LocaleContinuitySnapshot)[] = [
    'navigationSemanticId','modalStack','pendingTransactionId','recoveryState','saveGameFingerprint','simulationFingerprint',
  ];
  for (const key of stableKeys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) throw new Error(`Locale switch mutated continuity field before commit: ${key}`);
  }
}
