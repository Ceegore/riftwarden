import { fail } from './diagnostic.mjs';

export function createOverlayState() {
  return {tooltip:null,nonCriticalOverlay:null,blockingModal:null,toasts:[]};
}
export function openBlockingModal(state,modal) {
  if (state.blockingModal) fail('NAV_NESTED_BLOCKING_MODAL','Only one blocking modal is allowed');
  if (modal.kind==='unsavedChanges' && modal.defaultFocus!=='cancel') fail('NAV_MODAL_FOCUS_RESTORE_FAILED','Unsaved Changes must default focus Cancel');
  if (['ok','common.ok','confirm'].includes(String(modal.primaryVerbKey).toLowerCase())) {
    fail('NAV_UNSAFE_MODAL_VERB','Modal must use a concrete verb');
  }
  return {...state,tooltip:null,nonCriticalOverlay:null,blockingModal:modal};
}
export function closeBlockingModal(state,{triggerExists=true,logicalSiblingExists=true}={}) {
  if (!state.blockingModal) return {state,focusTarget:null};
  const focusTarget=triggerExists?'trigger':logicalSiblingExists?'logicalSibling':'screenHeading';
  return {state:{...state,blockingModal:null},focusTarget};
}
export function beginTransaction(state,transactionId,affectedActionId) {
  if (!state.blockingModal) fail('NAV_SOURCE_SCHEMA','Transaction requires a modal');
  return {...state,blockingModal:{...state.blockingModal,transactionId,affectedActionId}};
}
export function canActivate(state,actionId) {
  const modal=state.blockingModal;
  return !(modal?.transactionId && modal.affectedActionId===actionId);
}
