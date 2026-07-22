import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

// Hash every "originalExcerpt" line in chunk-l.json so we can paste the
// sha256:<hex> into the file. Idempotent: re-running with the same source
// produces the same result.
const data = JSON.parse(readFileSync('docs/requirements/requirements/_staging/chunk-l.json', 'utf8'));
for (const req of data.requirements) {
  const excerpt = req.source.originalExcerpt;
  const hash = createHash('sha256').update(excerpt, 'utf8').digest('hex');
  req.source.quoteHash = 'sha256:' + hash;
}
writeFileSync('docs/requirements/requirements/_staging/chunk-l.json', JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log('Hashed', data.requirements.length, 'requirements');
