import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

// Windows-compat: use fileURLToPath instead of URL.pathname (which yields
// "/C:/..." on Windows and resolves to "C:\C:\..."). Declared baseline fix
// (P00-T01); starter-kit path-resolution bug, not game logic.
const kitRoot = join(fileURLToPath(new URL('../../..', import.meta.url)));

async function writeJson(root, relative, value) {
  const target = join(root, relative);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function readJson(root, relative) {
  return JSON.parse(await readFile(join(root, relative), 'utf8'));
}

async function makeFixture() {
  const root = await mkdtemp(join(tmpdir(), 'riftwarden-phase00-'));
  await cp(join(kitRoot, 'docs'), join(root, 'docs'), { recursive: true });
  await cp(join(kitRoot, 'tools'), join(root, 'tools'), { recursive: true });

  const sourcePath = 'docs/source/Riftwarden_GDD_V5_0.docx';
  const sourceBytes = Buffer.from('test-only-gdd-v5-source');
  await mkdir(join(root, 'docs/source'), { recursive: true });
  await writeFile(join(root, sourcePath), sourceBytes);
  const sourceHash = createHash('sha256').update(sourceBytes).digest('hex');

  const manifest = await readJson(root, 'docs/requirements/source-manifest.json');
  manifest.authorityStatus = 'frozen';
  manifest.publisherConfirmation.status = 'confirmed';
  manifest.publisherConfirmation.confirmedBy = 'test-publisher';
  manifest.publisherConfirmation.confirmedAt = '2026-07-16T00:00:00Z';
  manifest.files[0].path = sourcePath;
  manifest.files[0].sha256 = sourceHash;
  manifest.files[0].byteSize = sourceBytes.length;
  manifest.chapterAudit.status = 'complete';
  manifest.frozenAt = '2026-07-16T00:00:00Z';
  manifest.frozenBy = 'test-agent';
  await writeJson(root, 'docs/requirements/source-manifest.json', manifest);

  const headings = {
    schemaVersion: 1,
    sourceId: 'gdd-v5',
    headings: Array.from({ length: 87 }, (_, index) => ({
      chapter: index + 1,
      title: `Chapter ${index + 1}`,
      locator: `block:${index + 1}`,
      styleId: 'Heading1',
      extractionMethod: 'test_fixture',
      confidence: 'high',
      reviewStatus: 'verified',
      reviewedBy: 'test-reviewer',
      reviewedAt: '2026-07-16T00:00:00Z',
    })),
  };
  await writeJson(root, 'docs/requirements/source-headings.json', headings);
  await writeJson(root, 'docs/requirements/source-findings.json', {
    schemaVersion: 1,
    sourceSha256: sourceHash,
    findings: [],
  });

  await writeJson(root, 'docs/requirements/generated/source-structure.json', {
    schemaVersion: 1,
    source: { fileName: 'Riftwarden_GDD_V5_0.docx', sha256: sourceHash },
    blocks: [],
    headingCandidates: [],
    unsupportedCounts: { drawings: 0, textBoxes: 0, altChunks: 0, embeddedObjects: 0 },
    reviewRequired: false,
  });

  const requirements = [];
  const tests = [];
  const links = [];
  for (let chapter = 1; chapter <= 87; chapter += 1) {
    const reqId = `REQ-QA-${String(chapter).padStart(4, '0')}`;
    const testId = `UT-REQ-CHAPTER-${String(chapter).padStart(3, '0')}`;
    const excerpt = `Chapter ${chapter} test requirement`;
    requirements.push({
      id: reqId,
      title: `Chapter ${chapter} requirement`,
      statement: `The implementation MUST satisfy the verified rule from chapter ${chapter}.`,
      norm: 'MUST',
      category: 'QA',
      source: {
        sourceId: 'gdd-v5',
        chapter,
        section: null,
        locator: `block:${chapter}`,
        quoteHash: `sha256:${createHash('sha256').update(excerpt).digest('hex')}`,
        originalExcerpt: excerpt,
      },
      ownerPhases: ['PHASE-00'],
      verification: [{ type: 'unit', plannedPhase: 'PHASE-00', testIds: [testId] }],
      numericConstraints: [],
      relatedNormIds: chapter <= 21 ? [`NORM-${String(chapter).padStart(3, '0')}`] : [],
      relatedScreenIds: [],
      status: 'planned',
      notes: null,
    });
    tests.push({
      id: testId,
      title: `Verify chapter ${chapter} traceability`,
      status: 'planned',
      ownerPhase: 'PHASE-00',
      method: 'unit',
    });
    links.push({
      requirementId: reqId,
      testIds: [testId],
      phaseIds: ['PHASE-00'],
      screenIds: [],
      normIds: chapter <= 21 ? [`NORM-${String(chapter).padStart(3, '0')}`] : [],
    });
  }
  await writeJson(root, 'docs/requirements/requirements/qa.json', {
    schemaVersion: 1,
    category: 'QA',
    requirements,
  });
  await writeJson(root, 'docs/requirements/chapter-dispositions.json', { schemaVersion: 1, chapters: [] });
  await writeJson(root, 'docs/requirements/tests.json', { schemaVersion: 1, tests });
  await writeJson(root, 'docs/requirements/traceability.json', { schemaVersion: 1, links });

  const ledgerIndex = await readJson(root, 'docs/requirements/normalization-ledger.json');
  const ledgerRecords = [];
  for (const childPath of ledgerIndex.files) {
    const child = await readJson(root, childPath);
    ledgerRecords.push(...child.records);
  }
  const ledger = {
    schemaVersion: 1,
    authorityOrder: ledgerIndex.authorityOrder,
    records: ledgerRecords.map((record, index) => ({
      ...record,
      affectedRequirementIds: [`REQ-QA-${String(index + 1).padStart(4, '0')}`],
      reviewStatus: 'verified',
      reviewedBy: 'test-reviewer',
      reviewedAt: '2026-07-16T00:00:00Z',
    })),
  };
  await writeJson(root, 'docs/requirements/normalization-ledger.json', ledger);
  return root;
}

function runValidator(root, mode = 'gate') {
  return spawnSync(process.execPath, ['tools/requirements/validate.mjs', `--mode=${mode}`], {
    cwd: root,
    encoding: 'utf8',
  });
}

test('complete G00 fixture passes gate validation', async () => {
  const root = await makeFixture();
  const result = runValidator(root);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /Result: PASS/);
});

test('source hash mismatch is a hard failure', async () => {
  const root = await makeFixture();
  const manifest = await readJson(root, 'docs/requirements/source-manifest.json');
  manifest.files[0].sha256 = 'f'.repeat(64);
  await writeJson(root, 'docs/requirements/source-manifest.json', manifest);
  const result = runValidator(root);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /SRC_HASH_MISMATCH/);
});

test('duplicate requirement ID is rejected', async () => {
  const root = await makeFixture();
  const qa = await readJson(root, 'docs/requirements/requirements/qa.json');
  qa.requirements.push({ ...qa.requirements[0] });
  await writeJson(root, 'docs/requirements/requirements/qa.json', qa);
  const result = runValidator(root);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /REQ_DUPLICATE_ID/);
});

test('PASS phase report without evidence is rejected', async () => {
  const root = await makeFixture();
  const report = await readJson(root, 'docs/reports/templates/phase-report.template.json');
  report.sourceRevision = 'abcdef1234567890';
  report.startedAt = '2026-07-16T00:00:00Z';
  report.gateDecision = 'PASS';
  await writeJson(root, 'docs/reports/phase-00.json', report);
  const result = spawnSync(process.execPath, ['tools/requirements/check-phase-report.mjs'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /REPORT_PASS_MISSING_EVIDENCE/);
});

test('external placeholders block a protected later gate', async () => {
  const root = await makeFixture();
  const result = spawnSync(process.execPath, ['tools/requirements/check-external-decisions.mjs', '--gate=G43'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /External decision gate G43: BLOCKED/);
});
