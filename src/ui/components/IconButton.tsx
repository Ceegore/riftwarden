import type { ButtonHTMLAttributes,ReactNode } from 'react';
export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>{accessibleName:string;icon:ReactNode;}
export function IconButton({accessibleName,icon,...props}:IconButtonProps){return <button {...props} className="rw-button rw-focusable" aria-label={accessibleName}>{icon}</button>;}
