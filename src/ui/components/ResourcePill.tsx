import type { ReactNode } from 'react';
import { LocalizedText } from '@locales/LocalizedText';
export function ResourcePill({icon,value,nameKey}: {icon:ReactNode;value:string|number;nameKey:string}){const id=`resource-${nameKey.replaceAll('.','-')}`;return <span className="rw-resource-pill" aria-labelledby={id}><span id={id} className="rw-visually-hidden"><LocalizedText messageKey={nameKey}/></span><span aria-hidden="true">{icon}</span><span className="rw-type-numeric">{value}</span></span>;}
