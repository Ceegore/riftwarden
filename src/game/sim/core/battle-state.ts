import { KernelInvariantError } from './invariant-error.js';
import type { Tick } from './primitives.js';

export const BATTLE_PHASES = ['PREPARED','INTRO','ACTIVE','PHASE_TRANSITION','RESOLVING_END','VICTORY','DEFEAT','DRAW_ABORT'] as const;
export type BattlePhase = (typeof BATTLE_PHASES)[number];
const TERMINAL = new Set<BattlePhase>(['VICTORY','DEFEAT','DRAW_ABORT']);
const ALLOWED: Readonly<Record<BattlePhase, readonly BattlePhase[]>> = Object.freeze({
  PREPARED:['INTRO'], INTRO:['ACTIVE'], ACTIVE:['PHASE_TRANSITION','RESOLVING_END'],
  PHASE_TRANSITION:['ACTIVE','RESOLVING_END'], RESOLVING_END:['VICTORY','DEFEAT','DRAW_ABORT'],
  VICTORY:[], DEFEAT:[], DRAW_ABORT:[]
});
export interface BattlePhaseState { readonly phase: BattlePhase; readonly enteredTick: Tick; readonly resolvingEndTicks: number; }
export function isTerminalBattlePhase(phase: BattlePhase): boolean { return TERMINAL.has(phase); }
export function transitionBattlePhase(state: BattlePhaseState, to: BattlePhase, atTick: Tick): BattlePhaseState {
  if (!ALLOWED[state.phase].includes(to)) throw new KernelInvariantError('P14_STATE_TRANSITION_INVALID',{kind:'battle',from:state.phase,to});
  return Object.freeze({ phase:to, enteredTick:atTick, resolvingEndTicks:to === 'RESOLVING_END' ? 0 : state.resolvingEndTicks });
}
export function advanceResolvingEnd(state: BattlePhaseState): BattlePhaseState {
  if (state.phase !== 'RESOLVING_END') return state;
  const count = state.resolvingEndTicks + 1;
  if (count > 3) throw new KernelInvariantError('P14_RESOLVING_END_LIMIT',{count});
  return Object.freeze({...state,resolvingEndTicks:count});
}
