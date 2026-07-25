import { fail } from './diagnostic.mjs';

export function resolveBack(context) {
  if (context.tooltipOpen) return {type:'closeTooltip'};
  if (context.nonCriticalOverlayOpen) return {type:'closeNonCriticalOverlay'};
  if (context.modal) {
    if (context.pendingCommitId || context.modal.safeToClose===false) return {type:'blocked',code:'NAV_BACK_PENDING_COMMIT'};
    return {type:'closeModal'};
  }
  if (context.pendingCommitId) return {type:'blocked',code:'NAV_BACK_PENDING_COMMIT'};
  switch (context.policyId) {
    case 'doubleBackExitAndroid':
      if (context.platform==='ios') return {type:'noop'};
      if (context.platform!=='android') return {type:'back'};
      if (context.exitArmedAtMs!==null && context.nowMs-context.exitArmedAtMs<=2000) return {type:'requestNativeExit'};
      return {type:'armExitWindow',expiresAtMs:context.nowMs+2000};
    case 'openExpeditionMenu': return {type:'openExpeditionMenu'};
    case 'pauseAndOpenBattleMenu': return {type:'pauseAtCompleteTickThenOpenBattleMenu'};
    case 'blockedUntilRewardDecision': return {type:'blocked',code:'NAV_BACK_RUN_LOSS_RISK'};
    case 'unsavedAwarePrevious': return {type:'openUnsavedChangesModal',defaultFocus:'cancel'};
    case 'previousPreserveView':
    case 'safePrevious': return {type:'back'};
    case 'systemOwned': return {type:'delegateOrNoop'};
    default: fail('NAV_SOURCE_SCHEMA',`Unknown back policy ${context.policyId}`);
  }
}

export function predictiveBackBegin(context) {
  return {preview:resolveBack({...context,nowMs:context.nowMs}),committed:false};
}
export function predictiveBackCancel(preview) {
  return {...preview,committed:false,canceled:true};
}
export function predictiveBackCommit(preview) {
  return {...preview,committed:true,canceled:false};
}
