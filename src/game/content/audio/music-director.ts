/**
 * Phase 39: Music Director state machine (MUSIC_DIRECTOR_CONTRACT).
 *
 * Pure state machine — no audio playback. Manages transitions between
 * music contexts with crossfade rules, idempotent play/resume,
 * and gapless region sets. Deterministic and testable without an
 * audio device.
 */

export type MusicContext =
  | 'title'
  | 'hq'
  | { readonly kind: 'region'; readonly regionId: string }
  | { readonly kind: 'battle'; readonly intensity: 'normal' | 'elite' | 'boss' }
  | { readonly kind: 'bossPhase'; readonly phase: 1 | 2 | 3 }
  | 'endgame'
  | 'silence';

export interface DirectorState {
  readonly currentContext: MusicContext;
  readonly nextContext: MusicContext | null;
  readonly crossfadeMs: number;
  readonly paused: boolean;
  readonly bossStemLayer: number;
}

const CROSSFADE_MIN = 600;
const CROSSFADE_MAX = 1000;

function contextKey(ctx: MusicContext): string {
  if (typeof ctx === 'string') return ctx;
  if (ctx.kind === 'region') return `region:${ctx.regionId}`;
  if (ctx.kind === 'battle') return `battle:${ctx.intensity}`;
  return `bossP${String(ctx.phase)}`;
}

export function createDirector(): DirectorState {
  return {
    currentContext: 'silence',
    nextContext: null,
    crossfadeMs: CROSSFADE_MIN,
    paused: false,
    bossStemLayer: 0,
  };
}

export function requestMusic(state: DirectorState, target: MusicContext): DirectorState {
  if (contextKey(state.currentContext) === contextKey(target) && !state.paused) {
    return state;
  }
  const crossfadeMs = target === 'silence'
    ? CROSSFADE_MAX
    : (state.currentContext === 'silence' ? 0 : CROSSFADE_MIN);
  return {
    ...state,
    nextContext: target,
    crossfadeMs,
    paused: false,
  };
}

export function applyTransition(state: DirectorState): DirectorState {
  if (state.nextContext === null) return state;
  return {
    ...state,
    currentContext: state.nextContext,
    nextContext: null,
    crossfadeMs: 0,
  };
}

export function pauseDirector(state: DirectorState): DirectorState {
  if (state.paused) return state;
  return { ...state, paused: true };
}

export function resumeDirector(state: DirectorState): DirectorState {
  if (!state.paused) return state;
  return { ...state, paused: false };
}

export function setBossStem(state: DirectorState, layer: number): DirectorState {
  if (layer < 0 || layer > 3) return state;
  return { ...state, bossStemLayer: layer };
}

export function isTransitioning(state: DirectorState): boolean {
  return state.nextContext !== null;
}