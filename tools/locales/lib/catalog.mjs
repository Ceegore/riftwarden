import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { parseStrictJson } from './strict-json.mjs';
import { LocaleDiagnostic } from './diagnostic.mjs';

export async function readJsonFile(filePath) {
  const text = await readFile(filePath, 'utf8');
  return parseStrictJson(text, filePath);
}

export async function loadRegistry(root) {
  const indexPath = path.join(root, 'src/locales/messages/catalog-index.json');
  const index = await readJsonFile(indexPath);
  if (index.schemaVersion !== 1 || !Array.isArray(index.releaseLocales) || !index.files) {
    throw new LocaleDiagnostic('L10N_SOURCE_SCHEMA', 'Invalid catalog-index.json', { sourcePath:indexPath });
  }
  return { index, indexPath };
}

export function validateMessageFileShape(doc, sourcePath) {
  const requiredTop = ['schemaVersion','locale','namespace','sourceRole','messages'];
  for (const key of requiredTop) if (!(key in doc)) throw new LocaleDiagnostic('L10N_SOURCE_SCHEMA', `Missing top-level field: ${key}`, { sourcePath });
  const allowedTop = new Set(requiredTop);
  for (const key of Object.keys(doc)) if (!allowedTop.has(key)) throw new LocaleDiagnostic('L10N_SOURCE_SCHEMA', `Unexpected top-level field: ${key}`, { sourcePath });
  if (doc.schemaVersion !== 1 || typeof doc.locale !== 'string' || typeof doc.namespace !== 'string' || !doc.messages || Array.isArray(doc.messages)) {
    throw new LocaleDiagnostic('L10N_SOURCE_SCHEMA', 'Invalid locale source shape', { sourcePath });
  }
  for (const [messageKey, item] of Object.entries(doc.messages)) {
    const details = { sourcePath, key:messageKey };
    if (!/^(?:ui|content|a11y|subtitle)\.[a-z0-9_]+(?:\.[a-z0-9_]+)+$/u.test(messageKey)) {
      throw new LocaleDiagnostic('L10N_KEY_INVALID', `Invalid semantic localization key: ${messageKey}`, details);
    }
    const expected = ['message','description','budget','compactKey','parameterBudgets','review'];
    for (const field of expected) if (!(field in item)) throw new LocaleDiagnostic('L10N_SOURCE_SCHEMA', `Missing message field: ${field}`, details);
    for (const field of Object.keys(item)) if (!expected.includes(field)) throw new LocaleDiagnostic('L10N_SOURCE_SCHEMA', `Unexpected message field: ${field}`, details);
    if (typeof item.message !== 'string' || !item.message || item.message.length > 4096) throw new LocaleDiagnostic('L10N_SOURCE_SCHEMA', 'Message must be 1..4096 code units', details);
    if (typeof item.description !== 'string' || !item.description) throw new LocaleDiagnostic('L10N_SOURCE_SCHEMA', 'Description is required', details);
    if (typeof item.budget !== 'string' || !item.budget) throw new LocaleDiagnostic('L10N_SOURCE_SCHEMA', 'Budget id is required', details);
    if (item.compactKey !== null && typeof item.compactKey !== 'string') throw new LocaleDiagnostic('L10N_SOURCE_SCHEMA', 'compactKey must be string or null', details);
    if (!item.parameterBudgets || Array.isArray(item.parameterBudgets) || typeof item.parameterBudgets !== 'object') throw new LocaleDiagnostic('L10N_SOURCE_SCHEMA', 'parameterBudgets must be an object', details);
    validateReview(item.review, details);
  }
}

function validateReview(review, details) {
  const statuses = new Set(['draft','linguistic_review','approved','rejected','generated_test_only']);
  if (!review || !statuses.has(review.status) || typeof review.source !== 'string') throw new LocaleDiagnostic('L10N_SOURCE_SCHEMA', 'Invalid review metadata', details);
  if (review.status === 'approved' && (!review.reviewer || !review.reviewedAt)) throw new LocaleDiagnostic('L10N_UNAPPROVED_COPY', 'Approved copy requires reviewer and reviewedAt', details);
  if (review.status !== 'approved' && review.status !== 'generated_test_only' && (review.reviewer !== null || review.reviewedAt !== null)) {
    throw new LocaleDiagnostic('L10N_SOURCE_SCHEMA', 'Non-approved starter review metadata must not imply review evidence', details);
  }
}

export async function loadCatalogs(root) {
  const { index } = await loadRegistry(root);
  const catalogs = new Map();
  for (const locale of index.releaseLocales) {
    const merged = {};
    for (const relative of index.files[locale] ?? []) {
      const sourcePath = path.resolve(root, relative);
      const doc = await readJsonFile(sourcePath);
      validateMessageFileShape(doc, sourcePath);
      if (doc.locale !== locale) throw new LocaleDiagnostic('L10N_SOURCE_SCHEMA', `File locale ${doc.locale} does not match index locale ${locale}`, { sourcePath });
      for (const [key, value] of Object.entries(doc.messages)) {
        if (Object.hasOwn(merged, key)) throw new LocaleDiagnostic('L10N_JSON_DUPLICATE_KEY', `Duplicate message key across files: ${key}`, { sourcePath, key });
        merged[key] = { ...value, sourcePath, namespace:doc.namespace };
      }
    }
    catalogs.set(locale, merged);
  }
  return { index, catalogs };
}

export async function listFilesRecursive(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes:true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await listFilesRecursive(full));
    else result.push(full);
  }
  return result.sort();
}
