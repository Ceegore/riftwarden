import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveBack,predictiveBackBegin,predictiveBackCancel,predictiveBackCommit } from '../../tools/navigation/lib/back-core.mjs';

const base={tooltipOpen:false,nonCriticalOverlayOpen:false,modal:null,pendingCommitId:null,policyId:'safePrevious',platform:'android',nowMs:1000,exitArmedAtMs:null};
test('back priority closes tooltip before everything',()=>assert.equal(resolveBack({...base,tooltipOpen:true,nonCriticalOverlayOpen:true,modal:{safeToClose:true}}).type,'closeTooltip'));
test('back priority closes noncritical overlay before modal',()=>assert.equal(resolveBack({...base,nonCriticalOverlayOpen:true,modal:{safeToClose:true}}).type,'closeNonCriticalOverlay'));
test('safe modal closes',()=>assert.equal(resolveBack({...base,modal:{safeToClose:true}}).type,'closeModal'));
test('pending commit cannot be canceled by back',()=>assert.deepEqual(resolveBack({...base,modal:{safeToClose:true},pendingCommitId:'tx1'}),{type:'blocked',code:'NAV_BACK_PENDING_COMMIT'}));
test('dungeon back opens menu and does not leave run',()=>assert.equal(resolveBack({...base,policyId:'openExpeditionMenu'}).type,'openExpeditionMenu'));
test('battle back pauses before menu',()=>assert.equal(resolveBack({...base,policyId:'pauseAndOpenBattleMenu'}).type,'pauseAtCompleteTickThenOpenBattleMenu'));
test('reward back is blocked',()=>assert.deepEqual(resolveBack({...base,policyId:'blockedUntilRewardDecision'}),{type:'blocked',code:'NAV_BACK_RUN_LOSS_RISK'}));
test('unsaved formation opens apply discard cancel with cancel focus',()=>assert.deepEqual(resolveBack({...base,policyId:'unsavedAwarePrevious'}),{type:'openUnsavedChangesModal',defaultFocus:'cancel'}));
test('first Android HQ back arms two-second window',()=>assert.deepEqual(resolveBack({...base,policyId:'doubleBackExitAndroid'}),{type:'armExitWindow',expiresAtMs:3000}));
test('second Android HQ back inside window requests native exit',()=>assert.equal(resolveBack({...base,policyId:'doubleBackExitAndroid',nowMs:2500,exitArmedAtMs:1000}).type,'requestNativeExit'));
test('second Android HQ back outside window rearms',()=>assert.equal(resolveBack({...base,policyId:'doubleBackExitAndroid',nowMs:4001,exitArmedAtMs:1000}).type,'armExitWindow'));
test('iOS never requests programmatic exit',()=>assert.equal(resolveBack({...base,policyId:'doubleBackExitAndroid',platform:'ios',exitArmedAtMs:1000}).type,'noop'));
test('predictive gesture mutates nothing until commit',()=>{
  const preview=predictiveBackBegin({...base,policyId:'openExpeditionMenu'});
  assert.equal(preview.committed,false); assert.equal(predictiveBackCancel(preview).canceled,true); assert.equal(predictiveBackCommit(preview).committed,true);
});
