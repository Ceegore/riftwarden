import { fail, NavigationDiagnostic } from './diagnostic.mjs';
import { canonicalJson } from './canonical-json.mjs';

const primitiveTypes=new Set(['string','number','boolean']);

function validatePrimitive(value,type,key,maxStringLength) {
  if (!primitiveTypes.has(type)) fail('NAV_SOURCE_SCHEMA',`Unsupported param type ${type}`);
  if (typeof value!==type) fail('NAV_PARAM_TYPE',`Param ${key} must be ${type}`,{key,type});
  if (type==='number' && !Number.isFinite(value)) fail('NAV_PARAM_TYPE',`Param ${key} must be finite`);
  if (type==='string' && (value.length===0 || value.length>maxStringLength)) fail('NAV_PARAM_TYPE',`Param ${key} length invalid`);
}

export function validateRoute(route,{catalog,paramContracts,depth=0}={}) {
  if (!route || typeof route!=='object' || Array.isArray(route)) fail('NAV_ROUTE_NOT_SERIALIZABLE','Route must be an object');
  if (depth>paramContracts.maxReturnDepth) fail('NAV_RETURN_DEPTH',`ReturnRoute exceeds ${paramContracts.maxReturnDepth}`);
  const keys=new Set(['screenKey','params','returnRoute','restoreToken']);
  for (const key of Object.keys(route)) if (!keys.has(key)) fail('NAV_PARAM_UNKNOWN',`Unknown route field ${key}`);
  const entry=catalog.entries.find((e)=>e.screenKey===route.screenKey && e.kind==='screen');
  if (!entry) fail('NAV_UNKNOWN_SCREEN',`Unknown or non-screen route: ${String(route.screenKey)}`);
  if (!route.params || typeof route.params!=='object' || Array.isArray(route.params)) fail('NAV_PARAM_NON_PRIMITIVE','params must be an object');
  const schema=paramContracts.schemas[entry.paramSchemaId];
  if (!schema) fail('NAV_SOURCE_SCHEMA',`Unknown param schema ${entry.paramSchemaId}`);
  const allowed={...schema.required,...schema.optional};
  for (const [key,value] of Object.entries(route.params)) {
    if (!(key in allowed)) fail('NAV_PARAM_UNKNOWN',`Unknown route param ${key}`,{screenKey:entry.screenKey});
    if (value!==null && (typeof value==='object' || typeof value==='function' || typeof value==='undefined')) {
      fail('NAV_PARAM_NON_PRIMITIVE',`Non-primitive route param ${key}`);
    }
    validatePrimitive(value,allowed[key],key,paramContracts.maxStringLength);
  }
  for (const key of Object.keys(schema.required)) {
    if (!(key in route.params)) fail('NAV_PARAM_MISSING',`Missing route param ${key}`,{screenKey:entry.screenKey});
  }
  if (route.restoreToken!==undefined) validatePrimitive(route.restoreToken,'string','restoreToken',paramContracts.maxStringLength);
  if (route.returnRoute!==undefined) validateRoute(route.returnRoute,{catalog,paramContracts,depth:depth+1});
  try { JSON.stringify(route); } catch { fail('NAV_ROUTE_NOT_SERIALIZABLE','Route cannot be serialized'); }
  return route;
}

export function encodeRoute(route,options) {
  validateRoute(route,options);
  return canonicalJson(route);
}

export function decodeRoute(text,{safeFallback,...options}) {
  try {
    const route=JSON.parse(text);
    return {route:validateRoute(route,options),diagnostic:null};
  } catch (error) {
    const diagnostic=error instanceof NavigationDiagnostic?error:new NavigationDiagnostic('NAV_ROUTE_NOT_SERIALIZABLE',String(error));
    validateRoute(safeFallback,options);
    return {route:safeFallback,diagnostic:{code:diagnostic.code,details:diagnostic.details}};
  }
}

export function routeDepth(route) {
  let depth=0; let current=route;
  while (current?.returnRoute) { depth+=1; current=current.returnRoute; }
  return depth;
}
