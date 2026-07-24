import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * @typedef {{ path: string, sha256: string, bytes: number }} BuildArtifact
 */

/**
 * @typedef {{
 *   schemaVersion: number,
 *   channel: string,
 *   files: BuildArtifact[]
 * }} BuildHashReport
 */

const channelArg = process.argv[2];
if (channelArg === undefined || !['dev', 'qa', 'release'].includes(channelArg)) throw new Error('Usage: run-build.mjs dev|qa|release');
const channel = channelArg;
const env = { ...process.env, VITE_BUILD_CHANNEL: channel };
/** @type {import('node:child_process').SpawnSyncOptions} */
const validateOptions = { stdio: 'inherit', env };
const validation = spawnSync(process.execPath, ['tools/env/validate.mjs', '--channel', channel], validateOptions);
if (validation.status !== 0) process.exit(validation.status ?? 1);
/** @type {import('node:child_process').SpawnSyncOptions} */
const buildOptions = { stdio: 'inherit', shell: process.platform === 'win32', env };
const build = spawnSync('pnpm', ['exec', 'vite', 'build', '--mode', channel], buildOptions);
if (build.status !== 0) process.exit(build.status ?? 1);
/** @type {BuildArtifact[]} */
const files = [];
/**
 * Walks the dist directory and records artifact metadata.
 * @param {string} dir Current directory.
 */
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else files.push({ path: path.relative('dist', full).replaceAll('\\', '/'), sha256: createHash('sha256').update(fs.readFileSync(full)).digest('hex'), bytes: fs.statSync(full).size });
  }
}
walk('dist');
files.sort((a, b) => a.path.localeCompare(b.path));
fs.mkdirSync('docs/reports', { recursive: true });
fs.writeFileSync(`docs/reports/build-${channel}-hashes.json`, `${JSON.stringify({ schemaVersion: 1, channel, files }, null, 2)}\n`, 'utf8');
