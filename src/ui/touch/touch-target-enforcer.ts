/**
 * Phase 40: Touch target enforcer (TOUCH_ASSISTIVE_INPUT_CONTRACT).
 *
 * Ensures interactive elements meet minimum touch target sizes
 * (44×44px default, 48×48px large) with adequate spacing.
 */

export interface TouchTarget {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly id: string;
}

const MIN_NORMAL = 44;
const MIN_LARGE = 48;
const MIN_SPACING = 8;

export function validateTouchTarget(target: TouchTarget, size: 'normal' | 'large'): string | null {
  const minSize = size === 'large' ? MIN_LARGE : MIN_NORMAL;
  if (target.w < minSize) return `TOUCH: ${target.id} width ${String(target.w)} < ${String(minSize)}px`;
  if (target.h < minSize) return `TOUCH: ${target.id} height ${String(target.h)} < ${String(minSize)}px`;
  return null;
}

export function validateTouchSpacing(a: TouchTarget, b: TouchTarget): string | null {
  const ax2 = a.x + a.w;
  const ay2 = a.y + a.h;
  const bx2 = b.x + b.w;
  const by2 = b.y + b.h;

  const overlapX = a.x < bx2 && ax2 > b.x;
  const overlapY = a.y < by2 && ay2 > b.y;

  if (overlapX && overlapY) {
    return `TOUCH: ${a.id} and ${b.id} overlap`;
  }

  const distX = Math.max(0, Math.min(Math.abs(a.x - bx2), Math.abs(b.x - ax2)));
  const distY = Math.max(0, Math.min(Math.abs(a.y - by2), Math.abs(b.y - ay2)));

  if (distX < MIN_SPACING && distX > 0) {
    return `TOUCH: ${a.id} and ${b.id} horizontal spacing ${String(distX)} < ${String(MIN_SPACING)}px`;
  }
  if (distY < MIN_SPACING && distY > 0) {
    return `TOUCH: ${a.id} and ${b.id} vertical spacing ${String(distY)} < ${String(MIN_SPACING)}px`;
  }
  return null;
}
