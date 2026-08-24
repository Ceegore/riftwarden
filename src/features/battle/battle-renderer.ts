/**
 * Battle renderer: PixiJS v8 Application manager for the battle
 * canvas. Renders a static combat scene with unit positions,
 * background layers, and animation hooks.
 */
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { BattleAnimation } from './battle-animation.js';
import type { QualityTier } from '../../game/performance/auto-quality.js';

export interface UnitRenderData {
  readonly id: string;
  readonly label: string;
  readonly hp: number;
  readonly maxHp: number;
  readonly side: 'ally' | 'enemy';
  readonly x: number;
  readonly y: number;
}

export interface BattleRenderConfig {
  readonly width: number;
  readonly height: number;
  readonly backgroundTint?: number;
}

/** Visual detail budgets per quality tier. */
const QUALITY_DETAIL: Readonly<Record<QualityTier, { readonly gridLines: number; readonly labels: boolean; readonly unitRadius: number }>> = Object.freeze({
  high:   { gridLines: 3, labels: true,  unitRadius: 18 },
  medium: { gridLines: 1, labels: true,  unitRadius: 16 },
  low:    { gridLines: 0, labels: false, unitRadius: 14 },
});

const ALLY_COLOR = 0x4488cc;
const ENEMY_COLOR = 0xcc4444;
const HP_GREEN = 0x44cc44;
const HP_BG = 0x444444;

export class BattleRenderer {
  private app: Application | null = null;
  private initialized = false;
  private rootContainer: Container | null = null;
  private quality: QualityTier = 'high';
  private readonly unitContainers = new Map<string, Container>();
  private readonly animations = new Map<string, BattleAnimation>();
  private readonly config: BattleRenderConfig;

  constructor(config: BattleRenderConfig) {
    this.config = config;
  }

  get qualityTier(): QualityTier { return this.quality; }

  /** Adjusts render detail; re-draws the background on change. */
  setQuality(tier: QualityTier): void {
    if (this.quality === tier) return;
    this.quality = tier;
    if (this.rootContainer) {
      this.rootContainer.removeChildren();
      this.unitContainers.clear();
      this.animations.clear();
      this.drawBackground();
    }
  }

  async init(canvas: HTMLCanvasElement): Promise<void> {
    const app = new Application();
    this.app = app;
    await app.init({
      canvas,
      width: this.config.width,
      height: this.config.height,
      background: this.config.backgroundTint ?? 0x1a1a2e,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });
    if (this.app !== app) {
      app.destroy(true);
      return;
    }
    this.initialized = true;
    this.rootContainer = new Container();
    app.stage.addChild(this.rootContainer);
    this.drawBackground();
  }

  renderUnits(units: readonly UnitRenderData[]): void {
    if (!this.rootContainer) return;
    const activeIds = new Set(units.map((u) => u.id));
    for (const [id, c] of this.unitContainers) {
      if (!activeIds.has(id)) {
        this.rootContainer.removeChild(c);
        c.destroy({ children: true });
        this.unitContainers.delete(id);
        this.animations.delete(id);
      }
    }
    for (const unit of units) {
      let c = this.unitContainers.get(unit.id);
      if (!c) {
        c = new Container();
        this.rootContainer.addChild(c);
        this.unitContainers.set(unit.id, c);
      }
      const previous = this.animations.get(unit.id);
      c.x = unit.x;
      c.y = unit.y;
      this.drawUnit(c, unit);
      if (!previous) {
        const animation = new BattleAnimation();
        animation.startVictory(900);
        this.animations.set(unit.id, animation);
      }
    }
  }

  get ticker() { return this.app?.ticker ?? null; }

  animate(deltaMs: number): void {
    for (const [id, animation] of this.animations) {
      const container = this.unitContainers.get(id);
      if (container && !animation.tick(container, deltaMs)) this.animations.delete(id);
    }
  }

  destroy(): void {
    for (const [, c] of this.unitContainers) c.destroy({ children: true });
    this.unitContainers.clear();
    this.animations.clear();
    if (this.app && this.initialized) {
      try {
        this.app.destroy(true, { children: true });
      } catch {
        // PixiJS v8 internal teardown may throw if resize observer
        // was never registered; the canvas is removed by React anyway.
      }
    }
    this.app = null;
    this.rootContainer = null;
    this.initialized = false;
  }

  private drawBackground(): void {
    if (!this.rootContainer) return;
    const { width, height } = this.config;
    const detail = QUALITY_DETAIL[this.quality];
    // Ground strip
    const ground = new Graphics();
    ground.rect(0, height * 0.7, width, 4);
    ground.fill(0x445566);
    this.rootContainer.addChild(ground);

    // Grid lines — fewer at lower quality tiers.
    if (detail.gridLines > 0) {
      const grid = new Graphics();
      const step = width / (detail.gridLines + 1);
      for (let i = 1; i <= detail.gridLines; i += 1) {
        const x = step * i;
        grid.moveTo(x, 0);
        grid.lineTo(x, height);
        grid.stroke({ color: 0x333344, width: 1, alpha: 0.3 });
      }
      this.rootContainer.addChild(grid);
    }
  }

  private drawUnit(container: Container, unit: UnitRenderData): void {
    // Clear previous
    const children = container.children.slice();
    for (const child of children) { container.removeChild(child); child.destroy(); }

    const r = QUALITY_DETAIL[this.quality].unitRadius;
    const color = unit.side === 'ally' ? ALLY_COLOR : ENEMY_COLOR;
    const hpRatio = unit.maxHp > 0 ? unit.hp / unit.maxHp : 0;

    // Body
    const body = new Graphics();
    body.circle(0, -r, r);
    body.fill({ color, alpha: 0.85 });
    body.stroke({ color: 0xffffff, width: 1.5, alpha: 0.8 });
    container.addChild(body);

    // Label (skipped at low quality to reduce draw calls).
    if (QUALITY_DETAIL[this.quality].labels) {
      const label = new Text({
        text: unit.label,
        style: new TextStyle({ fontSize: 11, fill: 0xffffff, align: 'center' }),
      });
      label.anchor.set(0.5);
      label.y = -r;
      container.addChild(label);
    }

    // HP bar bg
    const hpW = r * 2.2;
    const hpH = 4;
    const hpBg = new Graphics();
    hpBg.rect(-hpW / 2, r + 3, hpW, hpH);
    hpBg.fill({ color: HP_BG, alpha: 0.8 });
    container.addChild(hpBg);

    // HP bar fill
    if (hpRatio > 0) {
      const hpFill = new Graphics();
      hpFill.rect(-hpW / 2, r + 3, hpW * hpRatio, hpH);
      hpFill.fill({ color: HP_GREEN, alpha: 0.9 });
      container.addChild(hpFill);
    }
  }
}
