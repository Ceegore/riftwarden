import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root=resolve(process.argv[2] ?? '.');
const manifest=JSON.parse(await readFile(resolve(root,'src/ui/typography/font-manifest.json'),'utf8'));
const diagnostics=[];
for (const family of manifest.families) {
  if (!family.licenseEvidence || family.licenseEvidence.status!=='approved') diagnostics.push({code:'P07_FONT_LICENSE_EVIDENCE_MISSING',family:family.id});
  for (const face of family.faces) {
    try { await access(resolve(root,face.path)); } catch { diagnostics.push({code:'P07_FONT_FILE_MISSING',family:family.id,path:face.path}); }
  }
}
const result={ok:diagnostics.length===0,diagnostics}; console.log(JSON.stringify(result,null,2)); if(!result.ok) process.exit(1);
