export interface BlockingModal {
  readonly modalKey: string;
  readonly safeToClose: boolean;
  readonly triggerFocusId: string;
  readonly defaultFocusId: string;
  readonly primaryVerbKey: string;
  readonly transactionId: string | null;
  readonly affectedActionId: string | null;
}

export interface OverlayState {
  readonly tooltipKey: string | null;
  readonly nonCriticalOverlayKey: string | null;
  readonly blockingModal: BlockingModal | null;
  readonly toastKeys: readonly string[];
}

export function openBlockingModal(
  state: OverlayState,
  modal: BlockingModal,
): OverlayState {
  if (state.blockingModal) throw new Error('NAV_NESTED_BLOCKING_MODAL');
  if (modal.modalKey === 'unsavedChanges' && modal.defaultFocusId !== 'cancel') {
    throw new Error('NAV_MODAL_FOCUS_RESTORE_FAILED');
  }
  return {
    ...state,
    tooltipKey: null,
    nonCriticalOverlayKey: null,
    blockingModal: modal,
  };
}

export function closeBlockingModal(
  state: OverlayState,
  fallbackFocusId: string,
): { readonly state: OverlayState; readonly focusId: string } {
  const trigger = state.blockingModal?.triggerFocusId;
  return {
    state: { ...state, blockingModal: null },
    focusId: trigger ?? fallbackFocusId,
  };
}
