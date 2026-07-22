#!/usr/bin/env node
// Build chunk-d.json (P00-T02d) from a JSON data file.
// Reads data records from tools/requirements/_chunk_d_data.json
// and writes the staging file docs/requirements/requirements/_staging/chunk-d.json.
// Hashes are computed at build time.

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';

function sha(t) {
  return 'sha256:' + createHash('sha256').update(t, 'utf8').digest('hex');
}

function numConstraints(num) {
  if (!num) return [];
  const out = [];
  for (const part of num.split(';').map((s) => s.trim()).filter(Boolean)) {
    const parts = part.split('|').map((s) => s.trim());
    const obj = { unit: parts[0] };
    const expr = parts[1];
    if (expr.includes('..')) {
      const [lo, hi] = expr.split('..').map(Number);
      obj.min = lo;
      obj.max = hi;
    } else if (expr.startsWith('min:')) {
      obj.min = Number(expr.slice(4));
    } else if (expr.startsWith('max:')) {
      obj.max = Number(expr.slice(4));
    } else {
      obj.value = Number(expr);
    }
    if (parts[2]) obj.target = parts[2];
    out.push(obj);
  }
  return out;
}

function buildRequirement(record) {
  const ownerPhases = record.owners.split(',').map((s) => s.trim()).filter(Boolean);
  const ids = record.testIds.split(',').map((s) => s.trim()).filter(Boolean);
  const verification = [{ type: record.vtype, plannedPhase: record.planned, testIds: ids }];
  const numericConstraints = numConstraints(record.num);
  return {
    id: 'REQ-TEMP-D-' + String(record.seq).padStart(4, '0'),
    title: record.title,
    statement: record.statement,
    norm: record.norm,
    category: record.cat,
    source: {
      sourceId: 'gdd-v5',
      chapter: record.ch,
      section: record.section == null ? null : record.section,
      locator: record.loc,
      quoteHash: sha(record.excerpt),
      originalExcerpt: record.excerpt,
    },
    ownerPhases,
    verification,
    numericConstraints,
    relatedNormIds: [],
    relatedScreenIds: [],
    status: 'planned',
    notes: record.notes == null ? null : record.notes,
  };
}

async function main() {
  const dataPath = process.argv[2] || 'tools/requirements/_chunk_d_data.json';
  const outPath = process.argv[3] || 'docs/requirements/requirements/_staging/chunk-d.json';
  const raw = await readFile(dataPath, 'utf8');
  const data = JSON.parse(raw);
  const requirements = [];
  for (let i = 0; i < data.records.length; i += 1) {
    const rec = data.records[i];
    requirements.push(buildRequirement({ ...rec, seq: i + 1 }));
  }
  const chaptersWithReqs = new Set(requirements.map((r) => r.source.chapter));
  const contextOnly = [];
  for (let ch = 36; ch <= 50; ch += 1) {
    if (!chaptersWithReqs.has(ch)) {
      contextOnly.push({
        chapter: ch,
        reason: data.contextReason[ch] || 'Chapter ' + ch + ' contains no atomic normative statements independent of other chapters in this chunk.',
      });
    }
  }
  const out = {
    schemaVersion: '1.0',
    chunk: 'd',
    chapterRange: { lo: 36, hi: 50 },
    requirements,
    contextOnly,
  };
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log('Wrote ' + requirements.length + ' requirements to ' + outPath);
  console.log('Context-only chapters: ' + contextOnly.length);
}

main().catch((e) => {
  console.error(e.stack ?? e.message);
  process.exit(1);
});
