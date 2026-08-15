#!/usr/bin/env node
import path from "node:path"; import { fileURLToPath } from "node:url"; import { compileGraph } from "./lib/compiler-core.mjs"; import { loadSource, loadLocaleKeys } from "./lib/source-loader.mjs"; import { diagnosticOf } from "./lib/diagnostic.mjs";
function arg(name,fallback){const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:fallback;}
const root=path.resolve(arg("--root",process.cwd())); const out=path.resolve(root,arg("--out","content/generated")); const profile=arg("--profile","fixture");
try{const result=await compileGraph({root,outDir:out,profile,loadSource,loadLocaleKeys});console.log(JSON.stringify({status:"PASS",out,contentVersion:result.manifest.contentVersion,counts:result.manifest.counts},null,2));}catch(error){console.error(JSON.stringify({status:"FAIL",diagnostic:diagnosticOf(error)},null,2));process.exitCode=1;}
