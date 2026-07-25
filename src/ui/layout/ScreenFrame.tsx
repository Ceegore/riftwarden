import type { ReactNode } from 'react';
export interface ScreenFrameProps { children:ReactNode; className?:string; labelledBy?:string; }
export function ScreenFrame({children,className,labelledBy}:ScreenFrameProps){return <main className={['rw-screen-frame rw-safe-area',className].filter(Boolean).join(' ')} aria-labelledby={labelledBy}><div className="rw-screen-frame__content">{children}</div></main>;}
