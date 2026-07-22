#!/usr/bin/env node
// Build chunk-a.json (P00-T02a) from a JSON data file.
// Reads data records from tools/requirements/_chunk_a_data.json
// and writes the staging file docs/requirements/requirements/_staging/chunk-a.json.
// Hashes are computed at build time.
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';

function sha(t) { return 'sha256:' + createHash('sha256').update(t, 'utf8').digest('hex'); }

function buildRequirement(record) {
  const ownerPhases = record.owners.split(',').map((s) => s.trim()).filter(Boolean);
  const ids = record.testIds.split(',').map((s) => s.trim()).filter(Boolean);
  const verification = [{ type: 'unit', plannedPhase: record.planned, testIds: ids }];
  const numericConstraints = [];
  if (record.num) {
    for (const part of record.num.split(';').map((s) => s.trim()).filter(Boolean)) {
      const parts = part.split('|').map((s) => s.trim());
      const obj = { unit: parts[0] };
      const expr = parts[1];
      if (expr.includes('..')) {
        const [lo, hi] = expr.split('..').map(Number);
        obj.min = lo; obj.max = hi;
      } else if (expr.startsWith('min:')) {
        obj.min = Number(expr.slice(4));
      } else if (expr.startsWith('max:')) {
        obj.max = Number(expr.slice(4));
      } else {
        obj.value = Number(expr);
      }
      if (parts[2]) obj.target = parts[2];
      numericConstraints.push(obj);
    }
  }
  return {
    statement: record.statement,
    norm: record.norm,
    category: record.cat,
    source: { sourceId: 'gdd-v5', chapter: record.ch, section: null, locator: record.loc,
              quoteHash: sha(record.excerpt), originalExcerpt: record.excerpt },
    ownerPhases, verification, numericConstraints,
  };
}

async function main() {
  const dataPath = process.argv[2] || 'tools/requirements/_chunk_a_data.json';
  const outPath = process.argv[3] || 'docs/requirements/requirements/_staging/chunk-a.json';
  const raw = await readFile(dataPath, 'utf8');
  const data = JSON.parse(raw);
  const requirements = [];
  for (let i = 0; i < data.records.length; i += 1) {
    const rec = data.records[i];
    const req = buildRequirement(rec);
    requirements.push({
      id: 'REQ-TEMP-A-' + String(i + 1).padStart(4, '0'),
      title: rec.statement.length > 80 ? rec.statement.slice(0, 77) + '...' : rec.statement,
      statement: rec.statement,
      norm: rec.norm,
      category: rec.cat,
      source: req.source,
      ownerPhases: req.ownerPhases,
      verification: req.verification,
      numericConstraints: req.numericConstraints,
      relatedNormIds: [],
      relatedScreenIds: [],
      status: 'planned',
      notes: null,
    });
  }
  // Build contextOnly list (chapters that did not yield any REQ)
  const chaptersWithReqs = new Set(requirements.map((r) => r.source.chapter));
  const contextOnly = [];
  for (let ch = 1; ch <= 29; ch += 1) {
    if (!chaptersWithReqs.has(ch)) {
      contextOnly.push({ chapter: ch, reason: 'Chapter ' + ch + ' yielded no atomic normative statements beyond the ones already captured.' });
    }
  }
  const out = {
    schemaVersion: '1.0',
    chunk: 'a',
    chapterRange: { lo: 1, hi: 29 },
    requirements,
    contextOnly,
  };
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log('Wrote ' + requirements.length + ' requirements to ' + outPath);
  console.log('Context-only chapters: ' + contextOnly.length);
}

main().catch((e) => { console.error(e.stack ?? e.message); process.exit(1); });