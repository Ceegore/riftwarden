import { tick, type MilliValue, type Tick } from '../../../src/game/rules/units';

const rawNumberIsNotTick: Tick = 3;
const tickIsNotMilliValue: MilliValue = tick(3);

void rawNumberIsNotTick;
void tickIsNotMilliValue;
