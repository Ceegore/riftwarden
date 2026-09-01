import { RandomInvariantError } from '../sim/random/invariant-error.js';
import { canonicalJson, canonicalUtf8 } from './canonical-json.js';
import type { JsonValue } from './json-value.js';
import type { ReplayAuthoritative, ReplayFile, Sha256Port } from './replay-types.js';
import { validateReplayFile } from './replay-validation.js';

export interface ReplayDecodePolicy { readonly supportedSimulationVersions: ReadonlySet<string>; }
function asJson(value: unknown): JsonValue { return value as JsonValue; }

export async function encodeReplay(input: Omit<ReplayFile, 'integrity'>, sha256: Sha256Port): Promise<string> {
  const authoritativeHash=await sha256(canonicalUtf8(asJson(input.authoritative)));
  const file: ReplayFile={...input,integrity:Object.freeze({algorithm:'sha256',authoritativeHash})};
  validateReplayFile(file);
  return canonicalJson(asJson(file));
}

export async function decodeReplay(raw: string, sha256: Sha256Port, policy: ReplayDecodePolicy): Promise<ReplayFile> {
  let parsed: unknown;
  try { parsed=JSON.parse(raw); } catch { throw new RandomInvariantError('P13_REPLAY_PARSE'); }
  const file=validateReplayFile(parsed);
  if(!policy.supportedSimulationVersions.has(file.authoritative.simulationVersion)) throw new RandomInvariantError('P13_REPLAY_SIMULATION_UNSUPPORTED',{simulationVersion:file.authoritative.simulationVersion});
  if(canonicalJson(asJson(file))!==raw) throw new RandomInvariantError('P13_REPLAY_NONCANONICAL');
  const actual=await sha256(canonicalUtf8(asJson(file.authoritative)));
  if(actual!==file.integrity.authoritativeHash) throw new RandomInvariantError('P13_REPLAY_TAMPERED');
  return file;
}

export function authoritativeReplayPayload(file: ReplayFile): ReplayAuthoritative { return file.authoritative; }
