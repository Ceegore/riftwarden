import {
  CATEGORIES, ID_PATTERNS, NORMS, REQUIREMENT_STATUSES, duplicates,
  fileExists, issue, normalizedStatement, pushEnum, pushId,
  pushRequiredString, readIndexedCollection, readJson,
} from './shared.mjs';

const REQUIREMENTS_INDEX = 'docs/requirements/requirements/index.json';
const CHAPTER_DISPOSITIONS = 'docs/requirements/chapter-dispositions.json';

function validateSourceLocator(requirement, base, issues) {
  const source = requirement?.source;
  if (!source || typeof source !== 'object') {
    issues.push(issue('error', 'REQ_SOURCE_REQUIRED', 'Requirement source locator is required.', `${base}.source`));
    return;
  }
  pushRequiredString(issues, source.sourceId, `${base}.source.sourceId`, 'REQ_SOURCE_ID');
  if (!Number.isInteger(source.chapter) || source.chapter < 1 || source.chapter > 87) {
    issues.push(issue('error', 'REQ_SOURCE_CHAPTER', 'source.chapter must be 1..87.', `${base}.source.chapter`));
  }
  pushRequiredString(issues, source.locator, `${base}.source.locator`, 'REQ_SOURCE_LOCATOR');
  if (typeof source.quoteHash !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(source.quoteHash)) {
    issues.push(issue('error', 'REQ_QUOTE_HASH', 'quoteHash must use sha256:<64 lowercase hex>.', `${base}.source.quoteHash`));
  }
}

function validateVerification(requirement, base, issues, mode) {
  if (!Array.isArray(requirement?.verification) || requirement.verification.length === 0) {
    issues.push(issue(
      mode === 'gate' ? 'error' : 'warning',
      'REQ_VERIFICATION_MISSING',
      'At least one planned verification is required.',
      `${base}.verification`,
    ));
    return;
  }
  for (const [index, item] of requirement.verification.entries()) {
    const itemBase = `${base}.verification[${index}]`;
    pushEnum(
      issues,
      item?.type,
      ['unit', 'property', 'golden', 'integration', 'e2e', 'visual', 'native', 'manual', 'review', 'static'],
      `${itemBase}.type`,
      'REQ_VERIFICATION_TYPE',
    );
    pushId(issues, item?.plannedPhase, ID_PATTERNS.phase, `${itemBase}.plannedPhase`, 'REQ_VERIFICATION_PHASE');
    if (!Array.isArray(item?.testIds) || item.testIds.length === 0) {
      issues.push(issue('error', 'REQ_TEST_IDS_EMPTY', 'verification.testIds must not be empty.', `${itemBase}.testIds`));
    } else {
      for (const [testIndex, testId] of item.testIds.entries()) {
        pushId(issues, testId, ID_PATTERNS.test, `${itemBase}.testIds[${testIndex}]`, 'REQ_TEST_ID');
      }
    }
  }
}

function validateRequirement(requirement, base, issues, mode) {
  pushId(issues, requirement?.id, ID_PATTERNS.requirement, `${base}.id`, 'REQ_ID_FORMAT');
  pushRequiredString(issues, requirement?.title, `${base}.title`, 'REQ_TITLE');
  pushRequiredString(issues, requirement?.statement, `${base}.statement`, 'REQ_STATEMENT');
  pushEnum(issues, requirement?.norm, NORMS, `${base}.norm`, 'REQ_NORM');
  pushEnum(issues, requirement?.category, CATEGORIES, `${base}.category`, 'REQ_CATEGORY');
  pushEnum(issues, requirement?.status, REQUIREMENT_STATUSES, `${base}.status`, 'REQ_STATUS');
  validateSourceLocator(requirement, base, issues);

  if (!Array.isArray(requirement?.ownerPhases) || requirement.ownerPhases.length === 0) {
    issues.push(issue('error', 'REQ_OWNER_PHASE_EMPTY', 'At least one owner phase is required.', `${base}.ownerPhases`));
  } else {
    requirement.ownerPhases.forEach((phaseId, index) => {
      pushId(issues, phaseId, ID_PATTERNS.phase, `${base}.ownerPhases[${index}]`, 'REQ_OWNER_PHASE');
    });
  }

  validateVerification(requirement, base, issues, mode);

  for (const [index, normId] of (requirement?.relatedNormIds ?? []).entries()) {
    pushId(issues, normId, ID_PATTERNS.normalization, `${base}.relatedNormIds[${index}]`, 'REQ_NORM_ID');
  }
  for (const [index, screenId] of (requirement?.relatedScreenIds ?? []).entries()) {
    pushId(issues, screenId, ID_PATTERNS.screen, `${base}.relatedScreenIds[${index}]`, 'REQ_SCREEN_ID');
  }

  if (requirement?.numericConstraints !== undefined && !Array.isArray(requirement.numericConstraints)) {
    issues.push(issue('error', 'REQ_NUMERIC_CONSTRAINTS', 'numericConstraints must be an array when present.', `${base}.numericConstraints`));
  }
}

async function validateChapterCoverage(root, requirements, issues, mode) {
  if (!(await fileExists(root, CHAPTER_DISPOSITIONS))) {
    issues.push(issue('error', 'REQ_CHAPTER_DISPOSITIONS_MISSING', 'Chapter dispositions are required.', CHAPTER_DISPOSITIONS));
    return;
  }
  const dispositionCollection = await readIndexedCollection(root, CHAPTER_DISPOSITIONS, 'chapters');
  const dispositionMap = new Map(dispositionCollection.items.map((entry) => [entry.chapter, entry]));
  const reqChapters = new Set(requirements.map((entry) => entry.source?.chapter).filter(Number.isInteger));

  for (let chapter = 1; chapter <= 87; chapter += 1) {
    if (reqChapters.has(chapter)) continue;
    const disposition = dispositionMap.get(chapter);
    if (!disposition) {
      issues.push(issue('error', 'REQ_CHAPTER_UNACCOUNTED', `Chapter ${chapter} has no requirement and no context-only disposition.`, CHAPTER_DISPOSITIONS));
      continue;
    }
    if (disposition.disposition !== 'context_only' || typeof disposition.reason !== 'string' || disposition.reason.trim().length < 20) {
      issues.push(issue('error', 'REQ_CONTEXT_ONLY_INVALID', `Chapter ${chapter} context-only disposition needs a specific reason.`, CHAPTER_DISPOSITIONS));
    }
    if (mode === 'gate' && disposition.reviewStatus !== 'verified') {
      issues.push(issue('error', 'REQ_CONTEXT_ONLY_UNVERIFIED', `Chapter ${chapter} disposition is not verified.`, CHAPTER_DISPOSITIONS));
    }
  }
}

export async function validateRequirements(root, mode) {
  const issues = [];
  if (!(await fileExists(root, REQUIREMENTS_INDEX))) {
    return {
      issues: [issue('error', 'REQ_INDEX_MISSING', 'Requirements index is missing.', REQUIREMENTS_INDEX)],
      requirements: [],
      requirementFiles: [],
    };
  }

  const index = await readJson(root, REQUIREMENTS_INDEX);
  if (!Array.isArray(index?.files) || index.files.length === 0) {
    issues.push(issue('error', 'REQ_FILES_EMPTY', 'Requirements index must list thematic files.', `${REQUIREMENTS_INDEX}#files`));
    return { issues, requirements: [], requirementFiles: [] };
  }

  const requirements = [];
  const requirementFiles = [];
  for (const [indexPosition, filePath] of index.files.entries()) {
    if (typeof filePath !== 'string' || !filePath.startsWith('docs/requirements/requirements/')) {
      issues.push(issue('error', 'REQ_FILE_PATH', 'Requirement file must stay under docs/requirements/requirements/.', `${REQUIREMENTS_INDEX}#files[${indexPosition}]`));
      continue;
    }
    if (!(await fileExists(root, filePath))) {
      issues.push(issue('error', 'REQ_FILE_MISSING', 'Listed requirement file does not exist.', filePath));
      continue;
    }
    const payload = await readJson(root, filePath);
    requirementFiles.push(filePath);
    pushEnum(issues, payload?.category, CATEGORIES, `${filePath}#category`, 'REQ_FILE_CATEGORY');
    if (!Array.isArray(payload?.requirements)) {
      issues.push(issue('error', 'REQ_ARRAY_MISSING', 'requirements must be an array.', `${filePath}#requirements`));
      continue;
    }
    for (const [requirementIndex, requirement] of payload.requirements.entries()) {
      const base = `${filePath}#requirements[${requirementIndex}]`;
      validateRequirement(requirement, base, issues, mode);
      if (payload.category && requirement?.category !== payload.category) {
        issues.push(issue('error', 'REQ_CATEGORY_FILE_MISMATCH', 'Requirement category must match its thematic file.', base));
      }
      requirements.push(requirement);
    }
  }

  for (const id of duplicates(requirements.map((entry) => entry.id))) {
    issues.push(issue('error', 'REQ_DUPLICATE_ID', `Duplicate requirement ID: ${id}.`, REQUIREMENTS_INDEX));
  }

  const statements = new Map();
  for (const requirement of requirements) {
    const normalized = normalizedStatement(requirement.statement);
    if (!normalized) continue;
    const existing = statements.get(normalized) ?? [];
    existing.push(requirement.id);
    statements.set(normalized, existing);
  }
  for (const ids of statements.values()) {
    if (ids.length > 1) {
      issues.push(issue('warning', 'REQ_DUPLICATE_STATEMENT', 'Potential duplicate normalized statements.', REQUIREMENTS_INDEX, { ids }));
    }
  }

  await validateChapterCoverage(root, requirements, issues, mode);

  if (mode === 'gate' && requirements.length === 0) {
    issues.push(issue('error', 'REQ_EMPTY_GATE', 'G00 cannot pass with an empty requirement register.', REQUIREMENTS_INDEX));
  }

  return { issues, requirements, requirementFiles };
}
