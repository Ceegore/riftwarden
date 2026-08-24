/**
 * Battle animation system: frame-based animation pipeline for
 * combat visual effects — attack flashes, damage numbers,
 * death fades, and victory sparkles.
 */
import { Container, Graphics, Text, TextStyle } from 'pixi.js';

export type AnimationPhase =
  | 'idle'
  | 'attacking'
  | 'damaged'
  | 'dying'
  | 'victory';

export interface AnimState {
  readonly phase: AnimationPhase;
  readonly elapsed: number;
  readonly duration: number;
  readonly data: Record<string, number>;
}

const DAMAGE_COLOR = 0xff4444;

export class BattleAnimation {
  animState: AnimState;

  constructor() {
    this.animState = { phase: 'idle', elapsed: 0, duration: 0, data: {} };
  }

  get currentPhase(): AnimationPhase { return this.animState.phase; }
  get isAnimating(): boolean { return this.animState.phase !== 'idle'; }

  startAttack(duration = 300): AnimState {
    this.animState = { phase: 'attacking', elapsed: 0, duration, data: {} };
    return this.animState;
  }

  startDamaged(duration = 400): AnimState {
    this.animState = { phase: 'damaged', elapsed: 0, duration, data: {} };
    return this.animState;
  }

  startDying(duration = 800): AnimState {
    this.animState = { phase: 'dying', elapsed: 0, duration, data: {} };
    return this.animState;
  }

  startVictory(duration = 2000): AnimState {
    this.animState = { phase: 'victory', elapsed: 0, duration, data: {} };
    return this.animState;
  }

  reset(): void {
    this.animState = { phase: 'idle', elapsed: 0, duration: 0, data: {} };
  }

  tick(container: Container, deltaMs: number): boolean {
    if (this.animState.phase === 'idle') return false;

    const startX = this.animState.data['startX'] ?? container.x;
    const startY = this.animState.data['startY'] ?? container.y;
    this.animState = {
      ...this.animState,
      elapsed: this.animState.elapsed + deltaMs,
      data: { ...this.animState.data, startX, startY },
    };
    const progress = Math.min(this.animState.elapsed / this.animState.duration, 1);

    switch (this.animState.phase) {
      case 'attacking': {
        const offset = progress < 0.5 ? progress * 16 : (1 - progress) * 16;
        const parentWidth = container.parent?.width ?? 640;
        const direction = startX > parentWidth / 2 ? -1 : 1;
        container.x = startX + offset * direction;
        break;
      }
      case 'damaged': {
        const alphaVal = 1 - (progress * 0.6);
        container.alpha = alphaVal + 0.4;
        container.y = startY + Math.sin(progress * Math.PI * 6) * 3;
        break;
      }
      case 'dying': {
        container.alpha = 1 - progress;
        container.scale.set(1 - progress * 0.3);
        break;
      }
      case 'victory': {
        const scaleVal = 1 + Math.sin(progress * Math.PI * 2) * 0.05;
        container.scale.set(scaleVal);
        break;
      }
      case 'idle':
        break;
    }

    if (progress >= 1) {
      container.x = startX;
      container.y = startY;
      container.alpha = 1;
      container.scale.set(1);
      this.animState = { phase: 'idle', elapsed: 0, duration: 0, data: {} };
      return false;
    }
    return true;
  }

  static createFloatingText(
    text: string,
    x: number,
    y: number,
    color: number = DAMAGE_COLOR,
    duration = 1200,
  ): Container {
    const container = new Container();
    container.x = x;
    container.y = y;

    const label = new Text({
      text,
      style: new TextStyle({
        fontSize: 16,
        fill: color,
        fontWeight: 'bold',
        align: 'center',
        dropShadow: { color: 0x000000, alpha: 0.6, blur: 2, distance: 1 },
      }),
    });
    label.anchor.set(0.5);
    container.addChild(label);

    const startY = y;
    let elapsed = 0;
    const tickerFn = (deltaMs: number): boolean => {
      elapsed += deltaMs;
      const p = Math.min(elapsed / duration, 1);
      container.y = startY - p * 40;
      container.alpha = 1 - p * 0.8;
      return p < 1;
    };
    (container as unknown as Record<string, unknown>)['_floatElapsed'] = 0;
    (container as unknown as Record<string, unknown>)['_floatTicker'] = () => tickerFn(16);
    return container;
  }

  static flashOverlay(container: Container, alpha = 0.5): Graphics {
    const flash = new Graphics();
    flash.rect(-25, -25, 50, 50);
    flash.fill({ color: 0xffffff, alpha });
    container.addChild(flash);
    return flash;
  }
}
