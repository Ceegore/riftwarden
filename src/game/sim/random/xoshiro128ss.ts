import { RandomInvariantError } from './invariant-error.js';
import { asUInt32, rotl32, u32, type UInt32 } from './uint32.js';

export type XoshiroState = readonly [UInt32, UInt32, UInt32, UInt32];
const JUMP = [0x8764_000b, 0xf542_d2d3, 0x6fa0_35c3, 0x77f2_db5b] as const;
const LONG_JUMP = [0xb523_952e, 0x0b6f_099f, 0xccf5_a0ef, 0x1c58_0662] as const;

function validateState(value: readonly number[]): XoshiroState {
  if (value.length !== 4) throw new RandomInvariantError('P13_STREAM_STATE_INVALID');
  const state = value.map(asUInt32) as unknown as XoshiroState;
  if (state.every((word) => word === 0)) throw new RandomInvariantError('P13_PRNG_ALL_ZERO');
  return state;
}

export class Xoshiro128StarStar {
  #state: [UInt32, UInt32, UInt32, UInt32];

  constructor(state: XoshiroState) {
    const valid = validateState(state);
    this.#state = [...valid];
  }

  nextUint32(): UInt32 {
    const [s0, s1, s2, s3] = this.#state;
    const result = u32(Math.imul(rotl32(u32(Math.imul(s1, 5)), 7), 9));
    const t = u32(s1 << 9);
    let n2 = u32(s2 ^ s0);
    let n3 = u32(s3 ^ s1);
    const n1 = u32(s1 ^ n2);
    const n0 = u32(s0 ^ n3);
    n2 = u32(n2 ^ t);
    n3 = rotl32(n3, 11);
    this.#state = [n0, n1, n2, n3];
    return result;
  }

  snapshot(): XoshiroState { return Object.freeze([...this.#state]); }
  clone(): Xoshiro128StarStar { return new Xoshiro128StarStar(this.snapshot()); }

  jump(): void { this.#applyJump(JUMP); }
  longJump(): void { this.#applyJump(LONG_JUMP); }

  #applyJump(polynomial: readonly number[]): void {
    const acc: [UInt32, UInt32, UInt32, UInt32] = [u32(0), u32(0), u32(0), u32(0)];
    for (const word of polynomial) {
      for (let bit = 0; bit < 32; bit += 1) {
        if ((word & (1 << bit)) !== 0) {
          const state = this.#state;
          acc[0] = u32(acc[0] ^ state[0]); acc[1] = u32(acc[1] ^ state[1]);
          acc[2] = u32(acc[2] ^ state[2]); acc[3] = u32(acc[3] ^ state[3]);
        }
        this.nextUint32();
      }
    }
    this.#state = [...validateState(acc)];
  }
}
