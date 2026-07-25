import { readdir, readFile } from 'node:fs/promises'; import { resolve, join } from 'node:path';
const root=resolve(process.argv[2] ?? 'dist');
const patterns=['ComponentGalleryScreen','/dev/component-gallery','VITE_FIXED_TEST_SEED','data-rw-dev-only','qps-ploc'];
async function files(dir){ const out=[]; for(const e of await readdir(dir,{withFileTypes:true})){const p=join(dir,e.name); if(e.isDirectory()) out.push(...await files(p)); else out.push(p);} return out; }
const hits=[]; for(const file of await files(root)){ if(!/\.(js|css|html|json|map)$/.test(file)) continue; const text=await readFile(file,'utf8'); for(const pattern of patterns) if(text.includes(pattern)) hits.push({file,pattern}); }
console.log(JSON.stringify({ok:hits.length===0,hits},null,2)); if(hits.length) process.exit(1);
