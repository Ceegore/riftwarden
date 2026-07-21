import {
  ID_PATTERNS, fileExists, fileSize, issue, pushEnum, pushRequiredString,
  readIndexedCollection, readJson, sha256File,
} from './shared.mjs';

const SOURCE_MANIFEST = 'docs/requirements/source-manifest.json';

function validateHeadingRecord(record, index, issues) {
  const base = `docs/requirements/source-headings.json#headings[${index}]`;
  if (!Number.isInteger(record?.chapter) || record.chapter < 1 || record.chapter > 87) {
    issues.push(issue('error', 'SRC_HEADING_NUMBER', 'Chapter must be an integer from 1 to 87.', `${base}.chapter`));
  }
  pushRequiredString(issues, record?.title, `${base}.title`, 'SRC_HEADING_TITLE');
  pushRequiredString(issues, record?.locator, `${base}.locator`, 'SRC_HEADING_LOCATOR');
  pushEnum(
    issues,
    record?.reviewStatus,
    ['verified', 'requires_review', 'rejected'],
    `${base}.reviewStatus`,
    'SRC_HEADING_REVIEW_STATUS',
  );
}

export async function validateSource(root, mode) {
  const issues = [];
  if (!(await fileExists(root, SOURCE_MANIFEST))) {
    return {
      issues: [issue('error', 'SRC_MANIFEST_MISSING', 'Source manifest is missing.', SOURCE_MANIFEST)],
      manifest: null,
      headings: null,
    };
  }

  const manifest = await readJson(root, SOURCE_MANIFEST);
  if (manifest?.schemaVersion !== 1) {
    issues.push(issue('error', 'SRC_SCHEMA_VERSION', 'schemaVersion must be 1.', `${SOURCE_MANIFEST}#schemaVersion`));
  }
  pushRequiredString(issues, manifest?.sourceId, `${SOURCE_MANIFEST}#sourceId`, 'SRC_ID_REQUIRED');
  pushEnum(
    issues,
    manifest?.authorityStatus,
    ['pending_verification', 'frozen', 'superseded'],
    `${SOURCE_MANIFEST}#authorityStatus`,
    'SRC_AUTHORITY_STATUS',
  );

  const publisherStatus = manifest?.publisherConfirmation?.status;
  pushEnum(
    issues,
    publisherStatus,
    ['pending', 'confirmed', 'rejected'],
    `${SOURCE_MANIFEST}#publisherConfirmation.status`,
    'SRC_PUBLISHER_STATUS',
  );
  if (mode === 'gate' && publisherStatus !== 'confirmed') {
    issues.push(issue('error', 'SRC_PUBLISHER_UNCONFIRMED', 'G00 requires explicit publisher confirmation.', SOURCE_MANIFEST));
  }
  if (publisherStatus === 'confirmed') {
    pushRequiredString(issues, manifest?.publisherConfirmation?.confirmedBy, `${SOURCE_MANIFEST}#publisherConfirmation.confirmedBy`, 'SRC_PUBLISHER_CONFIRMED_BY');
    pushRequiredString(issues, manifest?.publisherConfirmation?.confirmedAt, `${SOURCE_MANIFEST}#publisherConfirmation.confirmedAt`, 'SRC_PUBLISHER_CONFIRMED_AT');
  }

  if (!Array.isArray(manifest?.files) || manifest.files.length < 1) {
    issues.push(issue('error', 'SRC_FILES_EMPTY', 'At least one source file is required.', `${SOURCE_MANIFEST}#files`));
  } else {
    for (const [index, file] of manifest.files.entries()) {
      const base = `${SOURCE_MANIFEST}#files[${index}]`;
      pushRequiredString(issues, file?.path, `${base}.path`, 'SRC_FILE_PATH');
      pushEnum(issues, file?.format, ['docx', 'pdf'], `${base}.format`, 'SRC_FILE_FORMAT');
      if (typeof file?.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(file.sha256)) {
        issues.push(issue('error', 'SRC_HASH_FORMAT', 'sha256 must be 64 lowercase hex characters.', `${base}.sha256`));
      }
      if (typeof file?.path === 'string' && await fileExists(root, file.path)) {
        const actual = await sha256File(root, file.path);
        if (actual !== file.sha256) {
          issues.push(issue('error', 'SRC_HASH_MISMATCH', 'Frozen source hash differs from the file.', file.path, {
            expected: file.sha256,
            actual,
          }));
        }
        const observedSize = await fileSize(root, file.path);
        if (!Number.isInteger(file.byteSize) || file.byteSize !== observedSize) {
          issues.push(issue('error', 'SRC_SIZE_MISMATCH', 'Manifest byteSize differs from the file.', file.path, {
            expected: file.byteSize,
            actual: observedSize,
          }));
        }
      } else if (mode === 'gate') {
        issues.push(issue('error', 'SRC_FILE_MISSING', 'Frozen source file is not readable.', file?.path ?? base));
      } else {
        issues.push(issue('warning', 'SRC_FILE_NOT_PRESENT', 'Source file is not present yet; draft validation only.', file?.path ?? base));
      }
    }
  }

  const headingsPath = manifest?.chapterAudit?.headingsFile ?? 'docs/requirements/source-headings.json';
  let headings = null;
  if (!(await fileExists(root, headingsPath))) {
    issues.push(issue('error', 'SRC_HEADINGS_MISSING', 'Heading audit file is missing.', headingsPath));
  } else {
    const headingCollection = await readIndexedCollection(root, headingsPath, 'headings');
    headings = { ...headingCollection.payload, headings: headingCollection.items };
    if (headings.sourceId && headings.sourceId !== manifest.sourceId) {
      issues.push(issue('error', 'SRC_HEADING_SOURCE_ID', 'Heading index sourceId does not match source manifest.', headingsPath));
    }
    if (!Array.isArray(headings?.headings)) {
      issues.push(issue('error', 'SRC_HEADINGS_INVALID', 'headings must be an array.', `${headingsPath}#headings`));
    } else {
      headings.headings.forEach((record, index) => validateHeadingRecord(record, index, issues));
      const counts = new Map();
      for (const record of headings.headings) {
        counts.set(record.chapter, (counts.get(record.chapter) ?? 0) + 1);
      }
      for (let chapter = 1; chapter <= 87; chapter += 1) {
        const count = counts.get(chapter) ?? 0;
        if (count === 0) issues.push(issue('error', 'SRC_CHAPTER_MISSING', `Chapter ${chapter} is missing.`, headingsPath));
        if (count > 1) issues.push(issue('error', 'SRC_CHAPTER_DUPLICATE', `Chapter ${chapter} appears ${count} times.`, headingsPath));
      }
      if (headings.headings.length !== 87) {
        issues.push(issue('error', 'SRC_CHAPTER_COUNT', 'Exactly 87 accepted chapter headings are required.', headingsPath, {
          actual: headings.headings.length,
        }));
      }
      if (mode === 'gate' && headings.headings.some((record) => record.reviewStatus !== 'verified')) {
        issues.push(issue('error', 'SRC_HEADING_UNREVIEWED', 'Every accepted heading must be manually verified for G00.', headingsPath));
      }
    }
  }

  if (mode === 'gate' && manifest?.chapterAudit?.status !== 'complete') {
    issues.push(issue('error', 'SRC_CHAPTER_AUDIT_INCOMPLETE', 'chapterAudit.status must be complete for G00.', SOURCE_MANIFEST));
  }
  const structurePath = manifest?.chapterAudit?.structureFile;
  if (mode === 'gate' && (!structurePath || !(await fileExists(root, structurePath)))) {
    issues.push(issue('error', 'SRC_STRUCTURE_MISSING', 'Extracted source structure is required for G00.', structurePath ?? SOURCE_MANIFEST));
  }

  const findingsPath = manifest?.chapterAudit?.findingsFile;
  if (findingsPath && await fileExists(root, findingsPath)) {
    const findings = await readJson(root, findingsPath);
    const primaryHash = manifest?.files?.[0]?.sha256;
    if (findings?.sourceSha256 !== primaryHash) {
      issues.push(issue('error', 'SRC_FINDINGS_HASH_MISMATCH', 'Source findings do not reference the frozen source hash.', findingsPath));
    }
    const open = (findings?.findings ?? []).filter((entry) => entry.status === 'open');
    if (open.length > 0) {
      issues.push(issue(mode === 'gate' ? 'error' : 'warning', 'SRC_OPEN_FINDINGS', `${open.length} source-audit findings remain open.`, findingsPath));
    }
  } else if (mode === 'gate') {
    issues.push(issue('error', 'SRC_FINDINGS_MISSING', 'A classified source-findings file is required for G00.', findingsPath ?? SOURCE_MANIFEST));
  }

  if (mode === 'gate' && manifest?.authorityStatus !== 'frozen') {
    issues.push(issue('error', 'SRC_NOT_FROZEN', 'authorityStatus must be frozen for G00.', SOURCE_MANIFEST));
  }
  if (mode === 'gate' && !manifest?.frozenAt) {
    issues.push(issue('error', 'SRC_FROZEN_AT', 'frozenAt is required for G00.', SOURCE_MANIFEST));
  }

  return { issues, manifest, headings };
}
