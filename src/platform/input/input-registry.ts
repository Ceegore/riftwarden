/**
 * Phase 40: Input bindings (INPUT_REGISTRY_CONTRACT).
 *
 * Maps semantic actions to physical inputs: keyboard keys, gamepad
 * buttons, touch gestures. Respects sticky keys timing and prevents
 * double-tap on debounced actions.
 */

export type SemanticAction =
  | 'confirm' | 'back' | 'cancel' | 'menu'
  | 'up' | 'down' | 'left' | 'right'
  | 'nextTab' | 'prevTab'
  | 'skip' | 'pause'
  | 'shoulderLeft' | 'shoulderRight';

export interface KeyBinding {
  readonly action: SemanticAction;
  readonly keys: readonly string[];
  readonly gamepadButtons: readonly number[];
  readonly repeatDelay: number;
  readonly preventDoubleTap: boolean;
}

const DEFAULT_BINDINGS: readonly KeyBinding[] = Object.freeze([
  { action: 'confirm',       keys: ['Enter', 'Space'],      gamepadButtons: [0], repeatDelay: 300, preventDoubleTap: true },
  { action: 'back',          keys: ['Escape', 'Backspace'],   gamepadButtons: [1], repeatDelay: 300, preventDoubleTap: true },
  { action: 'cancel',        keys: ['Escape'],                gamepadButtons: [1], repeatDelay: 300, preventDoubleTap: false },
  { action: 'menu',          keys: ['m', 'M'],                gamepadButtons: [9], repeatDelay: 500, preventDoubleTap: true },
  { action: 'up',            keys: ['ArrowUp', 'w', 'W'],    gamepadButtons: [12], repeatDelay: 150, preventDoubleTap: false },
  { action: 'down',          keys: ['ArrowDown', 's', 'S'],  gamepadButtons: [13], repeatDelay: 150, preventDoubleTap: false },
  { action: 'left',          keys: ['ArrowLeft', 'a', 'A'],  gamepadButtons: [14], repeatDelay: 150, preventDoubleTap: false },
  { action: 'right',         keys: ['ArrowRight', 'd', 'D'], gamepadButtons: [15], repeatDelay: 150, preventDoubleTap: false },
  { action: 'nextTab',       keys: ['Tab'],                   gamepadButtons: [5], repeatDelay: 200, preventDoubleTap: true },
  { action: 'prevTab',       keys: ['Shift+Tab'],             gamepadButtons: [4], repeatDelay: 200, preventDoubleTap: true },
  { action: 'skip',          keys: ['Space'],                 gamepadButtons: [7], repeatDelay: 300, preventDoubleTap: true },
  { action: 'pause',         keys: ['p', 'P'],                gamepadButtons: [9], repeatDelay: 500, preventDoubleTap: true },
  { action: 'shoulderLeft',  keys: ['q', 'Q'],                gamepadButtons: [4], repeatDelay: 200, preventDoubleTap: false },
  { action: 'shoulderRight', keys: ['e', 'E'],                gamepadButtons: [5], repeatDelay: 200, preventDoubleTap: false },
]);

export class InputRegistry {
  private readonly bindings = new Map<SemanticAction, KeyBinding>();
  private lastActionTime = new Map<SemanticAction, number>();

  constructor() {
    for (const binding of DEFAULT_BINDINGS) {
      this.bindings.set(binding.action, binding);
    }
  }

  getBinding(action: SemanticAction): KeyBinding | undefined {
    return this.bindings.get(action);
  }

  resolveKeyEvent(event: KeyboardEvent): SemanticAction | null {
    for (const binding of this.bindings.values()) {
      for (const key of binding.keys) {
        if (key === event.key || (key === 'Shift+Tab' && event.shiftKey && event.key === 'Tab')) {
          return binding.action;
        }
      }
    }
    return null;
  }

  resolveGamepadButton(buttonIndex: number): SemanticAction | null {
    for (const binding of this.bindings.values()) {
      if (binding.gamepadButtons.includes(buttonIndex)) {
        return binding.action;
      }
    }
    return null;
  }

  shouldFire(action: SemanticAction, now: number): boolean {
    const binding = this.bindings.get(action);
    if (binding === undefined) return false;
    const last = this.lastActionTime.get(action);
    if (last !== undefined && binding.preventDoubleTap && (now - last) < binding.repeatDelay) {
      return false;
    }
    this.lastActionTime.set(action, now);
    return true;
  }

  resetCooldown(action: SemanticAction): void {
    this.lastActionTime.delete(action);
  }
}
