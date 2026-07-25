export type LayoutClass='phone_compact'|'phone_standard'|'tablet'|'large'|'portrait_narrow';
export type SafeEdge='top'|'right'|'bottom'|'left';
export interface LayoutEnvironment { layoutClass:LayoutClass; textScale:1|1.15|1.3|1.5|1.75|2; }
