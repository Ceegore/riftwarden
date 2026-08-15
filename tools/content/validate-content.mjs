#!/usr/bin/env node
import path from "node:path"; import os from "node:os"; import fs from "node:fs/promises"; import { compileGraph } from "./lib/compiler-core.mjs"; import { loadSource, loadLocaleKeys } from "./lib/source-loader.mjs"; import { diagnosticOf } from "./lib/diagnostic.mjs";
function arg(name,fallback){const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:fallback;}
const root=path.resolve(arg("--root",process.cwd()));const profile=arg("--profile","fixture");const temp=await fs.mkdtemp(path.join(os.tmpdir(),"riftwarden-p09-validate-"));
try{const result=await compileGraph({root,outDir:temp,profile,loadSource,loadLocaleKeys});console.log(JSON.stringify({status:"PASS",profile,counts:result.manifest.counts},null,2));}catch(error){console.error(JSON.stringify({status:"FAIL",diagnostic:diagnosticOf(error)},null,2));process.exitCode=1;}finally{await fs.rm(temp,{recursive:true,force:true});}
