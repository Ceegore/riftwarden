#!/usr/bin/env node
import {readFileSync} from 'node:fs'; import {validatePublishedIds} from './lib/published-ids.mjs';
const [prevPath,nextPath]=process.argv.slice(2); if(!prevPath||!nextPath)throw new Error('usage: previous next');
const diagnostics=validatePublishedIds(JSON.parse(readFileSync(prevPath,'utf8')),JSON.parse(readFileSync(nextPath,'utf8')));
console.log(JSON.stringify({status:diagnostics.length?'BLOCKED':'PASS',diagnostics},null,2));process.exitCode=diagnostics.length?2:0;
