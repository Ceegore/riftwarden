export type Platform = 'android' | 'ios' | 'web';

export interface BackContext {
  readonly platform: Platform;
  readonly nowMs: number;
  readonly exitArmedAtMs: number | null;
  readonly tooltipOpen: boolean;
  readonly nonCriticalOverlayOpen: boolean;
  readonly modalSafeToClose: boolean | null;
  readonly pendingCommitId: string | null;
  readonly policyId: string;
}

export type BackDecision =
  | { readonly type: 'closeTooltip' }
  | { readonly type: 'closeNonCriticalOverlay' }
  | { readonly type: 'closeModal' }
  | { readonly type: 'blocked'; readonly code: string }
  | { readonly type: 'armExitWindow'; readonly expiresAtMs: number }
  | { readonly type: 'requestNativeExit' }
  | { readonly type: 'openExpeditionMenu' }
  | { readonly type: 'pauseAtCompleteTickThenOpenBattleMenu' }
  | { readonly type: 'openUnsavedChangesModal'; readonly defaultFocus: 'cancel' }
  | { readonly type: 'back' }
  | { readonly type: 'delegateOrNoop' }
  | { readonly type: 'noop' };

export function dispatchBack(context: BackContext): BackDecision {
  if (context.tooltipOpen) return { type: 'closeTooltip' };
  if (context.nonCriticalOverlayOpen) return { type: 'closeNonCriticalOverlay' };
  if (context.modalSafeToClose !== null) {
    if (context.pendingCommitId || !context.modalSafeToClose) {
      return { type: 'blocked', code: 'NAV_BACK_PENDING_COMMIT' };
    }
    return { type: 'closeModal' };
  }
  if (context.pendingCommitId) return { type: 'blocked', code: 'NAV_BACK_PENDING_COMMIT' };
  if (context.policyId === 'doubleBackExitAndroid') {
    if (context.platform === 'ios') return { type: 'noop' };
    if (context.platform !== 'android') return { type: 'back' };
    if (context.exitArmedAtMs !== null && context.nowMs - context.exitArmedAtMs <= 2_000) {
      return { type: 'requestNativeExit' };
    }
    return { type: 'armExitWindow', expiresAtMs: context.nowMs + 2_000 };
  }
  if (context.policyId === 'openExpeditionMenu') return { type: 'openExpeditionMenu' };
  if (context.policyId === 'pauseAndOpenBattleMenu') {
    return { type: 'pauseAtCompleteTickThenOpenBattleMenu' };
  }
  if (context.policyId === 'blockedUntilRewardDecision') {
    return { type: 'blocked', code: 'NAV_BACK_RUN_LOSS_RISK' };
  }
  if (context.policyId === 'unsavedAwarePrevious') {
    return { type: 'openUnsavedChangesModal', defaultFocus: 'cancel' };
  }
  if (context.policyId === 'systemOwned') return { type: 'delegateOrNoop' };
  return { type: 'back' };
}
