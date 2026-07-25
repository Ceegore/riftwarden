function channel(value) {
  const normalized = value / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}
export function luminance(hex) {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) throw new Error(`Invalid hex color: ${hex}`);
  const values = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
  const [r, g, b] = values.map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrastRatio(foreground, background) {
  const a = luminance(foreground); const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
