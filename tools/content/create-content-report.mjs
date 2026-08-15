#!/usr/bin/env node
import path from "node:path"; import fs from "node:fs/promises"; import { loadVerifiedBundle } from "./lib/runtime-core.mjs"; import { canonicalJson } from "./lib/canonical-json.mjs"; import { diagnosticOf } from "./lib/diagnostic.mjs";
function arg(name,fallback){const i=process.argv.indexOf(name);const v=i>=0?process.argv[i+1]:undefined;return v&&!v.startsWith("--")?v:fallback;}
// §11: JSON and Markdown reports derive from the same sorted DTO. No timestamps
// in the deterministic core payload; execution time belongs in evidence
// metadata outside the compared payload.
export function renderMarkdownReport(report) {
  const lines = [];
  lines.push("# Riftwarden Content Report", "");
  lines.push(`- status: \`${report.status}\``);
  lines.push(`- contentVersion: \`${report.contentVersion}\``);
  lines.push(`- simulationVersion: \`${report.simulationVersion}\``);
  lines.push("", "## Counts", "");
  lines.push("| EntityType | Count |", "| --- | ---: |");
  for (const [type, count] of Object.entries(report.counts).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    lines.push(`| ${type} | ${count} |`);
  }
  lines.push("", "## Files", "");
  lines.push("| Path | SHA-256 | ByteLength | EntityType |", "| --- | --- | ---: | --- |");
  for (const file of report.files) {
    lines.push(`| ${file.path} | \`${file.sha256}\` | ${file.byteLength} | ${file.entityType} |`);
  }
  return `${lines.join("\n")}\n`;
}
const root=path.resolve(arg("--root",process.cwd())); const out=path.resolve(root,"content/generated");
try{const bundle=await loadVerifiedBundle(out);const report={status:"PASS",contentVersion:bundle.manifest.contentVersion,simulationVersion:bundle.manifest.simulationVersion,counts:bundle.manifest.counts,files:bundle.manifest.files};await fs.writeFile(path.join(out,"content-report.json"),canonicalJson(report));await fs.writeFile(path.join(out,"content-report.md"),renderMarkdownReport(report));console.log(canonicalJson(report));}catch(error){console.error(JSON.stringify({status:"FAIL",diagnostic:diagnosticOf(error)},null,2));process.exitCode=1;}
