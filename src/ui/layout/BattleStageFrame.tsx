import type { ReactNode } from 'react';
export function BattleStageFrame({children,label}: {children:ReactNode;label:string}){return <section className="rw-battle-stage" aria-label={label}>{children}</section>;}
