import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { repositoryRoot, writeJson } from './contracts.mjs';

/**
 * @typedef {Object} ToolchainCapture
 * @property {string} command
 * @property {boolean} available
 * @property {number|null} exitCode
 * @property {string} stdout
 * @property {string} stderr
 */

/**
 * Captures a single toolchain probe result.
 * @param {string} command Executable.
 * @param {string[]} args Args.
 * @returns {ToolchainCapture}
 */
function capture(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', shell: process.platform === 'win32' });
  return { command: [command, ...args].join(' '), available: result.status === 0, exitCode: result.status, stdout: (result.stdout ?? '').trim(), stderr: (result.stderr ?? '').trim() };
}
/** @type {ToolchainCapture[]} */
const checks = [
  capture('node', ['--version']),
  capture('corepack', ['--version']),
  capture('pnpm', ['--version']),
  capture('java', ['-version']),
  capture('git', ['--version']),
];
if (process.platform === 'darwin') {
  checks.push(capture('xcodebuild', ['-version']));
  checks.push(capture('swift', ['--version']));
} else {
  checks.push({ command: 'xcodebuild -version', available: false, exitCode: null, stdout: '', stderr: 'NOT_APPLICABLE_ON_NON_MACOS' });
}
writeJson(path.join(repositoryRoot, 'docs/reports/native-toolchains.json'), { schemaVersion: 1, capturedAt: new Date().toISOString(), platform: process.platform, arch: process.arch, checks });
console.log('Captured observable toolchain versions. This does not install or certify native toolchains.');
