/**
 * Repo-local mechanic constants surfaced by the P11 magic audit. Rule
 * literals must be owned by src/game/rules and consumers import them; these
 * tuning values have no GDD home in the pinned rule modules (game-rules /
 * technical-rules / ui-rules / save-rules), so they live here instead of as
 * scattered literals in sim/expedition/replay code.
 */
import { deepFreeze } from './deep-freeze.js';

/** Anti-stuck: ticks of zero unit progress before a repath is forced. */
export const STUCK_TICKS = 30;
/** Anti-stuck: ticks of front-deadlock before the melee range boost applies. */
export const FRONT_DEADLOCK_TICKS = 60;
/** Boss phases: maximum invulnerable window a phase may declare (§5). */
export const MAX_INVULNERABLE_TICKS = 45;
/** Expedition economy: active relic cap in normal mode (§22/§23). */
export const RELIC_LIMIT_NORMAL = 6;
/** Expedition economy: active relic cap in ascension mode (§22/§23). */
export const RELIC_LIMIT_ASCENSION = 8;
/** Seconds→tick conversion: warning threshold (10 ms) for precision drift. */
export const SECONDS_PRECISION_WARNING_MICROS = 10_000;
/** Projectile travel: absolute tick cap before a projectile is dropped. */
export const MAX_PROJECTILE_TRAVEL_TICKS = 10_000;
/** Targeting: score weight for a default (non-anti-summoner) summoned target. */
export const SUMMONED_DEFAULT_TARGET_WEIGHT = -8;
/** Abilities: percent denominator for percentage-based modifiers (§8.2). */
export const PERCENT_SCALE = 100;
/** Replay display: allowed playback speeds in milli (0.5x/1x/2x/3x). */
export const REPLAY_SPEED_MILLI = deepFreeze([500, 1000, 2000, 3000] as const);
export type ReplaySpeedMilli = (typeof REPLAY_SPEED_MILLI)[number];
