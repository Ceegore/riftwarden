/**
 * Pinned API subset for the battle-render Pixi binding (Phase 37).
 *
 * pixi.js@8.19.0 — extends the Phase-25 subset with Container properties,
 * Graphics primitives, Text/TextStyle, Ticker, and Application.ticker.
 */
export class Container {
  x: number;
  y: number;
  zIndex: number;
  alpha: number;
  scale: { set(x: number, y?: number): void };
  sortableChildren: boolean;
  width: number;
  height: number;
  addChild<T extends object>(child: T): T;
  addChildAt<T extends object>(child: T, index: number): T;
  removeChild<T extends object>(child: T): T;
  removeChildren(): void;
  children: Container[];
  parent: Container | null;
  destroy(options?: { children?: boolean }): void;
}

export class Graphics extends Container {
  rect(x: number, y: number, width: number, height: number): this;
  circle(x: number, y: number, radius: number): this;
  fill(color: number | { color: number; alpha?: number }): this;
  stroke(options: { color: number; width?: number; alpha?: number }): this;
  moveTo(x: number, y: number): this;
  lineTo(x: number, y: number): this;
  clear(): this;
}

export interface TextStyleOptions {
  fontSize?: number;
  fill?: number | string;
  fontWeight?: string;
  align?: string;
  dropShadow?: {
    color: number;
    alpha: number;
    blur: number;
    distance: number;
  };
}

export interface TextStyle {
  readonly __brand: 'TextStyle';
}

export const TextStyle: new (style?: TextStyleOptions) => TextStyle;

export class Text extends Container {
  constructor(options?: { text: string; style: TextStyle });
  anchor: { set(x: number, y?: number): void };
  text: string;
  style: TextStyle;
}

export class Ticker {
  readonly deltaMS: number;
  add(fn: (ticker: Ticker) => void, context?: unknown): this;
  remove(fn: (ticker: Ticker) => void, context?: unknown): this;
}

export class Application {
  readonly screen: { readonly width: number; readonly height: number };
  readonly stage: Container;
  readonly ticker: Ticker;
  readonly canvas: HTMLCanvasElement;
  init(options: {
    canvas: HTMLCanvasElement;
    width: number;
    height: number;
    background?: number;
    antialias?: boolean;
    resolution?: number;
    autoDensity?: boolean;
    preference?: string;
    backgroundAlpha?: number;
  }): Promise<void>;
  stop(): void;
  start(): void;
  destroy(removeView?: boolean, options?: { children?: boolean }): void;
}
