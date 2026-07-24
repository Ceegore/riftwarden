import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from '../lib/fs-utils.mjs';

const args = parseArgs(process.argv.slice(2));
const input = args.input ?? 'artifacts/security/license-report.json';
const out = args.out ?? 'artifacts/security/sbom.cdx.json';
const report = JSON.parse(await readFile(input, 'utf8'));
const components = report.components.map((x) => ({
  type: 'library',
  'bom-ref': `pkg:npm/${encodeURIComponent(x.name)}@${x.version}`,
  group: x.name.startsWith('@') ? x.name.split('/')[0].slice(1) : undefined,
  name: x.name,
  version: x.version,
  scope: x.scope === 'runtime' ? 'required' : 'optional',
  purl: `pkg:npm/${encodeURIComponent(x.name)}@${x.version}`,
  licenses: [{ license: { id: String(x.license) } }],
  properties: [{ name: 'riftwarden:dependency-class', value: x.scope }]
}));
const serial = createHash('sha256').update(JSON.stringify(components)).digest('hex');
const bom = { bomFormat: 'CycloneDX', specVersion: '1.6', serialNumber: `urn:uuid:${serial.slice(0,8)}-${serial.slice(8,12)}-4${serial.slice(13,16)}-a${serial.slice(17,20)}-${serial.slice(20,32)}`, version: 1, metadata: { component: { type: 'application', name: report.package } }, components };
await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify(bom, null, 2)}\n`);
console.log(out);
