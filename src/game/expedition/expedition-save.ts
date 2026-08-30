/**
 * Phase 32 expedition save codec (EXPEDITION_SAVE_CONTRACT): a closed,
 * versioned JSON boundary for the immutable runner state. The codec validates
 * persisted identity and all state containers before restore; map compatibility
 * is checked by restoreExpedition once the map is available.
 */
import { SaveError } from '../save/save-error.js';
import { canonicalJson } from '../save/canonical-json.js';
import type { ExpeditionMap } from './types.js';
import { restoreExpedition, type ExpeditionRunner } from './expedition-runner.js';
import type {
  EventOptionState,
  NodeRunState,
  NodeSnapshot,
  NodeVisitState,
  Offer,
  TransactionRecord,
} from './nodes/types.js';

export const EXPEDITION_SAVE_VERSION = 1;

export interface ExpeditionSave {
  readonly schemaVersion: typeof EXPEDITION_SAVE_VERSION;
  readonly currentNodeId: string;
  readonly state: NodeRunState;
}

const ROOT_KEYS = ['currentNodeId', 'schemaVersion', 'state'] as const;
const STATE_KEYS = [
  'contentRevision',
  'gold',
  'goldEarned',
  'instability',
  'killsEarned',
  'knowledge',
  'ledger',
  'mapHash',
  'masteryKillsApplied',
  'modeId',
  'recruits',
  'relics',
  'revision',
  'runId',
  'runStatus',
  'securedLoot',
  'seed',
  'snapshots',
  'troopCopies',
  'unsecuredLoot',
  'visits',
] as const;

function record(value: unknown, field: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new SaveError('INVALID_OBJECT', { field });
  return value as Record<string, unknown>;
}

function closedKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[], field: string): void {
  const allowed = new Set([...required, ...optional]);
  const actual = Object.keys(value);
  if (actual.some((key) => !allowed.has(key))) throw new SaveError('UNKNOWN_FIELD', { field });
  if (required.some((key) => !Object.prototype.hasOwnProperty.call(value, key))) {
    throw new SaveError('MISSING_FIELD', { field });
  }
}

function requiredKeys(value: Record<string, unknown>, keys: readonly string[], field: string): void {
  closedKeys(value, keys, [], field);
}

function stringValue(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new SaveError('INVALID_FIELD', { field });
  return value;
}

function integerValue(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new SaveError('INVALID_FIELD', { field });
  return value;
}

function stringList(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value)) throw new SaveError('INVALID_FIELD', { field });
  const result: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') throw new SaveError('INVALID_FIELD', { field });
    result.push(entry);
  }
  return result;
}

function stringMap(value: unknown, field: string): Readonly<Record<string, number>> {
  const result = record(value, field);
  const output: Record<string, number> = {};
  for (const [key, entry] of Object.entries(result)) output[key] = integerValue(entry, `${field}.${key}`);
  return output;
}

function decodeVisit(value: unknown, nodeId: string): NodeVisitState {
  const entry = record(value, `visits.${nodeId}`);
  closedKeys(entry, ['nodeId', 'previewRevision', 'status'], ['transactionId'], `visits.${nodeId}`);
  const status = stringValue(entry['status'], `visits.${nodeId}.status`);
  if (!['OPEN', 'COMMITTING', 'COMMITTED', 'RESOLVED'].includes(status)) throw new SaveError('INVALID_ENUM', { field: `visits.${nodeId}.status` });
  const transactionId = entry['transactionId'];
  if (transactionId !== undefined && typeof transactionId !== 'string') throw new SaveError('INVALID_FIELD', { field: `visits.${nodeId}.transactionId` });
  return {
    nodeId: stringValue(entry['nodeId'], `visits.${nodeId}.nodeId`),
    status: status as NodeVisitState['status'],
    previewRevision: integerValue(entry['previewRevision'], `visits.${nodeId}.previewRevision`),
    ...(transactionId === undefined ? {} : { transactionId }),
  };
}

function decodeTransaction(value: unknown, transactionId: string): TransactionRecord {
  const entry = record(value, `ledger.${transactionId}`);
  closedKeys(entry, ['action', 'nodeId', 'outcomeIds', 'status', 'transactionId'], ['completedKinds', 'reason'], `ledger.${transactionId}`);
  const status = stringValue(entry['status'], `ledger.${transactionId}.status`);
  if (!['COMMITTED', 'REJECTED', 'FAILED'].includes(status)) throw new SaveError('INVALID_ENUM', { field: `ledger.${transactionId}.status` });
  const reason = entry['reason'];
  if (reason !== undefined && typeof reason !== 'string') throw new SaveError('INVALID_FIELD', { field: `ledger.${transactionId}.reason` });
  const completedKinds = entry['completedKinds'];
  if (completedKinds !== undefined && !Array.isArray(completedKinds)) {
    throw new SaveError('INVALID_FIELD', { field: `ledger.${transactionId}.completedKinds` });
  }
  return {
    transactionId: stringValue(entry['transactionId'], `ledger.${transactionId}.transactionId`),
    nodeId: stringValue(entry['nodeId'], `ledger.${transactionId}.nodeId`),
    action: stringValue(entry['action'], `ledger.${transactionId}.action`),
    status: status as TransactionRecord['status'],
    outcomeIds: stringList(entry['outcomeIds'], `ledger.${transactionId}.outcomeIds`),
    // §9.5: the victory ENGAGE's completed objective kinds ride the ledger
    // record so the post-ENGAGE reward screen derives the bounty after a
    // reload — the codec must round-trip them (validated string list).
    ...(completedKinds === undefined ? {} : { completedKinds: stringList(completedKinds, `ledger.${transactionId}.completedKinds`) }),
    ...(reason === undefined ? {} : { reason }),
  };
}

function decodeOffer(value: unknown, field: string): Offer {
  const entry = record(value, field);
  closedKeys(entry, ['labelKey', 'offerId', 'priceGold', 'stock'], ['rewardId', 'troopTypeId'], field);
  const rewardId = entry['rewardId'];
  const troopTypeId = entry['troopTypeId'];
  if (rewardId !== undefined && typeof rewardId !== 'string') throw new SaveError('INVALID_FIELD', { field: `${field}.rewardId` });
  if (troopTypeId !== undefined && typeof troopTypeId !== 'string') throw new SaveError('INVALID_FIELD', { field: `${field}.troopTypeId` });
  return {
    offerId: stringValue(entry['offerId'], `${field}.offerId`),
    priceGold: integerValue(entry['priceGold'], `${field}.priceGold`),
    stock: integerValue(entry['stock'], `${field}.stock`),
    labelKey: stringValue(entry['labelKey'], `${field}.labelKey`),
    ...(rewardId === undefined ? {} : { rewardId }),
    ...(troopTypeId === undefined ? {} : { troopTypeId }),
  };
}

function decodeSnapshot(value: unknown, nodeId: string): NodeSnapshot {
  const entry = record(value, `snapshots.${nodeId}`);
  const kind = stringValue(entry['kind'], `snapshots.${nodeId}.kind`);
  if (kind === 'OFFERS') {
    requiredKeys(entry, ['kind', 'nodeId', 'offers', 'rerollsUsed', 'rollSlots', 'seed', 'snapshotId'], `snapshots.${nodeId}`);
    const offers = entry['offers'];
    if (!Array.isArray(offers)) throw new SaveError('INVALID_FIELD', { field: `snapshots.${nodeId}.offers` });
    return {
      kind,
      nodeId: stringValue(entry['nodeId'], `snapshots.${nodeId}.nodeId`),
      snapshotId: stringValue(entry['snapshotId'], `snapshots.${nodeId}.snapshotId`),
      seed: integerValue(entry['seed'], `snapshots.${nodeId}.seed`),
      offers: offers.map((offer, index) => decodeOffer(offer, `snapshots.${nodeId}.offers.${String(index)}`)),
      rollSlots: stringMap(entry['rollSlots'], `snapshots.${nodeId}.rollSlots`),
      rerollsUsed: integerValue(entry['rerollsUsed'], `snapshots.${nodeId}.rerollsUsed`),
    };
  }
  if (kind === 'EVENT') {
    requiredKeys(entry, ['eventId', 'kind', 'nodeId', 'options', 'rollSlots', 'seed', 'snapshotId'], `snapshots.${nodeId}`);
    const options = entry['options'];
    if (!Array.isArray(options)) throw new SaveError('INVALID_FIELD', { field: `snapshots.${nodeId}.options` });
    return {
      kind,
      nodeId: stringValue(entry['nodeId'], `snapshots.${nodeId}.nodeId`),
      snapshotId: stringValue(entry['snapshotId'], `snapshots.${nodeId}.snapshotId`),
      seed: integerValue(entry['seed'], `snapshots.${nodeId}.seed`),
      eventId: stringValue(entry['eventId'], `snapshots.${nodeId}.eventId`),
      options: options.map((option, index) => decodeEventOption(option, `snapshots.${nodeId}.options.${String(index)}`)),
      rollSlots: stringMap(entry['rollSlots'], `snapshots.${nodeId}.rollSlots`),
    };
  }
  if (kind === 'REWARD') {
    requiredKeys(entry, ['kind', 'nodeId', 'rewardIds', 'rollSlots', 'seed', 'snapshotId'], `snapshots.${nodeId}`);
    return {
      kind,
      nodeId: stringValue(entry['nodeId'], `snapshots.${nodeId}.nodeId`),
      snapshotId: stringValue(entry['snapshotId'], `snapshots.${nodeId}.snapshotId`),
      seed: integerValue(entry['seed'], `snapshots.${nodeId}.seed`),
      rewardIds: stringList(entry['rewardIds'], `snapshots.${nodeId}.rewardIds`),
      rollSlots: stringMap(entry['rollSlots'], `snapshots.${nodeId}.rollSlots`),
    };
  }
  throw new SaveError('INVALID_ENUM', { field: `snapshots.${nodeId}.kind` });
}

function decodeEventOption(value: unknown, field: string): EventOptionState {
  const entry = record(value, field);
  const keys = Object.keys(entry).sort();
  if (keys.some((key) => !['available', 'blockedReasonKey', 'optionId'].includes(key))) throw new SaveError('UNKNOWN_FIELD', { field });
  if (keys.length < 2 || keys.length > 3) throw new SaveError('INVALID_FIELD', { field });
  const blockedReasonKey = entry['blockedReasonKey'];
  if (blockedReasonKey !== undefined && typeof blockedReasonKey !== 'string') throw new SaveError('INVALID_FIELD', { field: `${field}.blockedReasonKey` });
  if (typeof entry['available'] !== 'boolean') throw new SaveError('INVALID_FIELD', { field: `${field}.available` });
  return {
    optionId: stringValue(entry['optionId'], `${field}.optionId`),
    available: entry['available'],
    ...(blockedReasonKey === undefined ? {} : { blockedReasonKey }),
  };
}

function decodeState(value: unknown): NodeRunState {
  const entry = record(value, 'state');
  closedKeys(entry, STATE_KEYS.filter((key) => key !== 'killsEarned' && key !== 'masteryKillsApplied'), ['killsEarned', 'masteryKillsApplied'], 'state');
  const visitsRecord = record(entry['visits'], 'state.visits');
  const snapshotsRecord = record(entry['snapshots'], 'state.snapshots');
  const ledgerRecord = record(entry['ledger'], 'state.ledger');
  const visits: Record<string, NodeVisitState> = {};
  const snapshots: Record<string, NodeSnapshot> = {};
  const ledger: Record<string, TransactionRecord> = {};
  for (const [nodeId, visit] of Object.entries(visitsRecord)) visits[nodeId] = decodeVisit(visit, nodeId);
  for (const [nodeId, snapshot] of Object.entries(snapshotsRecord)) snapshots[nodeId] = decodeSnapshot(snapshot, nodeId);
  for (const [transactionId, transaction] of Object.entries(ledgerRecord)) ledger[transactionId] = decodeTransaction(transaction, transactionId);
  const runStatus = stringValue(entry['runStatus'], 'state.runStatus');
  if (!['active', 'finished'].includes(runStatus)) throw new SaveError('INVALID_ENUM', { field: 'state.runStatus' });
  return {
    revision: integerValue(entry['revision'], 'state.revision'),
    runId: stringValue(entry['runId'], 'state.runId'),
    modeId: stringValue(entry['modeId'], 'state.modeId'),
    contentRevision: stringValue(entry['contentRevision'], 'state.contentRevision'),
    seed: integerValue(entry['seed'], 'state.seed'),
    mapHash: stringValue(entry['mapHash'], 'state.mapHash'),
    gold: integerValue(entry['gold'], 'state.gold'),
    instability: integerValue(entry['instability'], 'state.instability'),
    goldEarned: integerValue(entry['goldEarned'], 'state.goldEarned'),
    killsEarned: entry['killsEarned'] === undefined ? 0 : integerValue(entry['killsEarned'], 'state.killsEarned'),
    masteryKillsApplied: entry['masteryKillsApplied'] === undefined ? 0 : integerValue(entry['masteryKillsApplied'], 'state.masteryKillsApplied'),
    securedLoot: stringList(entry['securedLoot'], 'state.securedLoot'),
    unsecuredLoot: stringList(entry['unsecuredLoot'], 'state.unsecuredLoot'),
    relics: stringList(entry['relics'], 'state.relics'),
    recruits: stringList(entry['recruits'], 'state.recruits'),
    knowledge: stringList(entry['knowledge'], 'state.knowledge'),
    troopCopies: stringMap(entry['troopCopies'], 'state.troopCopies'),
    visits,
    snapshots,
    ledger,
    runStatus: runStatus as 'active' | 'finished',
  };
}

export function encodeExpeditionSave(runner: ExpeditionRunner): string {
  const value: ExpeditionSave = {
    schemaVersion: EXPEDITION_SAVE_VERSION,
    currentNodeId: runner.currentNodeId,
    state: runner.state,
  };
  return canonicalJson(value);
}

export function decodeExpeditionSave(value: unknown): ExpeditionSave {
  const entry = record(value, 'save');
  requiredKeys(entry, ROOT_KEYS, 'save');
  if (entry['schemaVersion'] !== EXPEDITION_SAVE_VERSION) throw new SaveError('INVALID_SCHEMA', { field: 'schemaVersion' });
  const currentNodeId = stringValue(entry['currentNodeId'], 'currentNodeId');
  return { schemaVersion: EXPEDITION_SAVE_VERSION, currentNodeId, state: decodeState(entry['state']) };
}

export function restoreExpeditionSave(serialized: string, map: ExpeditionMap): ExpeditionRunner {
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    throw new SaveError('INVALID_OBJECT', { field: 'serialized' });
  }
  const decoded = decodeExpeditionSave(value);
  return restoreExpedition(decoded.state, map, decoded.currentNodeId);
}
