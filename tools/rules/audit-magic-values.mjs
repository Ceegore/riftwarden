#!/usr/bin/env node
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {auditTree} from './lib/magic-audit.mjs';
const root=resolve(process.argv[2]??'src'); const allowPath=process.argv[3];
const allow=allowPath?JSON.parse(readFileSync(allowPath,'utf8')):{schemaVersion:1,entries:[]};
const diagnostics=auditTree(root,allow); console.log(JSON.stringify({status:diagnostics.length?'BLOCKED':'PASS',diagnostics},null,2)); process.exitCode=diagnostics.length?2:0;
