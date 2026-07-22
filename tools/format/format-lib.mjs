import fs from 'node:fs';
import path from 'node:path';

export const extensions=new Set(['.json','.md','.css','.html','.yml','.yaml','.mjs','.js','.ts','.tsx']);
export function normalizedText(filePath) {
  const raw=fs.readFileSync(filePath,'utf8').replace(/\r\n?/g,'\n');
  if (path.extname(filePath) === '.json') {
    return `${JSON.stringify(JSON.parse(raw), null, 2)}\n`;
  }
  const source=raw;
  const lines=source.split('\n').map((line)=>line.replace(/[ \t]+$/g,''));
  while (lines.length > 1 && lines.at(-1) === '' && lines.at(-2) === '') lines.pop();
  return `${lines.join('\n').replace(/\n*$/,'')}\n`;
}
export function collect(root, result=[]) {
  if (!fs.existsSync(root)) return result;
  for (const entry of fs.readdirSync(root,{withFileTypes:true})) {
    if (['.git','node_modules','dist','android','ios','generated','backup','Phasen','Meldungen','.orchestration_source','coverage','.pnpm-store'].includes(entry.name)) continue;
    const full=path.join(root,entry.name);
    if (entry.isDirectory()) collect(full,result);
    else if (extensions.has(path.extname(entry.name)) || entry.name.startsWith('.')) result.push(full);
  }
  return result;
}
