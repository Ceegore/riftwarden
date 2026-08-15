import { fail } from "./diagnostic.mjs";
export const TICKS_PER_SECOND=30;
export function secondsToTicks(seconds, context={}) {
  if(typeof seconds!=="number"||!Number.isFinite(seconds)||seconds<0) fail("P09_SCHEMA_RANGE","Invalid seconds",context);
  const ticks=Math.round(seconds*TICKS_PER_SECOND); const drift=Math.abs(ticks/TICKS_PER_SECOND-seconds);
  if(drift>0.01) fail("P09_TICK_ROUNDING",`Rounding drift ${drift}`,{...context,seconds,ticks,drift});
  return ticks;
}
export function materializeTimes(value, context={}) {
  if(Array.isArray(value)) return value.map((x,i)=>materializeTimes(x,{...context,index:i}));
  if(value&&typeof value==="object"){
    const out={};
    for(const [key,item] of Object.entries(value)){
      if(key.endsWith("Seconds")){ if(typeof item==="number") out[`${key.slice(0,-7)}Ticks`]=secondsToTicks(item,{...context,field:key}); else if(item===null) out[`${key.slice(0,-7)}Ticks`]=null; else fail("P09_SCHEMA_TYPE",`Seconds field ${key} must be number or null`,{...context,field:key}); continue; }
      out[key]=materializeTimes(item,{...context,field:key});
    }
    return out;
  }
  return value;
}
