import type { ReactNode } from 'react';
export function ScrollRegion({children,label}: {children:ReactNode;label:string}){return <div className="rw-scroll-region" role="region" aria-label={label} tabIndex={0}>{children}</div>;}
