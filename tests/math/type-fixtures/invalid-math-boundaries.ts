import type { BasisPoints, MilliValue, Tick } from '../../../src/game/rules/units.js';
import { mitigatedDamage } from '../../../src/game/sim/math/combat-formulas.js';
import { controlDurationTicks } from '../../../src/game/sim/math/time-and-speed.js';

const rawNumber: number = 42;
const invalidDamage: MilliValue = rawNumber;
const invalidResistance: BasisPoints = rawNumber;
const invalidTick: Tick = rawNumber;
mitigatedDamage(rawNumber, 10);
controlDurationTicks(rawNumber, invalidResistance, true);
void invalidDamage;
void invalidTick;
