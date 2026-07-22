import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { verifyRoot } from '../../../tools/repo/verify-root-lib.mjs';

const thisFile = fileURLToPath(import.meta.url);
const starterRoot = resolve(dirname(thisFile), '../../..');

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'riftwarden-root-'));
  cpSync(starterRoot, root, { recursive: true });
  const codeownersPath = join(root, '.github/CODEOWNERS');
  writeFileSync(codeownersPath, readFileSync(codeownersPath, 'utf8').replaceAll(/@REPLACE_WITH_[A-Z_]+/g, '@valid-owner'));
  execFileSync('git', ['init', '-b', 'main'], { cwd: root, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'qa@example.invalid'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'QA'], { cwd: root });
  return root;
}

test('positive clean single-project fixture passes root contract', () => {
  const root = fixture();
  const report = verifyRoot(root);
  assert.equal(report.passed, true, JSON.stringify(report.findings, null, 2));
  rmSync(root, { recursive: true, force: true });
});

test('workspaces and forbidden lockfile fail', () => {
  const root = fixture();
  const packagePath = join(root, 'package.json');
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
  packageJson.workspaces = ['packages/*'];
  writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
  writeFileSync(join(root, 'package-lock.json'), '{}\n');
  const report = verifyRoot(root);
  assert.equal(report.passed, false);
  assert.equal(report.findings.some((entry) => entry.code === 'REPO_WORKSPACES'), true);
  assert.equal(report.findings.some((entry) => entry.code === 'REPO_FORBIDDEN_ROOT_FILE'), true);
  rmSync(root, { recursive: true, force: true });
});

test('tracked signing material fails', () => {
  const root = fixture();
  writeFileSync(join(root, 'release.keystore'), 'not-a-real-key\n');
  execFileSync('git', ['add', '-f', 'release.keystore'], { cwd: root });
  const report = verifyRoot(root);
  assert.equal(report.passed, false);
  assert.equal(report.findings.some((entry) => entry.code === 'REPO_TRACKED_SENSITIVE'), true);
  rmSync(root, { recursive: true, force: true });
});
