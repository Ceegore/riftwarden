import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const fixtures = fs.readdirSync('tests/fixtures/negative/lint').filter((name) => name.endsWith('.ts')).sort();
const failures = [];
for (const fixture of fixtures) {
  const result = spawnSync('pnpm', ['exec', 'eslint', `tests/fixtures/negative/lint/${fixture}`, '--no-ignore'], { encoding: 'utf8', shell: process.platform === 'win32' });
  if (result.status === 0) failures.push(`${fixture} unexpectedly passed.`);
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`All ${fixtures.length} negative lint fixtures failed as required.`);
