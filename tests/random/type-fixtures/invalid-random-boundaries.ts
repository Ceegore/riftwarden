import type { UInt32, RunSeed } from '../../src/game/sim/random/index.js';

const rawNumber: number = 7;
const mustNotCompileAsUInt32: UInt32 = rawNumber;
const mustNotCompileAsRunSeed: RunSeed = ['00000000', '00000001', '00000002', '00000003'];
void mustNotCompileAsUInt32;
void mustNotCompileAsRunSeed;
