import test from 'node:test';
import assert from 'node:assert/strict';
import { createOverlayState,openBlockingModal,closeBlockingModal,beginTransaction,canActivate } from '../../tools/navigation/lib/overlay-core.mjs';

const confirm={kind:'confirmation',defaultFocus:'cancel',primaryVerbKey:'reward.choose'};
test('only one blocking modal is allowed',()=>{
  const first=openBlockingModal(createOverlayState(),confirm);
  assert.throws(()=>openBlockingModal(first,confirm),(e)=>e.code==='NAV_NESTED_BLOCKING_MODAL');
});
test('opening modal closes tooltip and noncritical overlay but keeps toasts',()=>{
  const state={...createOverlayState(),tooltip:'tip',nonCriticalOverlay:'drawer',toasts:['saved']};
  const next=openBlockingModal(state,confirm);
  assert.equal(next.tooltip,null); assert.equal(next.nonCriticalOverlay,null); assert.deepEqual(next.toasts,['saved']);
});
test('unsaved changes defaults focus to cancel',()=>{
  assert.throws(()=>openBlockingModal(createOverlayState(),{kind:'unsavedChanges',defaultFocus:'apply',primaryVerbKey:'changes.apply'}),(e)=>e.code==='NAV_MODAL_FOCUS_RESTORE_FAILED');
});
test('generic OK verb is rejected',()=>{
  assert.throws(()=>openBlockingModal(createOverlayState(),{kind:'confirmation',defaultFocus:'cancel',primaryVerbKey:'common.ok'}),(e)=>e.code==='NAV_UNSAFE_MODAL_VERB');
});
test('focus returns to trigger then sibling then heading',()=>{
  const state=openBlockingModal(createOverlayState(),confirm);
  assert.equal(closeBlockingModal(state,{triggerExists:true}).focusTarget,'trigger');
  assert.equal(closeBlockingModal(state,{triggerExists:false,logicalSiblingExists:true}).focusTarget,'logicalSibling');
  assert.equal(closeBlockingModal(state,{triggerExists:false,logicalSiblingExists:false}).focusTarget,'screenHeading');
});
test('transaction locks only affected action',()=>{
  const state=beginTransaction(openBlockingModal(createOverlayState(),confirm),'tx1','buy');
  assert.equal(canActivate(state,'buy'),false); assert.equal(canActivate(state,'backToList'),true);
});
