#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const task = process.argv[2];
if (!task || !/^[A-Za-z0-9:_-]+$/.test(task)) throw new Error('Pass one safe Gradle task name.');
const androidRoot = path.resolve('android');
const executable = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
const result = spawnSync(executable, [task, '--no-daemon', '--stacktrace'], { cwd: androidRoot, stdio: 'inherit', shell: false });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
