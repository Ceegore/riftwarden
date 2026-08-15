#!/usr/bin/env node
import path from "node:path"; import fs from "node:fs/promises"; import { loadVerifiedBundle } from "./lib/runtime-core.mjs"; import { canonicalJson } from "./lib/canonical-json.mjs"; import { diagnosticOf } from "./lib/diagnostic.mjs";
function arg(name,fallback){const i=process.argv.indexOf(name);const v=i>=0?process.argv[i+1]:undefined;return v&&!v.startsWith("--")?v:fallback;}
const root=path.resolve(arg("--root",process.cwd())); const out=path.resolve(root,"content/generated");
try{const bundle=await loadVerifiedBundle(out);const report={status:"PASS",contentVersion:bundle.manifest.contentVersion,simulationVersion:bundle.manifest.simulationVersion,counts:bundle.manifest.counts,files:bundle.manifest.files};await fs.writeFile(path.join(out,"content-report.json"),canonicalJson(report));console.log(canonicalJson(report));}catch(error){console.error(JSON.stringify({status:"FAIL",diagnostic:diagnosticOf(error)},null,2));process.exitCode=1;}
