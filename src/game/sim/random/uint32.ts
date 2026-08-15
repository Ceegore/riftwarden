import { RandomInvariantError } from './invariant-error.js';

export type UInt32 = number & { readonly __brand: 'UInt32' };
export const UINT32_SIZE = 0x1_0000_0000;
export const UINT32_MAX = 0xffff_ffff;

export function asUInt32(value: number): UInt32 {
  if (!Number.isInteger(value) || value < 0 || value > UINT32_MAX || Object.is(value, -0)) {
    throw new RandomInvariantError('P13_UINT32_INVALID', { value: String(value) });
  }
  return value as UInt32;
}

export function u32(value: number): UInt32 {
  return (value >>> 0) as UInt32;
}

export function rotl32(value: UInt32, shift: number): UInt32 {
  if (!Number.isInteger(shift) || shift < 0 || shift > 31) {
    throw new RandomInvariantError('P13_UINT32_INVALID', { shift });
  }
  return u32((value << shift) | (value >>> (32 - shift)));
}

export function hexUInt32(value: UInt32): string {
  return value.toString(16).padStart(8, '0');
}
