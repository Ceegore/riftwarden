// Phase 25 render/contract layer: pure read-only presentation types.
// These values are plain data produced by the simulation authority; the
// renderer never mutates, synthesizes or persists them.

export type StableId = string;

/** Lane ordinal (0=top, 1=middle, 2=bottom). Presentation ordering only. */
export type Lane = 0 | 1 | 2;

/** Fixed presentation layers 0-7 (see layer-graph.ts). */
export type LayerId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type VisualState =
  | 'spawn'
  | 'idle'
  | 'move'
  | 'prepare'
  | 'execute'
  | 'recover'
  | 'hurt'
  | 'control'
  | 'defeat'
  | 'victory';

export interface EntityFrame {
  readonly id: StableId;
  readonly lane: Lane;
  readonly logicalX100: number;
  readonly visualState: VisualState;
  readonly clipProgress1000: number;
}

export interface BattlePresentationFrame {
  readonly tick: number;
  readonly entities: readonly EntityFrame[];
  readonly gameplayHash: string;
}

export type PresentationEventKind = 'damage' | 'heal' | 'projectile' | 'spawn' | 'defeat' | 'battle_end';

export interface PresentationEvent {
  readonly sequence: number;
  readonly tick: number;
  readonly kind: PresentationEventKind;
  readonly sourceId?: StableId;
  readonly targetId?: StableId;
}

export type RendererLifecycle =
  | 'uninitialized'
  | 'initializing'
  | 'ready'
  | 'context_lost'
  | 'rebuilding'
  | 'failed_safe'
  | 'disposed';

export type RenderBackend = 'webgl2' | 'webgl1' | 'none';

export type RenderQualityTier = 'high' | 'medium' | 'low' | 'reduced';

/** Closed failure reasons; never free-form UI text (capability contract). */
export type RenderFailureReason =
  | 'webgl_unavailable'
  | 'webgl1_unvalidated'
  | 'context_creation_failed'
  | 'restore_failed'
  | 'rebuild_failed'
  | 'invalid_capability';

/** Back-channel ports from renderer to host (RENDER_AUTHORITY_CONTRACT). */
export type RenderBackChannel = 'pause' | 'save_request' | 'quality_telemetry' | 'recovery_status';
