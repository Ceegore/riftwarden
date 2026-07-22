import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { toPosix } from './contracts.mjs';

const EXCLUDED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  '.pnpm-store',
  'dist',
  'build',
  'coverage',
  'playwright-report',
  'test-results',
  'DerivedData',
]);

export function gitRoot(root = process.cwd()) {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

export function listGitVisibleFiles(root) {
  try {
    const output = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return [...new Set(output.split('\0').filter(Boolean).map(toPosix))].sort();
  } catch {
    return listFilesRecursively(root);
  }
}

export function listTrackedFiles(root) {
  try {
    const output = execFileSync('git', ['ls-files', '-z'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return output.split('\0').filter(Boolean).map(toPosix).sort();
  } catch {
    return [];
  }
}

export function listFilesRecursively(root) {
  const result = [];
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && EXCLUDED_DIRECTORIES.has(entry.name)) continue;
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
      } else if (entry.isFile() || entry.isSymbolicLink()) {
        result.push(toPosix(relative(root, absolute)));
      }
    }
  }
  if (statSync(root).isDirectory()) walk(root);
  return result.sort();
}
