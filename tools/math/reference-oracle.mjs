// Independent BigInt test oracle. Test tooling only — never imported by
// production math modules (production stays Number Safe Integer per §7.3).
export function bigRoundDiv(n, d) {
  n = BigInt(n); d = BigInt(d);
  if (d === 0n) throw new Error('P12_DIVIDE_BY_ZERO');
  const q = n / d, r = n % d;
  if (r === 0n) return Number(q);
  const ar = r < 0n ? -r : r, ad = d < 0n ? -d : d;
  if (ar * 2n < ad) return Number(q);
  const direction = (n < 0n) === (d < 0n) ? 1n : -1n;
  return Number(q + direction);
}

export function bigMulDiv(a, b, d) {
  return bigRoundDiv(BigInt(a) * BigInt(b), BigInt(d));
}
