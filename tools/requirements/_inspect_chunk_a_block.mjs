import { readFile } from 'node:fs/promises';
const j = JSON.parse(await readFile('docs/requirements/requirements/_staging/chunk-a.json', 'utf8'));
console.log('Total REQs:', j.requirements.length);
console.log('Fields per REQ:', Object.keys(j.requirements[0]).sort());
console.log('Source fields:', Object.keys(j.requirements[0].source).sort());
console.log('Verification example:', JSON.stringify(j.requirements[0].verification, null, 2));
console.log('Sample REQ:');
console.log(JSON.stringify(j.requirements[0], null, 2));