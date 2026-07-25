import path from 'node:path';
import { loadCatalogs, readJsonFile } from './catalog.mjs';
import { parseMessage } from './message-parser.mjs';
import { analyzeAst, visibleLength, countParagraphs, countSentences } from './message-analysis.mjs';
import { assertNoForbiddenMarkup, compileRichText } from './rich-text.mjs';
import { LocaleDiagnostic, normalizeError, sortDiagnostics } from './diagnostic.mjs';

const placeholders = /(?:\bTODO\b|\bTBD\b|\bFIXME\b|\bPLACEHOLDER\b|Lorem ipsum|example\.invalid)/iu;

export async function validateProject(root, mode = 'development') {
  const diagnostics = [];
  const warnings = [];
  let loaded;
  try { loaded = await loadCatalogs(root); }
  catch (error) { diagnostics.push(normalizeError(error)); return report(mode, diagnostics, warnings); }

  const tokenRegistry = await readJsonFile(path.join(root, 'config/rich-text-token-registry.json'));
  const budgetConfig = await readJsonFile(path.join(root, 'config/text-budgets.json'));
  const glossary = await readJsonFile(path.join(root, 'docs/localization/glossary.core.json'));
  const compiled = new Map();

  for (const [locale, catalog] of loaded.catalogs) {
    const output = {};
    for (const key of Object.keys(catalog).sort()) {
      const item = catalog[key];
      const details = { sourcePath:item.sourcePath, key };
      try {
        assertNoForbiddenMarkup(item.message, details);
        if (placeholders.test(item.message)) throw new LocaleDiagnostic('L10N_PLACEHOLDER', 'Placeholder or example.invalid found', details);
        const ast = parseMessage(item.message, details);
        const richAst = compileRichText(ast, tokenRegistry, details);
        const analysis = analyzeAst(richAst);
        if (analysis.conflicts.length) throw new LocaleDiagnostic('L10N_PARAMETER_MISMATCH', `Parameter used with conflicting kinds: ${JSON.stringify(analysis.conflicts)}`, details);
        validatePluralCategories(locale, analysis, details);
        validateBudget(locale, key, item, richAst, budgetConfig, catalog, details);
        validateGlossary(locale, item.message, glossary, details);
        validateReview(item.review, mode, details, diagnostics, warnings);
        output[key] = { item, ast:richAst, analysis };
      } catch (error) { diagnostics.push(normalizeError(error, details)); }
    }
    compiled.set(locale, output);
  }

  validateParity(loaded.index, loaded.catalogs, compiled, diagnostics);
  return report(mode, diagnostics, warnings);
}

function validatePluralCategories(locale, analysis, details) {
  const categories = new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
  for (const control of analysis.controls.filter(value => value.type === 'plural')) {
    for (const category of categories) {
      if (!control.labels.includes(category)) {
        throw new LocaleDiagnostic('L10N_REQUIRED_PLURAL_CATEGORY', `Plural ${control.name} lacks required ${locale} category ${category}`, details);
      }
    }
  }
}

function validateBudget(locale, key, item, ast, config, catalog, details) {
  const budget = config.budgets[item.budget];
  if (!budget || !Number.isInteger(budget[locale])) throw new LocaleDiagnostic('L10N_SOURCE_SCHEMA', `Unknown or incomplete budget: ${item.budget}`, details);
  const length = visibleLength(ast, item.parameterBudgets);
  if (length > budget[locale]) {
    if (budget.requiresCompactKeyWhenExceeded && item.compactKey && Object.hasOwn(catalog, item.compactKey)) return;
    throw new LocaleDiagnostic('L10N_BUDGET_EXCEEDED', `${key} worst-case length ${length} exceeds ${item.budget}/${locale} budget ${budget[locale]}`, details);
  }
  if (budget.maxParagraphs && countParagraphs(item.message) > budget.maxParagraphs) throw new LocaleDiagnostic('L10N_BUDGET_EXCEEDED', `${key} exceeds paragraph budget`, details);
  if (budget.maxSentences && countSentences(item.message) > budget.maxSentences) throw new LocaleDiagnostic('L10N_BUDGET_EXCEEDED', `${key} exceeds sentence budget`, details);
}

function validateReview(review, mode, details, diagnostics, warnings) {
  if (review.status === 'approved' && review.reviewer && review.reviewedAt) return;
  const issue = new LocaleDiagnostic('L10N_UNAPPROVED_COPY', `Copy review status is ${review.status}`, details);
  if (mode === 'release') diagnostics.push(issue); else warnings.push(issue);
}

function validateGlossary(locale, message, glossary, details) {
  for (const entry of glossary.entries ?? []) {
    const side = entry[locale];
    if (!side) continue;
    for (const variant of side.forbidden ?? []) {
      const escaped = variant.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
      const re = new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}([^\\p{L}\\p{N}_]|$)`, entry.caseSensitive ? 'u' : 'iu');
      if (re.test(message)) throw new LocaleDiagnostic('L10N_GLOSSARY_FORBIDDEN_VARIANT', `Forbidden glossary variant: ${variant}`, details);
    }
  }
}

function validateParity(index, catalogs, compiled, diagnostics) {
  const [baseLocale, ...others] = index.releaseLocales;
  const base = catalogs.get(baseLocale) ?? {};
  for (const locale of others) {
    const target = catalogs.get(locale) ?? {};
    const baseKeys = Object.keys(base).sort();
    const targetKeys = Object.keys(target).sort();
    for (const key of baseKeys.filter(key => !Object.hasOwn(target, key))) diagnostics.push(new LocaleDiagnostic('L10N_KEY_MISSING', `${locale} is missing ${key}`, { key }));
    for (const key of targetKeys.filter(key => !Object.hasOwn(base, key))) diagnostics.push(new LocaleDiagnostic('L10N_KEY_EXTRA', `${locale} has extra ${key}`, { key }));
    for (const key of baseKeys.filter(key => Object.hasOwn(target, key))) {
      const a = compiled.get(baseLocale)?.[key];
      const b = compiled.get(locale)?.[key];
      if (!a || !b) continue;
      compareJson(a.analysis.parameters, b.analysis.parameters, 'L10N_PARAMETER_MISMATCH', `${key}: parameter kinds differ`, key, diagnostics);
      compareJson(a.analysis.controls, b.analysis.controls, 'L10N_CONTROL_MISMATCH', `${key}: select/plural controls or branches differ`, key, diagnostics);
      compareJson(a.analysis.tokens, b.analysis.tokens, 'L10N_TOKEN_MISMATCH', `${key}: RichText token structure differs`, key, diagnostics);
      if (a.item.budget !== b.item.budget || a.item.compactKey !== b.item.compactKey) diagnostics.push(new LocaleDiagnostic('L10N_BUDGET_EXCEEDED', `${key}: budget or compactKey metadata differs`, { key }));
      compareJson(a.item.parameterBudgets, b.item.parameterBudgets, 'L10N_PARAMETER_MISMATCH', `${key}: parameter budgets differ`, key, diagnostics);
      if (a.item.namespace !== b.item.namespace) diagnostics.push(new LocaleDiagnostic('L10N_KEY_INVALID', `${key}: namespace differs`, { key }));
    }
  }
}

function compareJson(a, b, code, message, key, diagnostics) {
  if (JSON.stringify(a) !== JSON.stringify(b)) diagnostics.push(new LocaleDiagnostic(code, message, { key }));
}

function report(mode, diagnostics, warnings) {
  const errors = sortDiagnostics(diagnostics).map(error => error.toJSON ? error.toJSON() : error);
  const sortedWarnings = sortDiagnostics(warnings).map(error => error.toJSON ? error.toJSON() : error);
  return { schemaVersion:1, mode, status:errors.length ? 'FAIL' : 'PASS', errorCount:errors.length, warningCount:sortedWarnings.length, errors, warnings:sortedWarnings };
}
