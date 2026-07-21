import {
  ID_PATTERNS, duplicates, fileExists, issue, pushEnum, pushId,
  pushRequiredString, readIndexedCollection, readJson,
} from './shared.mjs';

const NORMALIZATION_LEDGER = 'docs/requirements/normalization-ledger.json';
const EXTERNAL_DECISIONS = 'docs/requirements/external-decisions.json';

const REQUIRED_EXTERNAL_KEYS = [
  'PUBLISHER_LEGAL_NAME',
  'SUPPORT_EMAIL',
  'SUPPORT_URL',
  'PRIVACY_URL',
  'COPYRIGHT_YEAR',
  'PRICE_TIER',
  'PACKAGE_ID_CONFIRMATION',
];

export async function validateNormalizationLedger(root, mode, requirementIds) {
  const issues = [];
  if (!(await fileExists(root, NORMALIZATION_LEDGER))) {
    return { issues: [issue('error', 'NORM_LEDGER_MISSING', 'Normalization ledger is missing.', NORMALIZATION_LEDGER)], records: [] };
  }
  const collection = await readIndexedCollection(root, NORMALIZATION_LEDGER, 'records');
  const payload = collection.payload;
  const records = collection.items;

  for (const [index, record] of records.entries()) {
    const base = `${NORMALIZATION_LEDGER}#records[${index}]`;
    pushId(issues, record?.id, ID_PATTERNS.normalization, `${base}.id`, 'NORM_ID');
    pushRequiredString(issues, record?.topic, `${base}.topic`, 'NORM_TOPIC');
    pushRequiredString(issues, record?.canonicalRule, `${base}.canonicalRule`, 'NORM_RULE');
    pushEnum(issues, record?.status, ['active', 'superseded'], `${base}.status`, 'NORM_STATUS');
    if (!Number.isInteger(record?.authorityPriority) || record.authorityPriority < 1 || record.authorityPriority > 7) {
      issues.push(issue('error', 'NORM_PRIORITY', 'authorityPriority must be 1..7.', `${base}.authorityPriority`));
    }
    if (!Array.isArray(record?.authorityReferences) || record.authorityReferences.length === 0) {
      issues.push(issue('error', 'NORM_AUTHORITY_EMPTY', 'At least one authority reference is required.', `${base}.authorityReferences`));
    }
    if (!Array.isArray(record?.affectedRequirementIds)) {
      issues.push(issue('error', 'NORM_REQ_LINKS_INVALID', 'affectedRequirementIds must be an array.', `${base}.affectedRequirementIds`));
    } else {
      for (const [reqIndex, reqId] of record.affectedRequirementIds.entries()) {
        pushId(issues, reqId, ID_PATTERNS.requirement, `${base}.affectedRequirementIds[${reqIndex}]`, 'NORM_REQ_ID');
        if (!requirementIds.has(reqId)) {
          issues.push(issue('error', 'NORM_UNKNOWN_REQ', `Normalization record references unknown requirement ${reqId}.`, base));
        }
      }
      if (mode === 'gate' && record.status === 'active' && record.affectedRequirementIds.length === 0) {
        issues.push(issue('error', 'NORM_REQ_LINKS_EMPTY', 'Every active norm must link to affected requirements for G00.', base));
      }
    }
    if (record.status === 'active' && (!Array.isArray(record?.supersededStatements) || record.supersededStatements.length === 0)) {
      issues.push(issue('warning', 'NORM_SUPERSEDED_EMPTY', 'Active norm has no recorded superseded statement; verify this is intentional.', base));
    }
  }

  for (const id of duplicates(records.map((record) => record.id))) {
    issues.push(issue('error', 'NORM_DUPLICATE_ID', `Duplicate normalization ID: ${id}.`, NORMALIZATION_LEDGER));
  }
  for (let number = 1; number <= 21; number += 1) {
    const id = `NORM-${String(number).padStart(3, '0')}`;
    const activeCount = records.filter((record) => record.id === id && record.status === 'active').length;
    if (activeCount !== 1) {
      issues.push(issue('error', 'NORM_ACTIVE_CARDINALITY', `${id} must have exactly one active record.`, NORMALIZATION_LEDGER, { activeCount }));
    }
  }
  const activeTopics = records.filter((record) => record.status === 'active').map((record) => record.topic);
  for (const topic of duplicates(activeTopics)) {
    issues.push(issue('error', 'NORM_DUPLICATE_ACTIVE_TOPIC', `Multiple active norms use topic '${topic}'.`, NORMALIZATION_LEDGER));
  }
  return { issues, records };
}

export async function validateExternalDecisions(root) {
  const issues = [];
  if (!(await fileExists(root, EXTERNAL_DECISIONS))) {
    return { issues: [issue('error', 'EXT_LEDGER_MISSING', 'External decision register is missing.', EXTERNAL_DECISIONS)], decisions: [] };
  }
  const payload = await readJson(root, EXTERNAL_DECISIONS);
  const decisions = Array.isArray(payload?.decisions) ? payload.decisions : [];
  if (!Array.isArray(payload?.decisions)) {
    issues.push(issue('error', 'EXT_DECISIONS_MISSING', 'decisions must be an array.', `${EXTERNAL_DECISIONS}#decisions`));
  }

  for (const [index, decision] of decisions.entries()) {
    const base = `${EXTERNAL_DECISIONS}#decisions[${index}]`;
    pushId(issues, decision?.id, ID_PATTERNS.external, `${base}.id`, 'EXT_ID');
    pushEnum(issues, decision?.key, REQUIRED_EXTERNAL_KEYS, `${base}.key`, 'EXT_KEY');
    pushRequiredString(issues, decision?.owner, `${base}.owner`, 'EXT_OWNER');
    pushEnum(
      issues,
      decision?.status,
      ['pending', 'confirmed', 'rejected', 'superseded'],
      `${base}.status`,
      'EXT_STATUS',
    );
    if (!Array.isArray(decision?.blockingGates) || decision.blockingGates.length === 0) {
      issues.push(issue('error', 'EXT_GATES_EMPTY', 'At least one blocking gate is required.', `${base}.blockingGates`));
    } else {
      decision.blockingGates.forEach((gateId, gateIndex) => {
        pushId(issues, gateId, ID_PATTERNS.gate, `${base}.blockingGates[${gateIndex}]`, 'EXT_GATE_ID');
      });
    }
    if (!decision?.validationRule || typeof decision.validationRule !== 'object') {
      issues.push(issue('error', 'EXT_RULE_MISSING', 'A machine-enforceable validationRule is required.', `${base}.validationRule`));
    } else {
      pushEnum(
        issues,
        decision.validationRule.type,
        ['not_placeholder', 'email', 'https_url', 'integer_range', 'enum', 'exact_match'],
        `${base}.validationRule.type`,
        'EXT_RULE_TYPE',
      );
    }
    if (decision?.developmentDefault === undefined) {
      issues.push(issue('error', 'EXT_DEFAULT_MISSING', 'developmentDefault must be explicit, including null when intentional.', `${base}.developmentDefault`));
    }
  }

  for (const id of duplicates(decisions.map((decision) => decision.id))) {
    issues.push(issue('error', 'EXT_DUPLICATE_ID', `Duplicate external-decision ID: ${id}.`, EXTERNAL_DECISIONS));
  }
  const keys = decisions.map((decision) => decision.key);
  for (const key of REQUIRED_EXTERNAL_KEYS) {
    if (!keys.includes(key)) issues.push(issue('error', 'EXT_REQUIRED_KEY_MISSING', `Missing required external decision ${key}.`, EXTERNAL_DECISIONS));
  }
  for (const key of duplicates(keys)) {
    issues.push(issue('error', 'EXT_DUPLICATE_KEY', `Duplicate external decision key: ${key}.`, EXTERNAL_DECISIONS));
  }

  return { issues, decisions };
}
