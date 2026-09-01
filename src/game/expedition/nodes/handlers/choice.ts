/**
 * Choice node family (S45–S48): treasure, workshop, altar and scout live in
 * their own per-family modules; this index keeps the registry import small.
 */
import { altarHandler } from './altar.js';
import { scoutHandler } from './scout.js';
import { treasureHandler } from './treasure.js';
import { workshopHandler } from './workshop.js';

export { altarHandler, scoutHandler, treasureHandler, workshopHandler };
