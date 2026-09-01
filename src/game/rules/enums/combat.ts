class EnumParseError extends Error { constructor(readonly enumName:string, readonly value:unknown) { super('P11_ENUM_UNKNOWN'); } }

export const SideValues = Object.freeze(['player', 'enemy'] as const);
export type Side = (typeof SideValues)[number];
export function parseSide(value:unknown):Side {
  if (typeof value === 'string' && (SideValues as readonly string[]).includes(value)) return value as Side;
  throw new EnumParseError('Side', value);
}

export const LaneValues = Object.freeze(['top', 'middle', 'bottom'] as const);
export type Lane = (typeof LaneValues)[number];
export function parseLane(value:unknown):Lane {
  if (typeof value === 'string' && (LaneValues as readonly string[]).includes(value)) return value as Lane;
  throw new EnumParseError('Lane', value);
}

export const DepthValues = Object.freeze(['front', 'middle', 'back'] as const);
export type Depth = (typeof DepthValues)[number];
export function parseDepth(value:unknown):Depth {
  if (typeof value === 'string' && (DepthValues as readonly string[]).includes(value)) return value as Depth;
  throw new EnumParseError('Depth', value);
}

export const UnitCategoryValues = Object.freeze(['hero', 'troop', 'summon', 'enemy', 'boss', 'boss_object'] as const);
export type UnitCategory = (typeof UnitCategoryValues)[number];
export function parseUnitCategory(value:unknown):UnitCategory {
  if (typeof value === 'string' && (UnitCategoryValues as readonly string[]).includes(value)) return value as UnitCategory;
  throw new EnumParseError('UnitCategory', value);
}

export const RoleTagValues = Object.freeze(['defender', 'fighter', 'breaker', 'duelist', 'marksman', 'mage', 'healer', 'support', 'summoner', 'controller', 'constructor'] as const);
export type RoleTag = (typeof RoleTagValues)[number];
export function parseRoleTag(value:unknown):RoleTag {
  if (typeof value === 'string' && (RoleTagValues as readonly string[]).includes(value)) return value as RoleTag;
  throw new EnumParseError('RoleTag', value);
}

export const DamageTypeValues = Object.freeze(['physical', 'magical', 'true'] as const);
export type DamageType = (typeof DamageTypeValues)[number];
export function parseDamageType(value:unknown):DamageType {
  if (typeof value === 'string' && (DamageTypeValues as readonly string[]).includes(value)) return value as DamageType;
  throw new EnumParseError('DamageType', value);
}

export const TargetKindValues = Object.freeze(['enemy_unit', 'allied_unit', 'self', 'ground_position', 'summon_slot', 'boss_object'] as const);
export type TargetKind = (typeof TargetKindValues)[number];
export function parseTargetKind(value:unknown):TargetKind {
  if (typeof value === 'string' && (TargetKindValues as readonly string[]).includes(value)) return value as TargetKind;
  throw new EnumParseError('TargetKind', value);
}

export const AbilityKindValues = Object.freeze(['passive', 'basic_attack', 'signature', 'level3_once', 'boss', 'modifier', 'item'] as const);
export type AbilityKind = (typeof AbilityKindValues)[number];
export function parseAbilityKind(value:unknown):AbilityKind {
  if (typeof value === 'string' && (AbilityKindValues as readonly string[]).includes(value)) return value as AbilityKind;
  throw new EnumParseError('AbilityKind', value);
}

export const StatusKindValues = Object.freeze(['shield', 'attack_up', 'attack_speed_up', 'move_speed_up', 'resistance_up', 'regeneration', 'burn', 'poison', 'slow', 'weaken', 'silence', 'stun', 'mark', 'confusion'] as const);
export type StatusKind = (typeof StatusKindValues)[number];
export function parseStatusKind(value:unknown):StatusKind {
  if (typeof value === 'string' && (StatusKindValues as readonly string[]).includes(value)) return value as StatusKind;
  throw new EnumParseError('StatusKind', value);
}

export const StackPolicyValues = Object.freeze(['replace_if_stronger', 'refresh_duration', 'extend_duration_capped', 'independent_by_source', 'no_reapply'] as const);
export type StackPolicy = (typeof StackPolicyValues)[number];
export function parseStackPolicy(value:unknown):StackPolicy {
  if (typeof value === 'string' && (StackPolicyValues as readonly string[]).includes(value)) return value as StackPolicy;
  throw new EnumParseError('StackPolicy', value);
}
