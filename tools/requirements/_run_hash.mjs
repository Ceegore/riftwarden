// test wrapper for hash helper
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const e = promisify(execFile);
const out = await e('node', ['tools/requirements/_hash_helper.mjs', 'tools/requirements/_excerpts.txt', 'tools/requirements/_excerpts.hashes.txt']);
console.log(out.stdout || 'done');