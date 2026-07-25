import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir,readFile } from 'node:fs/promises';
import { resolve,join,relative } from 'node:path';
const root=resolve(new URL('../..',import.meta.url).pathname);
async function walk(dir){const out=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())out.push(...await walk(p));else out.push(p);}return out;}
test('navigation starter contains no HTML injection or network path',async()=>{
  const files=(await walk(resolve(root,'src'))).filter((p)=>/\.(ts|tsx)$/u.test(p));
  for (const file of files) {
    const text=await readFile(file,'utf8'); const rel=relative(root,file);
    assert.doesNotMatch(text,/dangerouslySetInnerHTML|innerHTML\s*=|fetch\s*\(|XMLHttpRequest|https?:\/\//u,rel);
  }
});
test('browser history access is isolated to history mirror port',async()=>{
  const files=(await walk(resolve(root,'src'))).filter((p)=>/\.(ts|tsx)$/u.test(p));
  for (const file of files) {
    const text=await readFile(file,'utf8'); const rel=relative(root,file).replaceAll('\\','/');
    if (!rel.endsWith('history-mirror.ts')) assert.doesNotMatch(text,/window\.history|popstate/u,rel);
  }
});
test('no numeric screen alias is hard-coded in TypeScript starter',async()=>{
  const files=(await walk(resolve(root,'src'))).filter((p)=>/\.(ts|tsx)$/u.test(p)&&!p.includes('/generated/'));
  for (const file of files) assert.doesNotMatch(await readFile(file,'utf8'),/['"]S\d{2}['"]/u,relative(root,file));
});
