import { KernelInvariantError } from '../core/invariant-error.js';

/**
 * Phase 21 §7 hazard authority (T04). Hazards follow the fixed lifecycle
 * `scheduled -> telegraph -> resolve -> expire`; there is no hidden roll.
 * Warning areas carry a form, an edge/pattern and a symbol that are content
 * data — quality or reduced-motion settings cannot alter simulation timing or
 * the information presented (§7 / GDD V5 37–39).
 */

export type HazardStage = 'scheduled' | 'telegraph' | 'resolve' | 'expired';

export const HAZARD_FORMS = ['circle', 'line', 'cone', 'rect'] as const;
export type HazardForm = (typeof HAZARD_FORMS)[number];

export interface Hazard {
  readonly id: string;
  readonly scheduledTick: number;
  /** Number of authoritative ticks the warning area is visible. */
  readonly telegraphTicks: number;
  /** First tick the hazard resolves (scheduledTick + telegraphTicks). */
  readonly resolveTick: number;
  readonly expired: boolean;
  /** Warning-area form; presentation-only, must not change timing. */
  readonly form: HazardForm;
  /** Edge/pattern key rendered on the warning area. */
  readonly edgePattern: string;
  /** Symbol key rendered on the warning area. */
  readonly shapeSymbol: string;
}

const ID = /^[a-z][a-z0-9_]*$/;
const KEY = /^[a-z][a-z0-9_]*(?:[._][a-z0-9_]+)*$/;

function assertInt(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) {
    throw new KernelInvariantError('P21_HAZARD_INVALID', { field, value });
  }
}

/** Validates a hazard and its lifecycle boundaries (§7). */
export function validateHazard(hazard: Hazard): void {
  if (!ID.test(hazard.id)) throw new KernelInvariantError('P21_HAZARD_INVALID', { field: 'id', value: hazard.id });
  assertInt(hazard.scheduledTick, 'scheduledTick');
  assertInt(hazard.telegraphTicks, 'telegraphTicks');
  assertInt(hazard.resolveTick, 'resolveTick');
  if (typeof hazard.expired !== 'boolean') throw new KernelInvariantError('P21_HAZARD_INVALID', { field: 'expired' });
  if (!(HAZARD_FORMS as readonly string[]).includes(hazard.form)) throw new KernelInvariantError('P21_HAZARD_INVALID', { field: 'form', value: hazard.form });
  if (!KEY.test(hazard.edgePattern)) throw new KernelInvariantError('P21_HAZARD_INVALID', { field: 'edgePattern', value: hazard.edgePattern });
  if (!KEY.test(hazard.shapeSymbol)) throw new KernelInvariantError('P21_HAZARD_INVALID', { field: 'shapeSymbol', value: hazard.shapeSymbol });
  if (hazard.telegraphTicks !== hazard.resolveTick - hazard.scheduledTick) {
    throw new KernelInvariantError('P21_HAZARD_INVALID', { reason: 'telegraph-boundary', hazard });
  }
}

/**
 * §7 lifecycle stage. `expired` wins; otherwise boundaries are inclusive on
 * scheduledTick and resolveTick (scheduled→telegraph at scheduledTick,
 * telegraph→resolve at resolveTick).
 */
export function hazardStage(hazard: Hazard, tick: number): HazardStage {
  if (hazard.expired) return 'expired';
  if (tick < hazard.scheduledTick) return 'scheduled';
  if (tick < hazard.resolveTick) return 'telegraph';
  return 'resolve';
}

/** §7 warning-area info: content-stable, unaffected by quality/reduced-motion. */
export function hazardWarningInfo(hazard: Hazard): { readonly form: HazardForm; readonly edgePattern: string; readonly shapeSymbol: string } {
  return Object.freeze({ form: hazard.form, edgePattern: hazard.edgePattern, shapeSymbol: hazard.shapeSymbol });
}
