/**
 * BattleCanvas: React component wrapping a PixiJS Application
 * for rendering the combat scene during expedition battles.
 *
 * Phase 41: measures frame time and auto-adjusts visual quality
 * via the auto-quality selector.
 */
import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import type { Ticker } from 'pixi.js';
import { BattleRenderer, type UnitRenderData } from './battle-renderer.js';
import { createQualityState, reportFrame } from '../../game/performance/auto-quality.js';
import { loadQualityPreference } from '../../game/performance/graphics-settings-store.js';
import type { QualityState } from '../../game/performance/auto-quality.js';

export interface BattleCanvasProps {
  readonly width?: number;
  readonly height?: number;
  readonly units: readonly UnitRenderData[];
}

export function BattleCanvas({ width = 640, height = 360, units }: BattleCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<BattleRenderer | null>(null);
  const qualityRef = useRef<QualityState>(createQualityState());
  const [displayTier, setDisplayTier] = useState<string>('high');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new BattleRenderer({ width, height });
    rendererRef.current = renderer;
    const initialTier = loadQualityPreference();
    renderer.setQuality(initialTier);
    qualityRef.current = { ...createQualityState(), currentTier: initialTier };
    setDisplayTier(initialTier);

    let cancelled = false;
    const tick = (ticker: Ticker): void => {
      renderer.animate(ticker.deltaMS);
      const next = reportFrame(qualityRef.current, ticker.deltaMS);
      qualityRef.current = next;
      if (next.currentTier !== renderer.qualityTier) {
        renderer.setQuality(next.currentTier);
        setDisplayTier(next.currentTier);
      }
    };
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
    <div className="rw-battle-canvas-wrapper" role="img" aria-label={`Battle scene (${displayTier} quality)`}>
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
