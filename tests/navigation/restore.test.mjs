import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalRestoreEnvelope,deriveResumeRoute,routeAfterLocaleSwitch,validateRestoreEnvelope } from '../../tools/navigation/lib/restore-core.mjs';

test('allowed view state validates and canonicalizes deterministically',()=>{
  const a={profile:'p1',views:{codexList:{sort:'name',filter:'boss',scrollAnchor:'boss_2'}}};
  const b={views:{codexList:{filter:'boss',scrollAnchor:'boss_2',sort:'name'}},profile:'p1'};
  assert.equal(canonicalRestoreEnvelope(a),canonicalRestoreEnvelope(b));
});
test('hover particle camera and drag intermediate state are forbidden',()=>{
  for (const key of ['hoverState','particles','cameraOffset','dragIntermediatePosition','tooltipPosition']) {
    assert.throws(()=>validateRestoreEnvelope({[key]:{}}),(e)=>e.code==='NAV_RESTORE_FORBIDDEN_FIELD');
  }
});
test('locale switch preserves route identity and navigation state',()=>{
  const route={screenKey:'missionDetails',params:{missionId:'mission_1'},restoreToken:'r',returnRoute:{screenKey:'missionBoard',params:{}}};
  const next=routeAfterLocaleSwitch(route); assert.deepEqual(next,route); assert.notEqual(next,route);
});
test('invalid save routes to semantic recovery',()=>assert.equal(deriveResumeRoute({valid:false}).screenKey,'bootstrapRecovery'));
test('valid profile without run routes to HQ',()=>assert.equal(deriveResumeRoute({valid:true,profile:true}).screenKey,'hqOverview'));
test('committed node resumes dungeon map',()=>assert.deepEqual(deriveResumeRoute({valid:true,profile:true,committedNode:true,runId:'r1',restoreToken:'t1'}),{screenKey:'dungeonMap',params:{runId:'r1',source:'resume'},restoreToken:'t1'}));
test('battle snapshot resumes paused battle intent',()=>assert.deepEqual(deriveResumeRoute({valid:true,profile:true,battleSnapshot:true,runId:'r1',restoreToken:'t1'}),{screenKey:'battle',params:{resume:true,runId:'r1'},restoreToken:'t1'}));
