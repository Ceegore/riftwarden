import type { ReactNode } from 'react';
import { LocalizedText } from '../../locales/LocalizedText.js';
export function Tooltip({open,children,onClose,closeLabelKey}: {open:boolean;children:ReactNode;onClose:()=>void;closeLabelKey:string}){if(!open)return null;const id=`tooltip-close-${closeLabelKey.replaceAll('.','-')}`;return <aside className="rw-tooltip" role="tooltip"><button type="button" onClick={onClose} aria-labelledby={id}><span aria-hidden="true">×</span><span id={id} className="rw-visually-hidden"><LocalizedText messageKey={closeLabelKey}/></span></button>{children}</aside>;}
