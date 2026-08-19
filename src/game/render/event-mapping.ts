import type { PresentationEvent, PresentationEventKind, VisualState } from './types.js';
import { RenderError } from './render-error.js';

/**
 * Entity/animation mapping contract: the closed visual-state set and the
 * rule that animation transitions happen only after COMMITTED events. Hurt
 * starts only after a committed damage event; defeat makes the view
 * untargetable while gameplay targetability stays with the snapshot.
 */
export const VISUAL_STATES: readonly VisualState[] = Object.freeze([
  'spawn',
  'idle',
  'move',
  'prepare',
  'execute',
  'recover',
  'hurt',
  'control',
  'defeat',
  'victory',
]);

export const TERMINAL_VISUAL_STATES: readonly VisualState[] = Object.freeze(['defeat', 'victory']);

export const PRESENTATION_EVENT_KINDS: readonly PresentationEventKind[] = Object.freeze([
  'damage',
  'heal',
  'projectile',
  'spawn',
  'defeat',
  'battle_end',
]);

export type EventInvolvement = 'source' | 'target' | 'none';

export function validatePresentationEvent(event: PresentationEvent): void {
  if (!Number.isSafeInteger(event.sequence) || event.sequence < 0) throw new RenderError('EVENT_INVALID', { field: 'sequence' });
  if (!Number.isSafeInteger(event.tick) || event.tick < 0) throw new RenderError('EVENT_INVALID', { field: 'tick' });
  if (!PRESENTATION_EVENT_KINDS.includes(event.kind)) throw new RenderError('EVENT_INVALID', { field: 'kind' });
  if (event.sourceId !== undefined && (typeof event.sourceId !== 'string' || event.sourceId.length === 0)) {
    throw new RenderError('EVENT_INVALID', { field: 'sourceId' });
  }
  if (event.targetId !== undefined && (typeof event.targetId !== 'string' || event.targetId.length === 0)) {
    throw new RenderError('EVENT_INVALID', { field: 'targetId' });
  }
}

/**
 * Closed visual-state transition table driven by committed events.
 * - damage targeting the entity -> hurt (never before a committed event)
 * - heal while hurt -> idle
 * - defeat -> terminal defeat (sticky)
 * - battle_end -> victory for involved survivors (sticky)
 * - projectile/spawn events never change an existing entity's state
 */
export function applyCommittedEvent(state: VisualState, event: PresentationEvent, involvement: EventInvolvement): VisualState {
  validatePresentationEvent(event);
  if (TERMINAL_VISUAL_STATES.includes(state)) return state;
  switch (event.kind) {
    case 'damage':
      return involvement === 'target' ? 'hurt' : state;
    case 'heal':
      return involvement === 'target' && state === 'hurt' ? 'idle' : state;
    case 'defeat':
      return involvement === 'target' ? 'defeat' : state;
    case 'battle_end':
      return involvement === 'source' ? 'victory' : state;
    case 'projectile':
    case 'spawn':
      return state;
  }
}
