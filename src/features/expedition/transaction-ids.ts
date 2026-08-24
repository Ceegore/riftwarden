import { fnv1a32 } from '../../game/expedition/stable.js';

export function resolveExpeditionSeed(fallback = Date.now()): number {
  const env = import.meta.env as unknown as Readonly<Record<string, unknown>>;
  const fixed = env['VITE_FIXED_TEST_SEED'];
  return typeof fixed === 'string' && fixed.length > 0 ? fnv1a32([fixed]) : fallback >>> 0;
}

export function enterTransactionId(runId: string, nodeId: string): string {
  return `${runId}:enter:${nodeId}`;
}

export function actionTransactionId(
  runId: string,
  nodeId: string,
  action: string,
  optionId = 'none',
): string {
  return `${runId}:action:${nodeId}:${action}:${optionId}`;
}
