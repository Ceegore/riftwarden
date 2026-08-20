/**
 * Pinned API subset for the battle-render Pixi binding.
 *
 * pixi.js@8.19.0 is the exactly authorized version (Phase-25 blocker P25-B02:
 * never use a version other than the pinned one). Its full type surface fails
 * to compile under the repository's strict `skipLibCheck: false` +
 * TypeScript 5.9.3 (AbstractBitmapFont incorrectly implements BitmapFontData).
 * tsconfig.app.json redirects the module specifier `pixi.js` to this file, so
 * typechecking sees exactly the documented subset the binding uses, while the
 * runtime import still resolves to the real pixi.js bundle (Vite ignores
 * tsconfig paths for bare imports).
 */
export class Container {
  zIndex: number;
  alpha: number;
  sortableChildren: boolean;
  addChild<T extends object>(child: T): T;
  destroy(options?: { children?: boolean }): void;
}

export class Graphics extends Container {
  rect(x: number, y: number, width: number, height: number): this;
  fill(color: number): this;
  clear(): this;
}

export class Application {
  readonly screen: { readonly width: number; readonly height: number };
  readonly stage: Container;
  init(options: {
    canvas: HTMLCanvasElement;
    preference: 'webgl';
    width: number;
    height: number;
    backgroundAlpha: number;
  }): Promise<void>;
  stop(): void;
  start(): void;
}
