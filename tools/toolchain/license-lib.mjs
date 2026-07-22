export function classifyLicense(expression, policy) {
  if (typeof expression !== 'string' || expression.trim() === '') return 'block';
  const normalized = expression.trim();
  if (policy.deny.includes(normalized)) return 'block';
  if (policy.autoAllow.includes(normalized)) return 'allow';
  if (policy.manualReview.includes(normalized)) return 'manual-review';
  if (/\b(AGPL|GPL|SSPL|UNLICENSED)\b/i.test(normalized)) return 'block';
  if (/[()\s](AND|OR)[()\s]/i.test(` ${normalized} `)) return 'manual-review';
  return 'block';
}
