import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRoute,encodeRoute,decodeRoute,routeDepth } from '../../tools/navigation/lib/route-core.mjs';
import { loadContracts } from './test-helpers.mjs';

const fallback={screenKey:'bootstrapRecovery',params:{}};
test('minimal route validates and encodes canonically',async()=>{
  const {catalog,params}=await loadContracts(); const route={screenKey:'title',params:{}};
  assert.equal(validateRoute(route,{catalog,paramContracts:params}),route);
  assert.match(encodeRoute(route,{catalog,paramContracts:params}),/"screenKey": "title"/u);
});
test('route roundtrip preserves returnRoute and restoreToken',async()=>{
  const {catalog,params}=await loadContracts();
  const route={screenKey:'missionDetails',params:{missionId:'mission_001'},restoreToken:'r1',returnRoute:{screenKey:'missionBoard',params:{}}};
  const text=encodeRoute(route,{catalog,paramContracts:params});
  const decoded=decodeRoute(text,{catalog,paramContracts:params,safeFallback:fallback});
  assert.equal(decoded.diagnostic,null); assert.deepEqual(decoded.route,route);
});
test('route output is byte-identical for reordered param keys',async()=>{
  const {catalog,params}=await loadContracts();
  const a={screenKey:'battle',params:{source:'resume',resume:true,runId:'run_1'}};
  const b={screenKey:'battle',params:{runId:'run_1',resume:true,source:'resume'}};
  assert.equal(encodeRoute(a,{catalog,paramContracts:params}),encodeRoute(b,{catalog,paramContracts:params}));
});
test('unknown screen returns safe fallback and diagnostic',async()=>{
  const {catalog,params}=await loadContracts();
  const decoded=decodeRoute(JSON.stringify({screenKey:'nope',params:{}}),{catalog,paramContracts:params,safeFallback:fallback});
  assert.equal(decoded.route.screenKey,'bootstrapRecovery'); assert.equal(decoded.diagnostic.code,'NAV_UNKNOWN_SCREEN');
});
test('overlay cannot be used as route',async()=>{
  const {catalog,params}=await loadContracts();
  assert.throws(()=>validateRoute({screenKey:'toast',params:{}},{catalog,paramContracts:params}),(e)=>e.code==='NAV_UNKNOWN_SCREEN');
});
test('missing required parameter blocks',async()=>{
  const {catalog,params}=await loadContracts();
  assert.throws(()=>validateRoute({screenKey:'missionDetails',params:{}},{catalog,paramContracts:params}),(e)=>e.code==='NAV_PARAM_MISSING');
});
test('unknown parameter blocks',async()=>{
  const {catalog,params}=await loadContracts();
  assert.throws(()=>validateRoute({screenKey:'title',params:{evil:'x'}},{catalog,paramContracts:params}),(e)=>e.code==='NAV_PARAM_UNKNOWN');
});
test('object array and null params block',async()=>{
  const {catalog,params}=await loadContracts();
  for (const value of [{x:1},['x'],null]) {
    assert.throws(()=>validateRoute({screenKey:'battle',params:{runId:value}},{catalog,paramContracts:params}),(e)=>['NAV_PARAM_NON_PRIMITIVE','NAV_PARAM_TYPE'].includes(e.code));
  }
});
test('non-finite number blocks',async()=>{
  const {catalog,params}=await loadContracts();
  const clone=structuredClone(params); clone.schemas['params.runContext'].optional.turn='number';
  assert.throws(()=>validateRoute({screenKey:'battle',params:{turn:Infinity}},{catalog,paramContracts:clone}),(e)=>e.code==='NAV_PARAM_TYPE');
});
test('return route depth eight passes',async()=>{
  const {catalog,params}=await loadContracts(); let route={screenKey:'title',params:{}};
  for(let i=0;i<8;i++) route={screenKey:'title',params:{},returnRoute:route};
  validateRoute(route,{catalog,paramContracts:params}); assert.equal(routeDepth(route),8);
});
test('return route depth nine blocks',async()=>{
  const {catalog,params}=await loadContracts(); let route={screenKey:'title',params:{}};
  for(let i=0;i<9;i++) route={screenKey:'title',params:{},returnRoute:route};
  assert.throws(()=>validateRoute(route,{catalog,paramContracts:params}),(e)=>e.code==='NAV_RETURN_DEPTH');
});
test('malformed JSON decodes to fallback',async()=>{
  const {catalog,params}=await loadContracts(); const decoded=decodeRoute('{',{catalog,paramContracts:params,safeFallback:fallback});
  assert.equal(decoded.route.screenKey,'bootstrapRecovery'); assert.equal(decoded.diagnostic.code,'NAV_ROUTE_NOT_SERIALIZABLE');
});
