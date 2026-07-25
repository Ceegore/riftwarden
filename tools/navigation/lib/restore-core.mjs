import { fail } from './diagnostic.mjs';
import { canonicalJson } from './canonical-json.mjs';

const forbidden=new Set(['functions','domNodes','eventObjects','tooltipPosition','hoverState','dragIntermediatePosition','renderInterpolation','particles','cameraOffset']);

function scan(value,path='root') {
  if (!value || typeof value!=='object') return;
  for (const [key,child] of Object.entries(value)) {
    if (forbidden.has(key)) fail('NAV_RESTORE_FORBIDDEN_FIELD',`Forbidden restore field ${key}`,{path:`${path}.${key}`});
    if (typeof child==='function') fail('NAV_RESTORE_FORBIDDEN_FIELD','Functions are forbidden in restore state',{path:`${path}.${key}`});
    scan(child,`${path}.${key}`);
  }
}

export function validateRestoreEnvelope(value) {
  scan(value);
  JSON.stringify(value);
  return value;
}
export function canonicalRestoreEnvelope(value) {
  validateRestoreEnvelope(value);
  return canonicalJson(value);
}
export function routeAfterLocaleSwitch(route) {
  return structuredClone(route);
}
export function deriveResumeRoute(save) {
  if (!save || save.valid!==true) return {screenKey:'bootstrapRecovery',params:{}};
  if (save.battleSnapshot) return {screenKey:'battle',params:{resume:true,runId:save.runId},restoreToken:save.restoreToken};
  if (save.committedNode) return {screenKey:'dungeonMap',params:{runId:save.runId,source:'resume'},restoreToken:save.restoreToken};
  if (save.profile) return {screenKey:'hqOverview',params:{}};
  return {screenKey:'title',params:{}};
}
