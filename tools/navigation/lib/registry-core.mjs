import { fail } from './diagnostic.mjs';
import { canonicalJson } from './canonical-json.mjs';

const expectedScreenAliases = [
  ...Array.from({length:66},(_,i)=>`S${String(i).padStart(2,'0')}`),
].filter((id)=>!['S37','S38','S39','S58','S59'].includes(id));
const expectedOverlayAliases = Array.from({length:7},(_,i)=>`O${String(i+1).padStart(2,'0')}`);

function unique(values, code, field) {
  const seen=new Set();
  for (const value of values) {
    if (seen.has(value)) fail(code,`Duplicate ${field}: ${value}`,{field,value});
    seen.add(value);
  }
}

export function validateCatalog(catalog) {
  if (!catalog || catalog.schemaVersion !== 1 || !Array.isArray(catalog.entries)) {
    fail('NAV_SOURCE_SCHEMA','screen registry source schema is invalid');
  }
  unique(catalog.entries.map((e)=>e.screenKey),'NAV_DUPLICATE_SCREEN_KEY','screenKey');
  unique(catalog.entries.map((e)=>e.section7Alias),'NAV_DUPLICATE_NUMERIC_ALIAS','section7Alias');
  for (const entry of catalog.entries) {
    if (!/^[a-z][A-Za-z0-9]*$/u.test(entry.screenKey)) fail('NAV_SOURCE_SCHEMA',`Invalid screenKey: ${entry.screenKey}`);
    if (!/^[SO]\d{2}$/u.test(entry.section7Alias)) fail('NAV_SOURCE_SCHEMA',`Invalid alias: ${entry.section7Alias}`);
    if (!['screen','overlay'].includes(entry.kind)) fail('NAV_SOURCE_SCHEMA',`Invalid kind: ${entry.kind}`);
    for (const field of ['ownerPhase','testId','paramSchemaId','backPolicyId','group','loaderId']) {
      if (typeof entry[field] !== 'string' || entry[field].length === 0) fail('NAV_SOURCE_SCHEMA',`Missing ${field}`,{screenKey:entry.screenKey});
    }
  }
  for (const alias of catalog.reservedAliases ?? []) {
    if (catalog.entries.some((e)=>e.section7Alias===alias)) fail('NAV_RESERVED_ALIAS_ROUTABLE',`Reserved alias is routable: ${alias}`);
  }
  const actualScreens=catalog.entries.filter((e)=>e.kind==='screen').map((e)=>e.section7Alias).sort();
  const actualOverlays=catalog.entries.filter((e)=>e.kind==='overlay').map((e)=>e.section7Alias).sort();
  if (canonicalJson(actualScreens)!==canonicalJson(expectedScreenAliases.sort())) fail('NAV_SOURCE_SCHEMA','Screen alias coverage differs from section 7');
  if (canonicalJson(actualOverlays)!==canonicalJson(expectedOverlayAliases.sort())) fail('NAV_SOURCE_SCHEMA','Overlay alias coverage differs from section 7');
  return catalog;
}

export function validateAliasResolution(source,{release=false}={}) {
  if (source.conflictId!=='NORM-003') fail('NAV_SOURCE_SCHEMA','Missing NORM-003 alias contract');
  if (release && (!source.approvedResolution || source.status!=='APPROVED')) {
    fail('NAV_NORM_003_UNRESOLVED','Numeric ScreenId aliases remain blocked by NORM-003');
  }
  if (source.approvedResolution) {
    const aliases=Object.values(source.approvedResolution);
    unique(aliases,'NAV_DUPLICATE_NUMERIC_ALIAS','approved numeric alias');
  }
  return source;
}

export function registryGroups(catalog, aliasSource) {
  validateCatalog(catalog);
  const approved=aliasSource.approvedResolution ?? {};
  const grouped={};
  for (const entry of catalog.entries) {
    (grouped[entry.group] ??= []).push({
      ...entry,
      numericAlias: approved[entry.screenKey] ?? null,
      aliasStatus: approved[entry.screenKey] ? 'approved' : 'blocked',
    });
  }
  for (const values of Object.values(grouped)) values.sort((a,b)=>a.screenKey.localeCompare(b.screenKey));
  return grouped;
}

function tsLiteral(value) {
  return JSON.stringify(value,null,2).replaceAll('"screenKey"', 'screenKey').replaceAll('"numericAlias"', 'numericAlias');
}

export function renderGroupTs(group, entries) {
  return `// GENERATED. DO NOT EDIT. Source: screen-registry.source.json + screen-alias-resolution.source.json\n`+
    `import type { ScreenRegistration } from '../screen-registration';\n`+
    `export const ${group}Registrations = ${tsLiteral(entries)} as const satisfies readonly ScreenRegistration[];\n`;
}

export function renderIndexTs(groups) {
  const names=Object.keys(groups).sort();
  return `// GENERATED. DO NOT EDIT.\n`+
    names.map((g)=>`import { ${g}Registrations } from './registry-${g}';`).join('\n')+
    `\nexport const generatedScreenRegistrations = [\n`+
    names.map((g)=>`  ...${g}Registrations,`).join('\n')+
    `\n] as const;\n`;
}
