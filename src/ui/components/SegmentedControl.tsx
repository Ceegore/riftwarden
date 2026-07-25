import type { ReactNode } from 'react';
export interface Segment<T extends string>{id:T;label:ReactNode;disabled?:boolean;}
export function SegmentedControl<T extends string>({label,segments,value,onChange}: {label:ReactNode;segments:readonly Segment<T>[];value:T;onChange:(v:T)=>void}){return <fieldset><legend>{label}</legend>{segments.map((s)=><button className="rw-button" type="button" key={s.id} aria-pressed={s.id===value} disabled={s.disabled} onClick={()=>{onChange(s.id);}}>{s.label}</button>)}</fieldset>;}
