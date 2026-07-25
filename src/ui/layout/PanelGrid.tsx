import type { ReactNode, CSSProperties } from 'react';
export function PanelGrid({children,columns=1}: {children:ReactNode;columns?:1|2|3|4}){return <div className="rw-panel-grid" style={{'--rw-columns':columns} as CSSProperties}>{children}</div>;}
