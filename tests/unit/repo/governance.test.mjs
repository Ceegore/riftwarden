import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('PR template requires requirements, tests, line report, evidence and rollback', () => {
  const template = readFileSync('.github/PULL_REQUEST_TEMPLATE.md', 'utf8');
  for (const token of ['Canonical REQ IDs', 'Canonical TEST/MANUAL IDs', 'Changed files and line report', 'Evidence path', 'Risk and rollback', 'Gate decision']) {
    assert.equal(template.includes(token), true, `missing ${token}`);
  }
});

test('CODEOWNERS contains every critical path contract', () => {
  const codeowners = readFileSync('.github/CODEOWNERS', 'utf8');
  for (const path of ['/src/game/sim/', '/src/storage/', '/android/', '/ios/', '/content/', '/docs/release/', '/store/']) {
    assert.equal(codeowners.includes(path), true, `missing ${path}`);
  }
});

test('bootstrap workflow exposes stable required check names', () => {
  const workflow = readFileSync('.github/workflows/phase01-governance.yml', 'utf8');
  for (const name of ['name: verify-repo', 'name: file-length-check', 'name: text-normalization', 'name: repo-tests']) {
    assert.equal(workflow.includes(name), true, `missing ${name}`);
  }
});
