#!/usr/bin/env node
import path from "node:path";
import fs from "node:fs/promises";
import { z } from "zod";
import { ENTITY_SCHEMAS } from "./lib/entity-schemas.mjs";

function arg(name, fallback) { const i = process.argv.indexOf(name); const v = i >= 0 ? process.argv[i + 1] : undefined; return v && !v.startsWith("--") ? v : fallback; }

const outDir = path.resolve(arg("--out", path.join(process.cwd(), "content/generated/json-schema")));
await fs.mkdir(outDir, { recursive: true });
for (const [type, schema] of Object.entries(ENTITY_SCHEMAS)) {
  await fs.writeFile(path.join(outDir, `${type}.schema.json`), `${JSON.stringify(z.toJSONSchema(schema), null, 2)}\n`);
}
console.log(JSON.stringify({ status: "PASS", out: outDir, types: Object.keys(ENTITY_SCHEMAS).sort() }));
