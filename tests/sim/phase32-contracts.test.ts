import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../src/game/expedition/nodes/handlers/index.js';
import { buildRegistry } from '../../src/game/expedition/nodes/registry.js';
import { NODE_TYPES } from '../../src/game/expedition/types.js';
import { EVENT_DEFINITIONS } from '../../src/game/expedition/events/event-content.js';
import { validateEvents, EVENT_COUNT, hasFreeOption } from '../../src/game/expedition/events/event-validator.js';
import { RECRUITMENT_COPY_LIMIT } from '../../src/game/expedition/nodes/handlers/recruitment.js';
import { MERCHANT_MAX_REROLLS, MERCHANT_OFFER_COUNT } from '../../src/game/expedition/offers/offer-service.js';
import { RELIC_LIMIT_ASCENSION, RELIC_LIMIT_NORMAL, relicLimitForMode } from '../../src/game/expedition/run-economy.js';
import { catchExpeditionCode, readJson } from './phase32-helpers.js';

describe('phase32 constants', () => {
  const constants = readJson('phase32-constants.json') as {
    readonly phase: number;
    readonly eventCount: number;
    readonly merchantOfferCount: number;
    readonly merchantServiceCount: number;
    readonly merchantMaxRerolls: number;
    readonly recruitmentMinOffers: number;
    readonly recruitmentMaxOffers: number;
    readonly mapValidationRuns: number;
    readonly logicalLayers: number;
    readonly minVisits: number;
    readonly maxVisits: number;
    readonly gate: string;
  };

  it('pins the binding constants', () => {
    expect(constants.phase).toBe(32);
    expect(constants.gate).toBe('G32');
    expect(constants.eventCount).toBe(30);
    expect(constants.merchantOfferCount).toBe(4);
    expect(constants.merchantServiceCount).toBe(1);
    expect(constants.merchantMaxRerolls).toBe(1);
    expect(constants.recruitmentMinOffers).toBe(2);
    expect(constants.recruitmentMaxOffers).toBe(3);
    expect(constants.mapValidationRuns).toBe(100000);
    expect(constants.logicalLayers).toBe(6);
    expect(constants.minVisits).toBe(5);
    expect(constants.maxVisits).toBe(8);
  });

  it('aligns the production constants with the pinned fixture', () => {
    expect(EVENT_COUNT).toBe(constants.eventCount);
    expect(MERCHANT_OFFER_COUNT).toBe(constants.merchantOfferCount);
    expect(MERCHANT_MAX_REROLLS).toBe(constants.merchantMaxRerolls);
    expect(RECRUITMENT_COPY_LIMIT).toBe(3);
    expect(RELIC_LIMIT_NORMAL).toBe(6);
    expect(RELIC_LIMIT_ASCENSION).toBe(8);
    expect(relicLimitForMode('NORMAL')).toBe(6);
    expect(relicLimitForMode('ASCENSION')).toBe(8);
    expect(relicLimitForMode('mode.ascension')).toBe(8);
  });
});

describe('phase32 closed node registry (fixture-driven)', () => {
  const cases = readJson('fixtures/node-registry-cases.json') as readonly {
    readonly nodeType: string;
    readonly handlerExpected: boolean;
  }[];

  it('maps every fixture node type to exactly one handler', () => {
    expect(NODE_TYPES).toHaveLength(12);
    expect(nodeRegistry.size).toBe(12);
    for (const row of cases) {
      const type = row.nodeType.toLowerCase();
      if (type === 'unknown') {
        expect(nodeRegistry.has('unknown' as never)).toBe(false);
        expect(row.handlerExpected).toBe(false);
      } else {
        expect(nodeRegistry.has(type as never), row.nodeType).toBe(true);
        expect(row.handlerExpected).toBe(true);
        const handler = nodeRegistry.get(type as never);
        expect(handler?.type).toBe(type);
      }
    }
  });

  it('rejects duplicate and missing handlers as build errors', () => {
    const handlers = [...nodeRegistry.values()];
    const first = handlers[0];
    if (first === undefined) throw new Error('registry empty');
    const duplicate = [...handlers, first];
    expect(catchExpeditionCode(() => buildRegistry(duplicate))).toBe('CONTENT_BUILD_ERROR');
    expect(catchExpeditionCode(() => buildRegistry(handlers.filter((h) => h.type !== 'scout')))).toBe('CONTENT_BUILD_ERROR');
  });

  it('every handler declares allowed actions and an atomic commit phase', () => {
    for (const handler of nodeRegistry.values()) {
      expect(handler.allowedActions.length).toBeGreaterThan(0);
      expect(handler.commitPhase).toBe('ATOMIC');
    }
  });
});

describe('phase32 choice node cases (fixture-driven)', () => {
  const cases = readJson('fixtures/choice-node-cases.json') as readonly {
    readonly type: string;
    readonly actions: readonly string[];
    readonly maxActions?: number;
    readonly parallelBenefitDownside?: boolean;
  }[];

  it('exposes exactly the pinned action sets per node type', () => {
    const byType = new Map(cases.map((c) => [c.type.toLowerCase(), c]));
    for (const row of cases) {
      const handler = nodeRegistry.get(row.type.toLowerCase() as never);
      expect(handler, row.type).toBeDefined();
      for (const action of row.actions) {
        expect(handler?.allowedActions, `${row.type}.${action}`).toContain(action);
      }
    }
    const workshop = byType.get('workshop');
    expect(workshop?.maxActions).toBe(1);
    const altar = byType.get('altar');
    expect(altar?.parallelBenefitDownside).toBe(true);
  });
});

describe('phase32 merchant + recruitment cases (fixture-driven)', () => {
  const merchant = readJson('fixtures/merchant-cases.json') as {
    readonly offers: readonly { readonly offerId: string; readonly stock: number; readonly priceGold: number }[];
    readonly service: { readonly offerId: string; readonly priceGold: number };
    readonly maxRerolls: number;
  };
  const recruitment = readJson('fixtures/recruitment-cases.json') as {
    readonly offers: readonly { readonly offerId: string; readonly troopTypeId: string }[];
    readonly copyLimit: number;
  };

  it('pins the merchant offer shape (4 offers + 1 service, stock 1, max 1 reroll)', () => {
    expect(merchant.offers).toHaveLength(MERCHANT_OFFER_COUNT);
    expect(merchant.service.offerId).toBe('service-1');
    expect(merchant.maxRerolls).toBe(MERCHANT_MAX_REROLLS);
    for (const offer of merchant.offers) {
      expect(offer.stock).toBe(1);
      expect(offer.priceGold).toBeGreaterThan(0);
    }
  });

  it('pins the recruitment shape (2–3 candidates, copy limit 3)', () => {
    expect(recruitment.offers.length).toBeGreaterThanOrEqual(2);
    expect(recruitment.offers.length).toBeLessThanOrEqual(3);
    expect(recruitment.copyLimit).toBe(RECRUITMENT_COPY_LIMIT);
    expect(new Set(recruitment.offers.map((o) => o.troopTypeId)).size).toBe(recruitment.offers.length);
  });
});

describe('phase32 loot + kill-storage cases (fixture-driven)', () => {
  const loot = readJson('fixtures/loot-cases.json') as readonly {
    readonly case: string;
    readonly lostOnDefeat?: boolean;
    readonly requiresReplacement?: boolean;
    readonly replayed?: boolean;
  }[];
  const killMatrix = readJson('fixtures/kill-storage-matrix.json') as readonly {
    readonly point: string;
    readonly expected: string;
  }[];

  it('pins the loot security cases', () => {
    expect(loot).toHaveLength(4);
    const byCase = new Map(loot.map((c) => [c.case, c]));
    expect(byCase.get('secured')?.lostOnDefeat).toBe(false);
    expect(byCase.get('unsecured')?.lostOnDefeat).toBe(true);
    expect(byCase.get('full-relic-cap')?.requiresReplacement).toBe(true);
    expect(byCase.get('duplicate-reward-id')?.replayed).toBe(true);
  });

  it('pins the five kill/storage points', () => {
    expect(killMatrix).toHaveLength(5);
    const points = killMatrix.map((row) => row.point);
    expect(points).toEqual([
      'before_prepare',
      'after_prepare_before_durable_commit',
      'after_durable_commit_before_resolve',
      'after_resolve_before_navigation',
      'storage_failure',
    ]);
  });
});

describe('phase32 events-30 fixture', () => {
  const events = readJson('fixtures/events-30.json') as readonly {
    readonly eventId: string;
    readonly prerequisites: readonly string[];
    readonly options: readonly {
      readonly optionId: string;
      readonly labelKey: string;
      readonly cost: Readonly<Record<string, number>>;
      readonly preview: readonly string[];
      readonly rollSlots: readonly string[];
    }[];
  }[];

  it('the fixture holds exactly 30 structurally valid events', () => {
    expect(events).toHaveLength(30);
    validateEvents(EVENT_DEFINITIONS);
    const ids = new Set(events.map((e) => e.eventId));
    expect(ids.size).toBe(30);
    for (const event of events) {
      expect(event.options.length).toBeGreaterThanOrEqual(2);
      expect(event.options.length).toBeLessThanOrEqual(3);
      expect(new Set(event.options.map((o) => o.optionId)).size).toBe(event.options.length);
    }
  });

  it('the compiled content is byte-parity with the pinned fixture', () => {
    const compiled = EVENT_DEFINITIONS.map((event) => ({
      eventId: event.eventId,
      prerequisites: event.prerequisites,
      options: event.options.map((option) => ({
        optionId: option.optionId,
        labelKey: option.labelKey,
        cost: { ...option.cost },
        preview: option.preview,
        rollSlots: option.rollSlots,
      })),
    }));
    expect(compiled).toEqual(events);
  });

  it('every event offers at least one free, selectable option (GDD §20.1)', () => {
    for (const event of EVENT_DEFINITIONS) {
      expect(hasFreeOption(event), event.eventId).toBe(true);
    }
  });
});
