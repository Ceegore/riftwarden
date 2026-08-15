import type { RunSeed } from '../sim/random/run-seed.js';
import type { JsonValue } from './json-value.js';

export interface ReplayDecision { readonly tick: number; readonly sequence: number; readonly type: string; readonly payload: JsonValue; }
export interface ReplayAuthoritative {
  readonly schemaVersion: 1;
  readonly contentVersion: string;
  readonly simulationVersion: string;
  readonly runSeed: RunSeed;
  readonly startSnapshot: JsonValue;
  readonly decisions: readonly ReplayDecision[];
}
export interface ReplayDisplaySpeedEvent { readonly tick: number; readonly speedMilli: 500 | 1000 | 2000 | 3000; }
export interface ReplayFile {
  readonly authoritative: ReplayAuthoritative;
  readonly integrity: Readonly<{ algorithm: 'sha256'; authoritativeHash: string }>;
  readonly display?: Readonly<{ speedEvents: readonly ReplayDisplaySpeedEvent[] }>;
  readonly debug?: Readonly<{ eventLog: readonly JsonValue[] }>;
}
export type Sha256Port = (bytes: Uint8Array) => Promise<string>;
