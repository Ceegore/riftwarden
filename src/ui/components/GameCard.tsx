import type { ReactNode } from 'react';
export type GameCardState='default'|'selected'|'locked'|'new'|'incompatible'|'disabled';
export interface GameCardProps { title:ReactNode;children:ReactNode;state?:GameCardState;onSelect?:()=>void;activateLabel?:string; }
export function GameCard({title,children,state='default',onSelect}:GameCardProps){const disabled=state==='disabled'||state==='locked';return <article className="rw-game-card" aria-selected={state==='selected'} aria-disabled={disabled||undefined} data-state={state}><button type="button" className="rw-focusable" onClick={disabled?undefined:onSelect} disabled={disabled}>{title}</button><div>{children}</div></article>;}
