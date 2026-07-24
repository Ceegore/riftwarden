#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import os from 'node:os';

function command(file, args = []) {
  try { return { available: true, output: execFileSync(file, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim() }; }
  catch (error) { return { available: false, output: '', error: error instanceof Error ? error.message : String(error) }; }
}

const report = {
  schemaVersion: 1,
  platform: process.platform,
  arch: process.arch,
  osRelease: os.release(),
  node: process.version,
  java: command('java', ['-version']),
  gradleWrapper: process.platform === 'win32' ? command('android\\gradlew.bat', ['--version']) : command('./android/gradlew', ['--version']),
  xcodebuild: command('xcodebuild', ['-version']),
  xcrun: command('xcrun', ['simctl', 'list', 'devices', 'available']),
  adb: command('adb', ['version']),
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
