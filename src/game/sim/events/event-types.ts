import type { EventType } from './event-spec.js';
import type { EventSequence,Tick } from '../core/primitives.js';
export interface KernelEventInput {
  readonly type:EventType;
  readonly sourceId:string|null;
  readonly targetIds:readonly string[];
  readonly contentIds:readonly string[];
  readonly payload:Readonly<Record<string,number>>;
  readonly logTags:readonly string[];
}
export interface KernelEvent extends KernelEventInput { readonly tick:Tick; readonly sequence:EventSequence; }
