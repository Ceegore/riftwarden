import type { ReactNode, ElementType } from 'react';
export type TextStyle='display-xl'|'display-l'|'heading'|'body'|'body-small'|'hud'|'numeric';
export interface TypographyProps { as?: ElementType; style: TextStyle; children: ReactNode; className?: string; }
export function Typography({as:Tag='span',style,children,className}:TypographyProps){
  const classes=['rw-type-'+style,className].filter(Boolean).join(' ');
  return <Tag className={classes}>{children}</Tag>;
}
