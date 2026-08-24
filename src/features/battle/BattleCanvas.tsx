/**
 * BattleCanvas: React component wrapping a PixiJS Application
 * for rendering the combat scene during expedition battles.
 */
import { useEffect, useRef } from 'react';
import type { JSX } from 'react';
import type { Ticker } from 'pixi.js';
import { BattleRenderer, type UnitRenderData } from './battle-renderer.js';

export interface BattleCanvasProps {
  readonly width?: number;
  readonly height?: number;
  readonly units: readonly UnitRenderData[];
}

export function BattleCanvas({ width = 640, height = 360, units }: BattleCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<BattleRenderer | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new BattleRenderer({ width, height });
    rendererRef.current = renderer;

    let cancelled = false;
    const tick = (ticker: Ticker): void => { renderer.animate(ticker.deltaMS); };
    renderer.init(canvas).then(() => {
      if (cancelled) return;
      renderer.renderUnits(units);
      renderer.ticker?.add(tick);
    }).catch(() => {
      if (!cancelled) renderer.destroy();
    });

    return () => {
      cancelled = true;
      renderer.ticker?.remove(tick);
      renderer.destroy();
      rendererRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);

  // Re-render when units change
  useEffect(() => {
    rendererRef.current?.renderUnits(units);
  }, [units]);

  return (
    <div className="rw-battle-canvas-wrapper" role="img" aria-label="Battle scene">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="rw-battle-canvas"
        style={{ maxWidth: '100%', height: 'auto' }}
      />
    </div>
  );
}
