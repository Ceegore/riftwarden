import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { LocalizedText } from '@locales/LocalizedText';
export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>,'children'> { labelKey:string; variant?:'primary'|'secondary'|'danger'|'ghost'; loading?:boolean; icon?:ReactNode; }
export function Button({labelKey,variant='secondary',loading=false,disabled=false,icon,...props}:ButtonProps){
 const className=['rw-button',variant==='primary'&&'rw-button--primary',variant==='danger'&&'rw-button--danger'].filter(Boolean).join(' ');
 return <button {...props} className={className} disabled={disabled||loading} aria-busy={loading||undefined}>{icon}<span><LocalizedText messageKey={labelKey}/></span>{loading?<span aria-hidden="true">…</span>:null}</button>;
}
