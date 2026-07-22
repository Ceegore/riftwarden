#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Runs a command and returns its trimmed stdout, or fallback on failure.
 * @param {string[]} args Args array where args[0] is the executable.
 * @param {string|null} fallback Fallback value on failure.
 * @returns {string|null}
 */
function command(args, fallback = null) {
  try {
    return execFileSync(args[0], args.slice(1), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    return fallback;
  }
}

const report = {
  schemaVersion: 1,
  capturedAtUtc: new Date().toISOString(),
  sourceRevision: command(['git', 'rev-parse', 'HEAD']),
  branch: command(['git', 'branch', '--show-current']),
  gitRoot: command(['git', 'rev-parse', '--show-toplevel']),
  workingTreePorcelainV2: command(['git', 'status', '--porcelain=v2', '--branch'], ''),
  nodeVersion: process.version,
  pnpmVersion: command(['pnpm', '--version']),
  corepackVersion: command(['corepack', '--version']),
  platform: process.platform,
  architecture: process.arch,
  gateG00Status: 'UNVERIFIED',
  gateG00EvidencePaths: [],
  openDefects: [],
};

const output = resolve('docs/reports/generated/phase-01-preflight.json');
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
process.stdout.write(`${output}\n`);
