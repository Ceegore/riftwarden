#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const task = process.argv[2];
if (!task || !/^[A-Za-z0-9:_-]+$/.test(task)) throw new Error('Pass one safe Gradle task name.');
const androidRoot = path.resolve('android');
const executable = process.platform === 'win32' ? '.\\gradlew.bat' : './gradlew';
// Windows cannot spawn a .bat directly with shell:false (EINVAL); cmd /c the
// wrapper there, keep direct spawning on POSIX (CI).
const result = spawnSync(executable, [task, '--no-daemon', '--stacktrace'], { cwd: androidRoot, stdio: 'inherit', shell: process.platform === 'win32' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
