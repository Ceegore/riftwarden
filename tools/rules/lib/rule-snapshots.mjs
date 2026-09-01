export function validateRegistry(registry, snapshots) {
  const diagnostics=[]; const owners=new Map();
  for (const entry of registry.entries ?? []) {
    if (owners.has(entry.key)) diagnostics.push({code:'P11_RULE_SOURCE_DUPLICATE',path:entry.key,message:`owners ${owners.get(entry.key)} and ${entry.owner}`});
    owners.set(entry.key,entry.owner);
    const snap=snapshots[entry.owner];
    if (!snap || JSON.stringify(snap[entry.key])!==JSON.stringify(entry.value)) diagnostics.push({code:'P11_RULE_SNAPSHOT_DRIFT',path:entry.key,message:'registry/snapshot mismatch'});
    if (!String(entry.helperTestId??'').startsWith('P11-CONTRACT-')) diagnostics.push({code:'P11_REQ_TRACE_MISSING',path:entry.key,message:'helper test id missing'});
  }
  return diagnostics;
}
